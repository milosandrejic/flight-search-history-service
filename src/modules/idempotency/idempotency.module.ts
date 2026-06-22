import { DynamoModule } from "@/common/dynamo/dynamo.module";

import { Module } from "@nestjs/common";

import { IdempotencyRepository } from "./idempotency.repository";

@Module({
  imports: [DynamoModule],
  providers: [IdempotencyRepository],
  exports: [IdempotencyRepository],
})
export class IdempotencyModule {}
