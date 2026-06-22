import { mockClient } from "aws-sdk-client-mock";
import { DYNAMO_CLIENT } from "@/common/dynamo/dynamo.module";
import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";
import { FollowUpRepository } from "@/modules/follow-up/follow-up.repository";
import { FollowUpEntity } from "@/modules/follow-up/entities/follow-up.entity";

import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

import {
  PutCommand,
  QueryCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE_NAME = "FlightSearchHistory";

const testEntity: FollowUpEntity = {
  PK: `${KEY_PREFIX.SESSION}session-1`,
  SK: `${KEY_PREFIX.FOLLOWUP}2026-06-22T10:00:00.000Z#followup-1`,
  followUpId: "followup-1",
  sessionId: "session-1",
  userId: "user-1",
  content: "Looking for non-stop flights only",
  createdAt: "2026-06-22T10:00:00.000Z",
  expiresAt: 1750500000,
};

describe("FollowUpRepository", () => {
  let repository: FollowUpRepository;

  beforeEach(async () => {
    ddbMock.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpRepository,
        {
          provide: DYNAMO_CLIENT,
          useValue: ddbMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(TABLE_NAME),
          },
        },
      ],
    }).compile();

    repository = module.get<FollowUpRepository>(FollowUpRepository);
  });

  describe("create", () => {
    it("should send PutCommand with correct TableName, Item, and ConditionExpression", async () => {
      ddbMock.on(PutCommand).resolves({});

      await repository.create(testEntity);

      const call = ddbMock.commandCalls(PutCommand)[0];

      expect(call.args[0].input).toMatchObject({
        TableName: TABLE_NAME,
        Item: testEntity,
        ConditionExpression: "attribute_not_exists(SK)",
      });
    });
  });

  describe("getBySession", () => {
    it("should send QueryCommand on main table with correct PK and begins_with SK prefix", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repository.getBySession("session-1");

      const call = ddbMock.commandCalls(QueryCommand)[0];

      expect(call.args[0].input).toMatchObject({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `${KEY_PREFIX.SESSION}session-1`,
          ":prefix": KEY_PREFIX.FOLLOWUP,
        },
        ScanIndexForward: false,
      });
    });

    it("should return empty array when no items found", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repository.getBySession("session-1");

      expect(result).toEqual([]);
    });

    it("should return mapped entities when items are found", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [testEntity] });

      const result = await repository.getBySession("session-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(testEntity);
    });
  });
});
