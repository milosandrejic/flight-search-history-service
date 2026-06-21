// GSI index names — must match what was created in the AWS console
export const GSI1_INDEX_NAME = "GSI1";
export const GSI2_INDEX_NAME = "GSI2";

// GSI key attribute names
export const GSI1_PK = "GSI1PK";
export const GSI1_SK = "GSI1SK";
export const GSI2_PK = "GSI2PK";
export const GSI2_SK = "GSI2SK";

// Key prefixes — used to build PK/SK values and to filter in stream processing
export const KEY_PREFIX = {
  SESSION: "SESSION#",
  SEARCH: "SEARCH#",
  FOLLOWUP: "FOLLOWUP#",
  IDEMPOTENCY: "IDEMPOTENCY#",
  USER: "USER#",
  TS: "TS#",
} as const;
