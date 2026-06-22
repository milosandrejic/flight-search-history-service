import { mockClient } from "aws-sdk-client-mock";
import { DYNAMO_CLIENT } from "@/common/dynamo/dynamo.module";
import { SearchEntity } from "@/modules/search-history/entities/search.entity";
import { SearchHistoryRepository } from "@/modules/search-history/search-history.repository";
import { KEY_PREFIX, GSI1_INDEX_NAME, GSI2_INDEX_NAME } from "@/common/dynamo/dynamo.constants";

import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE_NAME = "FlightSearchHistory";

const testEntity: SearchEntity = {
  PK: `${KEY_PREFIX.SEARCH}search-1`,
  SK: `${KEY_PREFIX.SEARCH}search-1`,
  GSI1PK: `${KEY_PREFIX.USER}user-1`,
  GSI1SK: `${KEY_PREFIX.SEARCH}2026-06-22T10:00:00.000Z#search-1`,
  GSI2PK: `${KEY_PREFIX.SESSION}session-1`,
  GSI2SK: `${KEY_PREFIX.TS}2026-06-22T10:00:00.000Z`,
  searchId: "search-1",
  userId: "user-1",
  sessionId: "session-1",
  origin: "BEG",
  destination: "DXB",
  departureDate: "2026-07-01",
  createdAt: "2026-06-22T10:00:00.000Z",
};

describe("SearchHistoryRepository", () => {
  let repository: SearchHistoryRepository;

  beforeEach(async () => {
    ddbMock.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchHistoryRepository,
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

    repository = module.get<SearchHistoryRepository>(SearchHistoryRepository);
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

      await repository.getById("search-1");

      const call = ddbMock.commandCalls(GetCommand)[0];

      expect(call.args[0].input).toMatchObject({
        TableName: TABLE_NAME,
        Key: {
          PK: `${KEY_PREFIX.SEARCH}search-1`,
          SK: `${KEY_PREFIX.SEARCH}search-1`,
        },
      });
    });

    it("should return null when item is not found", async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await repository.getById("search-1");

      expect(result).toBeNull();
    });

    it("should return the entity when item is found", async () => {
      ddbMock.on(GetCommand).resolves({ Item: testEntity });

      const result = await repository.getById("search-1");

      expect(result).toEqual(testEntity);
    });
  });

  describe("getRecentByUser", () => {
    it("should send QueryCommand against GSI1 with correct key condition and options", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repository.getRecentByUser("user-1", 5);

      const call = ddbMock.commandCalls(QueryCommand)[0];

      expect(call.args[0].input).toMatchObject({
        TableName: TABLE_NAME,
        IndexName: GSI1_INDEX_NAME,
        KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `${KEY_PREFIX.USER}user-1`,
          ":prefix": KEY_PREFIX.SEARCH,
        },
        ScanIndexForward: false,
        Limit: 5,
      });
    });

    it("should return empty array when no items found", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repository.getRecentByUser("user-1", 10);

      expect(result).toEqual([]);
    });

    it("should return mapped entities when items are found", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [testEntity] });

      const result = await repository.getRecentByUser("user-1", 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(testEntity);
    });
  });

  describe("getBySession", () => {
    it("should send QueryCommand against GSI2 with correct session key", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repository.getBySession("session-1");

      const call = ddbMock.commandCalls(QueryCommand)[0];

      expect(call.args[0].input).toMatchObject({
        TableName: TABLE_NAME,
        IndexName: GSI2_INDEX_NAME,
        KeyConditionExpression: "GSI2PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `${KEY_PREFIX.SESSION}session-1`,
        },
        ScanIndexForward: false,
      });
    });

    it("should return empty array when no searches in session", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repository.getBySession("session-1");

      expect(result).toEqual([]);
    });

    it("should return mapped entities when searches are found", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [testEntity] });

      const result = await repository.getBySession("session-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(testEntity);
    });
  });
});
