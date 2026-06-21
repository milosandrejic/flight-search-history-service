export interface SessionEntity {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  sessionId: string;
  userId: string;
  origin: string;
  destination: string;
  createdAt: string;
  expiresAt: number;
}