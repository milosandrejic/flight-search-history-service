# Flight Search History Service

Production-grade **NestJS + TypeScript** backend for flight search sessions, history, and async analytics — built on **DynamoDB single-table design** with **DynamoDB Streams + Lambda** event processing.

---

## Architecture

```
HTTP Client
    │
    ▼
NestJS API (REST)               ← runs locally / App Runner
    │
    ▼ PutItem / GetItem / Query
DynamoDB (single table)         ← FlightSearchHistory, us-east-1
    │
    ▼ DynamoDB Stream (INSERT events)
Lambda (stream processor)       ← deployed via AWS CDK
    │
    ├── idempotency check (conditional PutItem)
    ├── logs SEARCH_CREATED analytics event → CloudWatch
    └── on failure → SQS DLQ (after 3 retries)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/session` | Create a search session |
| `GET` | `/session/:id` | Get session by ID |
| `POST` | `/search` | Record a flight search |
| `GET` | `/search/:id` | Get search by ID |
| `GET` | `/search/recent?userId=` | Get recent searches for a user |
| `POST` | `/follow-up` | Add follow-up context to a session |
| `GET` | `/follow-up?sessionId=` | Get follow-ups for a session |
| `GET` | `/follow-up/session-searches?sessionId=` | Get all searches within a session |

---

## DynamoDB — Single-Table Design

**Table:** `FlightSearchHistory` — keys `PK` (String), `SK` (String), TTL attribute `expiresAt`

| Entity | PK | SK | GSI1PK / GSI1SK | GSI2PK / GSI2SK |
|--------|----|----|-----------------|-----------------|
| Session | `SESSION#<id>` | `SESSION#<id>` | `USER#<uid>` / `SESSION#<createdAt>#<id>` | — |
| Search | `SEARCH#<id>` | `SEARCH#<id>` | `USER#<uid>` / `SEARCH#<createdAt>#<id>` | `SESSION#<sid>` / `TS#<createdAt>` |
| FollowUp | `SESSION#<sid>` | `FOLLOWUP#<createdAt>#<id>` | — | — |
| Idempotency | `IDEMPOTENCY#<key>` | `IDEMPOTENCY#<key>` | — | — |

**Access patterns — no Scan, always Query:**

| Pattern | Operation |
|---------|-----------|
| Get session by ID | `GetItem` on main table |
| Get recent searches for a user | `Query` GSI1, `begins_with(SEARCH#)`, desc |
| Get searches within a session | `Query` GSI2 by session PK, desc |
| Get follow-ups for a session | `Query` main table, `begins_with(FOLLOWUP#)` |
| Idempotency guard | Conditional `PutItem` (`attribute_not_exists`) |

---

## Lambda — Stream Processor

Triggered by DynamoDB Streams on every INSERT. Filters to `SEARCH#` records only, checks idempotency, and emits a `SEARCH_CREATED` analytics event to CloudWatch Logs.

**Resilience:**
- Per-record error isolation with **partial batch response** (`batchItemFailures`) — failed records are retried independently, not the whole batch
- **3 retry attempts** before a record is sent to the **SQS Dead Letter Queue**
- **Idempotency** via conditional `PutItem` — duplicate stream deliveries are skipped

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | NestJS 11 + TypeScript |
| Database | AWS DynamoDB (single-table) |
| AWS SDK | v3 — `@aws-sdk/lib-dynamodb` |
| Stream processing | AWS Lambda (Node.js 22) |
| Infrastructure | AWS CDK (TypeScript) |
| Testing | Jest 30 + `aws-sdk-client-mock` |
| Validation | `class-validator` + `class-transformer` |

---

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server (watch mode)
npm run start:dev        # or: make dev

# Run all tests
npm test                 # or: make test
```

Requires a `.env` file — see `.env.example`.

## Deploying the Lambda

```bash
export DYNAMODB_STREAM_ARN="arn:aws:dynamodb:us-east-1:..."
make deploy-lambda
```
