# Flight Search Session Service — Implementation Plan

## Overview

A production-grade **NestJS + TypeScript** backend for flight **search sessions** and **search
history**, modeled directly from **DynamoDB access patterns**, with **DynamoDB Streams + AWS Lambda**
event processing and **idempotency**. Conceptual sibling of the Python `flight-query-engine`
(FastAPI + Redis sessions), but fully **standalone**.

**Working style (per feature):** first explain (1) business requirement, (2) access patterns,
(3) table design, (4) PK/SK/GSI choices, (5) tradeoffs, (6) failure scenarios, (7) implementation plan —
then write code in small steps.

---

## Decisions

| Topic | Decision |
|---|---|
| Framework | NestJS (latest) + TypeScript |
| Live infra | **Real AWS** — DynamoDB table + Lambda deployed; low traffic = low cost |
| Table design tool | **NoSQL Workbench** — visualize and validate the single-table model |
| Verification | `tsc --noEmit` + `aws-sdk-client-mock` unit tests + manual against live table |
| Table modeling | **Single-table design** (canonical production DynamoDB) |
| AWS SDK | v3 — `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` (`DynamoDBDocumentClient`) |
| Infra as code | **AWS CDK (TypeScript)** — deployed to real AWS |
| Lambda DI | reuse Nest via `NestFactory.createApplicationContext` (no HTTP server) |
| Layering | thin controllers → services (logic) → repositories (data access) |
| Querying | **no `Scan`** for ops — always `Query` with PK/SK or GSI |
| Package manager | npm |
| File naming | kebab-case, named exports |

---

## DynamoDB single-table model

Table `FlightSearchHistory` — keys `PK` (S), `SK` (S); TTL attribute `expiresAt` (epoch seconds).
All `<createdAt>` values are **ISO-8601 UTC** (e.g. `2026-06-21T10:00:00.000Z`) so they sort
chronologically inside composite sort keys.

- **GSI1** (`GSI1PK` / `GSI1SK`) — user-scoped lookups (a user's sessions, a user's recent searches)
- **GSI2** (`GSI2PK` / `GSI2SK`) — session-scoped search collection (continue a session)

### Items

| Entity | PK | SK | GSI1PK / GSI1SK | GSI2PK / GSI2SK | TTL |
|---|---|---|---|---|---|
| **Session** | `SESSION#<sid>` | `SESSION#<sid>` | `USER#<uid>` / `SESSION#<createdAt>#<sid>` | — | `expiresAt` |
| **Search** | `SEARCH#<searchId>` | `SEARCH#<searchId>` | `USER#<uid>` / `SEARCH#<createdAt>#<searchId>` | `SESSION#<sid>` / `TS#<createdAt>` | — |
| **FollowUp** | `SESSION#<sid>` | `FOLLOWUP#<createdAt>#<id>` | — | — | `expiresAt` |
| **Idempotency** | `IDEMPOTENCY#<key>` | `IDEMPOTENCY#<key>` | — | — | `expiresAt` |

### Access patterns → query

| # | Access pattern | Operation |
|---|---|---|
| 1 | Get session by `sessionId` | `GetItem` PK=`SESSION#<sid>`, SK=`SESSION#<sid>` |
| 2 | Get a user's sessions | `Query` GSI1 PK=`USER#<uid>` begins_with `SESSION#`, desc |
| 3 | Get search details by `searchId` | `GetItem` PK=`SEARCH#<searchId>`, SK=`SEARCH#<searchId>` |
| 4 | Get recent searches for a user | `Query` GSI1 PK=`USER#<uid>` begins_with `SEARCH#`, desc, limit N |
| 5 | Get searches within a session (continue) | `Query` GSI2 PK=`SESSION#<sid>`, desc |
| 6 | Get follow-ups for a session | `Query` PK=`SESSION#<sid>` begins_with `FOLLOWUP#` |
| 7 | Idempotency guard | conditional `PutItem` `attribute_not_exists(PK)` |

---

## Architecture

```
Client ──HTTP──> NestJS API ──PutItem──> DynamoDB ──Stream──> event source mapping ──> Stream Processor Lambda
                                                                                              │
                                                                  idempotency check ──> downstream work
                                                                                              │
                                                                          on repeated failure ──> DLQ
```

- The **API** writes operational data and returns fast — no inline side-effects.
- The **Lambda** reacts **asynchronously** to table changes via Streams (decoupled, replayable).
- DynamoDB Streams is the only glue — the API never calls the Lambda directly.
- Lambda is **at-least-once** → design for **duplicates** (idempotency) and **poison records**
  (partial batch response + DLQ).

---

## Project Structure

```
src/
├── main.ts                       # HTTP bootstrap
├── app.module.ts                 # Root module
├── config/
│   └── config.module.ts          # Env config
├── common/
│   └── dynamo/
│       ├── dynamo.module.ts      # Provides DynamoDBDocumentClient
│       └── dynamo.constants.ts   # Table/index names, injection tokens
├── modules/
│   ├── sessions/
│   │   ├── sessions.controller.ts
│   │   ├── sessions.service.ts
│   │   ├── sessions.repository.ts
│   │   ├── dto/
│   │   └── entities/
│   ├── search-history/
│   │   ├── search-history.controller.ts
│   │   ├── search-history.service.ts
│   │   ├── search-history.repository.ts
│   │   ├── dto/
│   │   └── entities/
│   └── idempotency/
│       └── idempotency.repository.ts
└── lambda/
    ├── stream-handler.ts         # DynamoDB Streams → Lambda entry
    └── context.ts                # Cached Nest application context
infra/
└── stack.ts                      # AWS CDK — deployed to real AWS
test/
└── fixtures/                     # Saved stream-event fixtures
```

---

## Implementation Steps

### Phase 0: Scaffolding
- [x] **0.1** Init NestJS app, `tsconfig`, eslint/prettier, jest
- [x] **0.2** `ConfigModule` — env (table name, region, TTL seconds)
- [x] **0.3** `DynamoModule` — provide `DynamoDBDocumentClient` (region + credentials from env)
- [ ] **0.4** `dynamo.constants.ts` — table/index names + injection tokens
- [ ] **0.5** `/health` endpoint

### Phase 1: Sessions (features 1, 2, 6 TTL)
- [ ] **1.1** Session entity + DTOs
- [ ] **1.2** `SessionsRepository` — conditional `Put` (create), `GetItem` (by id)
- [ ] **1.3** TTL (`expiresAt`) set on create
- [ ] **1.4** `SessionsService` — business logic
- [ ] **1.5** `SessionsController` — thin POST / GET
- [ ] **1.6** Unit tests (mocked client)

### Phase 2: Search history (features 3, 4 + get-by-searchId)
- [ ] **2.1** Search entity + DTOs
- [ ] **2.2** `SearchHistoryRepository` — store search (`Put` with GSI1/GSI2 keys)
- [ ] **2.3** Get recent searches for user — `Query` GSI1, desc, limit N
- [ ] **2.4** Get search details by `searchId` — `GetItem`
- [ ] **2.5** Service + controller
- [ ] **2.6** Unit tests

### Phase 3: Follow-up context (feature 5)
- [ ] **3.1** FollowUp item write under session partition
- [ ] **3.2** Query follow-ups for a session (`begins_with FOLLOWUP#`)
- [ ] **3.3** "Continue session" — `Query` GSI2 for session searches
- [ ] **3.4** Service + controller + tests

### Phase 4: Streams + Lambda (features 7, 8)
- [ ] **4.1** CDK: enable stream (`NEW_AND_OLD_IMAGES`) + event source mapping
- [ ] **4.2** Cached Nest application context (`context.ts`)
- [ ] **4.3** `stream-handler.ts` — process only `INSERT` events where `PK` begins_with `SEARCH#`
      (ignore `SESSION#`, `FOLLOWUP#`, `IDEMPOTENCY#`)
- [ ] **4.4** Stream-event fixtures + unit tests

### Phase 5: Idempotency + resilience (feature 9)
- [ ] **5.1** `IdempotencyRepository` — conditional put (`attribute_not_exists`) + TTL
- [ ] **5.2** Wrap stream processing in idempotency guard (duplicate `eventID` skipped)
- [ ] **5.3** Partial batch response (`batchItemFailures`) + DLQ in CDK
- [ ] **5.4** Tests: replay duplicate events, simulate poison record

---

## Verification

- [ ] `tsc --noEmit` compiles; strong typing holds
- [ ] `npm run test` — repos/services with **aws-sdk-client-mock**: assert exact commands and params
      (PK/SK/GSI keys, `ConditionExpression`s)
- [ ] Stream handler unit-tested against fixtures; duplicate `eventID` replay is skipped
- [ ] Manual smoke test against real AWS table (create session, store search, get recent searches)
- [ ] CDK deployed; table + stream + Lambda verified in AWS console

---

## Out of scope (for now)

- Analytics / BI (`GROUP BY`, `COUNT`, `AVG`, top routes) — DynamoDB stays **operational** only;
  future path = stream events to a dedicated analytics store
- Auth / authN, real Duffel / OpenAI calls, multi-region
