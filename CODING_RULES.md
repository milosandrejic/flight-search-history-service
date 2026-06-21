# Coding Rules — Backend (NestJS + TypeScript)

## File & Module Naming

- **File naming**: kebab-case for all files (`sessions.service.ts`, `search-history.repository.ts`, `dynamo.module.ts`)
- **NestJS suffixes**: name files by role — `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.module.ts`, `*.dto.ts`, `*.entity.ts`
- **Exports**: named exports only (`export class SessionsService {}`) — no default exports
- **One class per file** unless tightly coupled (e.g. small related DTOs)
- **Folder per feature module**: `modules/<feature>/` with `controller`, `service`, `repository`, `dto/`, `entities/`

## Layering (strict)

- **Controllers are thin** — validate input (DTO), delegate to a service, return the result. No business logic, no AWS SDK calls.
- **Services hold business logic** — orchestration, rules, mapping between DTOs and entities.
- **Repositories own data access** — all DynamoDB commands live here. Nothing else builds `PutItem`/`Query`/`GetItem` params.
- **Never call the AWS SDK outside a repository.**

## Dependency Injection

- Use constructor injection with `private readonly`:
```typescript
constructor(private readonly sessionsRepository: SessionsRepository) {}
```
- Inject the DynamoDB client and config via **injection tokens / providers**, never instantiate clients inline.
- Depend on the narrowest type needed; no service reaches into another module's repository directly.

## Import Conventions

**Always use named imports** for third-party libraries (tree-shaking + clarity):

✅ **Correct:**
```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { SessionEntity } from "./entities/session.entity";
import { CreateSessionDto } from "./dto/create-session.dto";
```

❌ **Avoid:**
```typescript
import * as aws from "@aws-sdk/lib-dynamodb";   // prevents tree-shaking
import { Component } from "../../modules/component"; // deep relative parent import
```

### Import Formatting
- **Single import**: one line — `import { Injectable } from "@nestjs/common";`
- **Multiple imports (2+)**: multiline, each on its own line, closing brace on its own line:
```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException
} from "@nestjs/common";
```
- Order groups: Node/stdlib → third-party → internal (`@/` or module-relative), separated by a blank line.

## Spacing Rules

- **Empty line before `return`** unless the function starts with `return`
- **Empty line after variable declarations** before logic begins
- **Empty line before `if` guards** unless the function starts with the guard
- **Empty line between logical blocks** (build params → execute → map result)

✅ **Correct:**
```typescript
async getById(sessionId: string): Promise<SessionEntity | null> {
  const command = new GetCommand({
    TableName: this.tableName,
    Key: {
      PK: `SESSION#${sessionId}`,
      SK: `SESSION#${sessionId}`
    }
  });

  const result = await this.client.send(command);

  if (!result.Item) {
    return null;
  }

  return this.toEntity(result.Item);
}
```

## TypeScript Conventions

- **Strong typing everywhere** — no `any`. Prefer explicit return types on public methods.
- **Function declarations** for top-level helpers; arrow functions for callbacks/inline.
- **`const` by default**, `let` only when reassigned, never `var`.
- **DTOs** define request/response shape and own validation decorators (`class-validator`).
- **Entities** model the domain item; map DynamoDB attribute maps → entities inside the repository.
- **Interfaces/types** for DynamoDB item shapes (key attributes typed as template-literal strings where useful).
- **No magic strings** — table name, index names, and key prefixes come from a single constants file (`dynamo.constants.ts`).

### Variable extraction
- Extract **nested / multi-operation** expressions into named variables; keep **simple single-operation** expressions inline.
- Don't introduce a loop just to name a trivial expression — code should read clearly without over-extracting.

## DynamoDB Access Rules

- **No `Scan`** for operational queries — always `Query` with a PK (and SK/`begins_with`) or a GSI.
- **GetItem requires full primary key** — provide both `PK` and `SK` for the composite-key table.
- **Build keys from constants/helpers**, never hand-write prefixes at call sites.
- **`<createdAt>` is ISO-8601 UTC** so it sorts correctly inside composite sort keys.
- **Conditional writes** for create/idempotency — e.g. `ConditionExpression: "attribute_not_exists(PK)"`.
- **Use the DocumentClient** (`@aws-sdk/lib-dynamodb`) — work with plain JS objects, not raw `AttributeValue` maps.

## Error Handling

- Throw NestJS HTTP exceptions from services (`NotFoundException`, `ConflictException`, `BadRequestException`).
- Map DynamoDB conditional-check failures to a meaningful domain error (e.g. duplicate → `ConflictException`).
- Validate at boundaries only (DTOs + system edges); don't add defensive checks for impossible states.

## Testing

- Unit-test repositories/services with **aws-sdk-client-mock** — assert the exact command type and params
  (`TableName`, key attributes, `ConditionExpression`, `IndexName`, `ScanIndexForward`, `Limit`).
- Stream handlers are tested against saved event **fixtures**; assert idempotent replay (duplicate `eventID` skipped).
- One behavior per test; arrange–act–assert; no real AWS calls in unit tests.
