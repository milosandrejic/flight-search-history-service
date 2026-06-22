import { mockClient } from "aws-sdk-client-mock";
import { DYNAMO_CLIENT } from "@/common/dynamo/dynamo.module";
import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";
import { IdempotencyRepository } from "@/modules/idempotency/idempotency.repository";

import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE_NAME = "FlightSearchHistory";

describe("IdempotencyRepository", () => {
  let repository: IdempotencyRepository;

  beforeEach(async () => {
    ddbMock.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyRepository,
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

    repository = module.get<IdempotencyRepository>(IdempotencyRepository);
  });

  describe("isAlreadyProcessed", () => {
    it("should write idempotency record with correct PK, SK, eventId and expiresAt", async () => {
      ddbMock.on(PutCommand).resolves({});

      const before = Math.floor(Date.now() / 1000);
      await repository.isAlreadyProcessed("event-1");
      const after = Math.floor(Date.now() / 1000);

      const call = ddbMock.commandCalls(PutCommand)[0];

      expect(call.args[0].input).toMatchObject({
        TableName: TABLE_NAME,
        Item: {
          PK: `${KEY_PREFIX.IDEMPOTENCY}event-1`,
          SK: `${KEY_PREFIX.IDEMPOTENCY}event-1`,
          eventId: "event-1",
        },
        ConditionExpression: "attribute_not_exists(PK)",
      });

      const expiresAt = call.args[0].input.Item?.["expiresAt"] as number;
      expect(expiresAt).toBeGreaterThanOrEqual(before + 86400);
      expect(expiresAt).toBeLessThanOrEqual(after + 86400);
    });

    it("should return false when event is new (PutCommand succeeds)", async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repository.isAlreadyProcessed("event-1");

      expect(result).toBe(false);
    });

    it("should return true when event is duplicate (ConditionalCheckFailedException)", async () => {
      ddbMock.on(PutCommand).rejects(
        new ConditionalCheckFailedException({ message: "already exists", $metadata: {} }),
      );

      const result = await repository.isAlreadyProcessed("event-1");

      expect(result).toBe(true);
    });

    it("should re-throw errors that are not ConditionalCheckFailedException", async () => {
      const networkError = new Error("Network error");
      ddbMock.on(PutCommand).rejects(networkError);

      await expect(repository.isAlreadyProcessed("event-1")).rejects.toThrow("Network error");
    });
  });
});
