export interface SearchEntity {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK: string;
  GSI2SK: string;
  searchId: string;
  userId: string;
  sessionId: string;
  origin: string;
  destination: string;
  departureDate: string;
  createdAt: string;
}