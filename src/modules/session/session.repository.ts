import { DYNAMO_CLIENT } from "@/common/dynamo/dynamo.module";
import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";

import { ConfigService } from "@nestjs/config";
import {
  Inject,
  Injectable
} from "@nestjs/common";

import { PutCommand, GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { SessionEntity } from "./entities/session.entity";

@Injectable()
export class SessionRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMO_CLIENT)
    private readonly client: DynamoDBDocumentClient,
    private readonly configService: ConfigService
  ) {
    this.tableName = this.configService.get<string>("DYNAMODB_TABLE_NAME") ?? "";
  }

  async create(entity: SessionEntity): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: entity,
      ConditionExpression: "attribute_not_exists(PK)"
    });

    await this.client.send(command);
  }

  async getById(sessionId: string): Promise<SessionEntity | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: {
        PK: `${KEY_PREFIX.SESSION}${sessionId}`,
        SK: `${KEY_PREFIX.SESSION}${sessionId}`,
      }
    });

    const result = await this.client.send(command);

    if (!result.Item) {
      return null;
    }

    return result.Item as SessionEntity;
  }
}