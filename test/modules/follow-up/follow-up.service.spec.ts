import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";
import { FollowUpService } from "@/modules/follow-up/follow-up.service";
import { FollowUpRepository } from "@/modules/follow-up/follow-up.repository";
import { FollowUpEntity } from "@/modules/follow-up/entities/follow-up.entity";
import { SearchEntity } from "@/modules/search-history/entities/search.entity";
import { SearchHistoryRepository } from "@/modules/search-history/search-history.repository";

import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

const testFollowUpEntity: FollowUpEntity = {
  PK: `${KEY_PREFIX.SESSION}session-1`,
  SK: `${KEY_PREFIX.FOLLOWUP}2026-06-22T10:00:00.000Z#followup-1`,
  followUpId: "followup-1",
  sessionId: "session-1",
  userId: "user-1",
  content: "Looking for non-stop flights only",
  createdAt: "2026-06-22T10:00:00.000Z",
  expiresAt: 1750500000,
};

const testSearchEntity: SearchEntity = {
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

describe("FollowUpService", () => {
  let service: FollowUpService;
  let followUpRepository: jest.Mocked<FollowUpRepository>;
  let searchHistoryRepository: jest.Mocked<SearchHistoryRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpService,
        {
          provide: FollowUpRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(undefined),
            getBySession: jest.fn(),
          },
        },
        {
          provide: SearchHistoryRepository,
          useValue: {
            getBySession: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(1800),
          },
        },
      ],
    }).compile();

    service = module.get<FollowUpService>(FollowUpService);
    followUpRepository = module.get(FollowUpRepository);
    searchHistoryRepository = module.get(SearchHistoryRepository);
  });

  describe("createFollowUp", () => {
    it("should build entity with correct PK and SK prefixes", async () => {
      const dto = { sessionId: "session-1", userId: "user-1", content: "Non-stop only" };

      await service.createFollowUp(dto);

      const entity = followUpRepository.create.mock.calls[0][0];

      expect(entity.PK).toBe(`${KEY_PREFIX.SESSION}session-1`);
      expect(entity.SK).toMatch(/^FOLLOWUP#/);
      expect(entity.sessionId).toBe("session-1");
      expect(entity.userId).toBe("user-1");
      expect(entity.content).toBe("Non-stop only");
    });

    it("should set expiresAt as epoch seconds plus TTL", async () => {
      const dto = { sessionId: "session-1", userId: "user-1", content: "Non-stop only" };
      const before = Math.floor(Date.now() / 1000);

      await service.createFollowUp(dto);

      const entity = followUpRepository.create.mock.calls[0][0];
      const after = Math.floor(Date.now() / 1000);

      expect(entity.expiresAt).toBeGreaterThanOrEqual(before + 1800);
      expect(entity.expiresAt).toBeLessThanOrEqual(after + 1800);
    });

    it("should return response DTO without DynamoDB keys", async () => {
      const dto = { sessionId: "session-1", userId: "user-1", content: "Non-stop only" };

      const result = await service.createFollowUp(dto);

      expect(result).not.toHaveProperty("PK");
      expect(result).not.toHaveProperty("SK");
      expect(result.sessionId).toBe("session-1");
      expect(result.userId).toBe("user-1");
      expect(result.content).toBe("Non-stop only");
    });
  });

  describe("getFollowUps", () => {
    it("should return mapped response DTOs", async () => {
      followUpRepository.getBySession.mockResolvedValue([testFollowUpEntity]);

      const result = await service.getFollowUps("session-1");

      expect(result).toHaveLength(1);
      expect(result[0].followUpId).toBe("followup-1");
      expect(result[0].content).toBe("Looking for non-stop flights only");
      expect(result[0]).not.toHaveProperty("PK");
      expect(result[0]).not.toHaveProperty("SK");
    });

    it("should return empty array when no follow-ups found", async () => {
      followUpRepository.getBySession.mockResolvedValue([]);

      const result = await service.getFollowUps("session-1");

      expect(result).toEqual([]);
    });
  });

  describe("getSessionSearches", () => {
    it("should return mapped search response DTOs", async () => {
      searchHistoryRepository.getBySession.mockResolvedValue([testSearchEntity]);

      const result = await service.getSessionSearches("session-1");

      expect(result).toHaveLength(1);
      expect(result[0].searchId).toBe("search-1");
      expect(result[0].sessionId).toBe("session-1");
      expect(result[0]).not.toHaveProperty("PK");
      expect(result[0]).not.toHaveProperty("GSI2PK");
    });

    it("should return empty array when no searches in session", async () => {
      searchHistoryRepository.getBySession.mockResolvedValue([]);

      const result = await service.getSessionSearches("session-1");

      expect(result).toEqual([]);
    });
  });
});
