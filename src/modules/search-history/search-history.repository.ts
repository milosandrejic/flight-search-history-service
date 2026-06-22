import { DYNAMO_CLIENT } from "@/common/dynamo/dynamo.module";
import { KEY_PREFIX, GSI1_INDEX_NAME } from "@/common/dynamo/dynamo.constants";

import { ConfigService } from "@nestjs/config";
import { Inject, Injectable } from "@nestjs/common";

import { GetCommand, PutCommand, QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { SearchEntity } from "./entities/search.entity";

@Injectable()
export class SearchHistoryRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMO_CLIENT)
    private readonly client: DynamoDBDocumentClient,
    private readonly configService: ConfigService
  ) {
    this.tableName = this.configService.get<string>("DYNAMODB_TABLE_NAME") ?? "";
  }

  async create(entity: SearchEntity): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: entity,
      ConditionExpression: "attribute_not_exists(PK)"
    });

    await this.client.send(command);
  }

  async getById(searchId: string): Promise<SearchEntity | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: {
        PK: `${KEY_PREFIX.SEARCH}${searchId}`,
        SK: `${KEY_PREFIX.SEARCH}${searchId}`
      }
    });

    const result = await this.client.send(command);

    if (!result.Item) {
      return null;
    }

    return result.Item as SearchEntity;
  }

  async getRecentByUser(userId: string, limit: number): Promise<SearchEntity[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: GSI1_INDEX_NAME,
      KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `${KEY_PREFIX.USER}${userId}`,
        ":prefix": KEY_PREFIX.SEARCH,
      },
      ScanIndexForward: false,
      Limit: limit,
    });

    const result = await this.client.send(command);

    return (result.Items ?? []) as SearchEntity[];
  }
}