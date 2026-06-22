import type { DynamoDBRecord, DynamoDBStreamEvent } from "aws-lambda";

import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";
import { IdempotencyRepository } from "@/modules/idempotency/idempotency.repository";

import { unmarshall } from "@aws-sdk/util-dynamodb";

import { getIdempotencyRepository } from "./context";

interface SearchAnalyticsEvent {
  eventType: "SEARCH_CREATED";
  searchId: string;
  userId: string;
  origin: string;
  destination: string;
  departureDate: string;
  createdAt: string;
}

async function processRecord(
  record: DynamoDBRecord,
  idempotencyRepository: IdempotencyRepository,
): Promise<void> {
  if (record.eventName !== "INSERT") {
    return;
  }

  const image = record.dynamodb?.NewImage;

  if (!image) {
    return;
  }

  const item = unmarshall(image as Parameters<typeof unmarshall>[0]);

  if (!(item["PK"] as string).startsWith(KEY_PREFIX.SEARCH)) {
    return;
  }

  const eventId = record.eventID;

  if (!eventId) {
    return;
  }

  const alreadyProcessed = await idempotencyRepository.isAlreadyProcessed(eventId);

  if (alreadyProcessed) {
    console.log(JSON.stringify({ skipped: true, eventId }));
    return;
  }

  const analyticsEvent: SearchAnalyticsEvent = {
    eventType: "SEARCH_CREATED",
    searchId: item["searchId"] as string,
    userId: item["userId"] as string,
    origin: item["origin"] as string,
    destination: item["destination"] as string,
    departureDate: item["departureDate"] as string,
    createdAt: item["createdAt"] as string,
  };

  console.log(JSON.stringify(analyticsEvent));
}

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  const idempotencyRepository = getIdempotencyRepository();

  for (const record of event.Records) {
    await processRecord(record, idempotencyRepository);
  }
};