import { DYNAMO_CLIENT } from "@/common/dynamo/dynamo.module";
import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";

import { ConfigService } from "@nestjs/config";
import { Inject, Injectable } from "@nestjs/common";

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const IDEMPOTENCY_TTL_SECONDS = 86400;

@Injectable()
export class IdempotencyRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMO_CLIENT)
    private readonly client: DynamoDBDocumentClient,
    private readonly configService: ConfigService,
  ) {
    this.tableName = this.configService.get<string>("DYNAMODB_TABLE_NAME") ?? "";
  }

  async isAlreadyProcessed(eventId: string): Promise<boolean> {
    const expiresAt = Math.floor(Date.now() / 1000) + IDEMPOTENCY_TTL_SECONDS;

    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `${KEY_PREFIX.IDEMPOTENCY}${eventId}`,
        SK: `${KEY_PREFIX.IDEMPOTENCY}${eventId}`,
        eventId,
        expiresAt,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    });

    try {
      await this.client.send(command);
      return false;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return true;
      }
      throw error;
    }
  }
}
