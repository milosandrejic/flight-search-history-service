import { DYNAMO_CLIENT } from "@/common/dynamo/dynamo.module";
import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";

import { ConfigService } from "@nestjs/config";
import { Inject, Injectable } from "@nestjs/common";

import { PutCommand, QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { FollowUpEntity } from "./entities/follow-up.entity";

@Injectable()
export class FollowUpRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMO_CLIENT)
    private readonly client: DynamoDBDocumentClient,
    private readonly configService: ConfigService
  ) {
    this.tableName = this.configService.get<string>("DYNAMODB_TABLE_NAME") ?? "";
  }

  async create(entity: FollowUpEntity): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: entity,
      ConditionExpression: "attribute_not_exists(SK)"
    });

    await this.client.send(command);
  }

  async getBySession(sessionId: string): Promise<FollowUpEntity[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `${KEY_PREFIX.SESSION}${sessionId}`,
        ":prefix": KEY_PREFIX.FOLLOWUP,
      },
      ScanIndexForward: false,
    });

    const result = await this.client.send(command);

    return (result.Items ?? []) as FollowUpEntity[];
  }
}