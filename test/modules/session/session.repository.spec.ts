import { mockClient } from "aws-sdk-client-mock";
import { DYNAMO_CLIENT } from "@/common/dynamo/dynamo.module";
import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";
import { SessionRepository } from "@/modules/session/session.repository";
import { SessionEntity } from "@/modules/session/entities/session.entity";

import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

import {
  GetCommand,
  PutCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE_NAME = "FlightSearchHistory";

const testEntity: SessionEntity = {
  PK: `${KEY_PREFIX.SESSION}session-1`,
  SK: `${KEY_PREFIX.SESSION}session-1`,
  GSI1PK: `${KEY_PREFIX.USER}user-1`,
  GSI1SK: `${KEY_PREFIX.SESSION}2026-06-21T10:00:00.000Z#session-1`,
  sessionId: "session-1",
  userId: "user-1",
  origin: "BEG",
  destination: "DXB",
  createdAt: "2026-06-21T10:00:00.000Z",
  expiresAt: 1750500000,
};

describe("SessionRepository", () => {
  let repository: SessionRepository;

  beforeEach(async () => {
    ddbMock.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionRepository,
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

    repository = module.get<SessionRepository>(SessionRepository);
  });

  describe("create", () => {
    it("should send PutCommand with correct TableName, Item, and ConditionExpression", async () => {
      ddbMock.on(PutCommand).resolves({});

      await repository.create(testEntity);

      const call = ddbMock.commandCalls(PutCommand)[0];

      expect(call.args[0].input).toMatchObject({
        TableName: TABLE_NAME,
        Item: testEntity,
        ConditionExpression: "attribute_not_exists(PK)",
      });
    });
  });

  describe("getById", () => {
    it("should send GetCommand with correct PK and SK", async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await repository.getById("session-1");

      const call = ddbMock.commandCalls(GetCommand)[0];

      expect(call.args[0].input).toMatchObject({
        TableName: TABLE_NAME,
        Key: {
          PK: `${KEY_PREFIX.SESSION}session-1`,
          SK: `${KEY_PREFIX.SESSION}session-1`,
        },
      });
    });

    it("should return null when item is not found", async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await repository.getById("session-1");

      expect(result).toBeNull();
    });

    it("should return the entity when item is found", async () => {
      ddbMock.on(GetCommand).resolves({ Item: testEntity });

      const result = await repository.getById("session-1");

      expect(result).toEqual(testEntity);
    });
  });
});
