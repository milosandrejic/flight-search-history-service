import type { DynamoDBStreamEvent } from "aws-lambda";

import { handler } from "@/lambda/stream-handler";
import { getIdempotencyRepository } from "@/lambda/context";
import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";
import { IdempotencyRepository } from "@/modules/idempotency/idempotency.repository";

jest.mock("@/lambda/context");

const mockIsAlreadyProcessed = jest.fn();
const mockGetIdempotencyRepository = jest.mocked(getIdempotencyRepository);

const makeSearchInsertRecord = (eventId: string, sequenceNumber = `seq-${eventId}`) => ({
  eventID: eventId,
  eventName: "INSERT" as const,
  dynamodb: {
    SequenceNumber: sequenceNumber,
    NewImage: {
      PK: { S: `${KEY_PREFIX.SEARCH}search-1` },
      SK: { S: `${KEY_PREFIX.SEARCH}search-1` },
      searchId: { S: "search-1" },
      userId: { S: "user-1" },
      origin: { S: "BEG" },
      destination: { S: "DXB" },
      departureDate: { S: "2026-07-15" },
      createdAt: { S: "2026-06-22T10:00:00.000Z" },
    },
  },
});

const makeEvent = (records: object[]): DynamoDBStreamEvent => ({
  Records: records,
});

describe("stream-handler", () => {
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockGetIdempotencyRepository.mockReturnValue({
      isAlreadyProcessed: mockIsAlreadyProcessed,
    } as unknown as IdempotencyRepository);

    mockIsAlreadyProcessed.mockResolvedValue(false);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("filtering", () => {
    it("should skip non-INSERT events", async () => {
      const event = makeEvent([{ ...makeSearchInsertRecord("evt-1"), eventName: "MODIFY" }]);

      const result = await handler(event);

      expect(result.batchItemFailures).toHaveLength(0);
      expect(mockIsAlreadyProcessed).not.toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should skip INSERT events where PK does not start with SEARCH#", async () => {
      const sessionRecord = {
        eventID: "evt-2",
        eventName: "INSERT" as const,
        dynamodb: {
          SequenceNumber: "seq-evt-2",
          NewImage: {
            PK: { S: `${KEY_PREFIX.SESSION}session-1` },
            SK: { S: `${KEY_PREFIX.SESSION}session-1` },
          },
        },
      };

      const result = await handler(makeEvent([sessionRecord]));

      expect(result.batchItemFailures).toHaveLength(0);
      expect(mockIsAlreadyProcessed).not.toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should skip records with no NewImage", async () => {
      const record = {
        eventID: "evt-3",
        eventName: "INSERT" as const,
        dynamodb: { SequenceNumber: "seq-evt-3" },
      };

      const result = await handler(makeEvent([record]));

      expect(result.batchItemFailures).toHaveLength(0);
      expect(mockIsAlreadyProcessed).not.toHaveBeenCalled();
    });
  });

  describe("idempotency", () => {
    it("should skip processing and log skipped when event was already processed", async () => {
      mockIsAlreadyProcessed.mockResolvedValue(true);

      const result = await handler(makeEvent([makeSearchInsertRecord("evt-4")]));

      expect(result.batchItemFailures).toHaveLength(0);
      expect(mockIsAlreadyProcessed).toHaveBeenCalledWith("evt-4");
      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify({ skipped: true, eventId: "evt-4" }),
      );
    });
  });

  describe("analytics event", () => {
    it("should log correct analytics event for a new SEARCH# INSERT", async () => {
      const result = await handler(makeEvent([makeSearchInsertRecord("evt-5")]));

      expect(result.batchItemFailures).toHaveLength(0);
      expect(mockIsAlreadyProcessed).toHaveBeenCalledWith("evt-5");
      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify({
          eventType: "SEARCH_CREATED",
          searchId: "search-1",
          userId: "user-1",
          origin: "BEG",
          destination: "DXB",
          departureDate: "2026-07-15",
          createdAt: "2026-06-22T10:00:00.000Z",
        }),
      );
    });

    it("should process multiple records in a batch independently", async () => {
      const result = await handler(makeEvent([
        makeSearchInsertRecord("evt-6"),
        makeSearchInsertRecord("evt-7"),
      ]));

      expect(result.batchItemFailures).toHaveLength(0);
      expect(mockIsAlreadyProcessed).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("batchItemFailures", () => {
    it("should return failed record sequence numbers when processing throws", async () => {
      mockIsAlreadyProcessed.mockRejectedValueOnce(new Error("DynamoDB unavailable"));
      mockIsAlreadyProcessed.mockResolvedValueOnce(false);

      const result = await handler(makeEvent([
        makeSearchInsertRecord("evt-8", "seq-001"),
        makeSearchInsertRecord("evt-9", "seq-002"),
      ]));

      expect(result.batchItemFailures).toEqual([{ itemIdentifier: "seq-001" }]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });

    it("should return empty batchItemFailures when all records succeed", async () => {
      const result = await handler(makeEvent([makeSearchInsertRecord("evt-10")]));

      expect(result.batchItemFailures).toEqual([]);
    });
  });
});
