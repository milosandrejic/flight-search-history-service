import { IdempotencyRepository } from "@/modules/idempotency/idempotency.repository";

import { ConfigService } from "@nestjs/config";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let idempotencyRepository: IdempotencyRepository | null = null;

export function getIdempotencyRepository(): IdempotencyRepository {
  if (!idempotencyRepository) {
    const docClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: process.env.DYNAMODB_REGION ?? "us-east-1" }),
      { marshallOptions: { removeUndefinedValues: true } },
    );

    // Minimal ConfigService shim — reads from Lambda environment variables
    const configService = {
      get: <T>(key: string): T => process.env[key] as unknown as T,
    } as unknown as ConfigService;

    idempotencyRepository = new IdempotencyRepository(docClient, configService);
  }

  return idempotencyRepository;
}
