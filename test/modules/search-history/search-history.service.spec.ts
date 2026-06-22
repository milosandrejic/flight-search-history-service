import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";
import { SearchEntity } from "@/modules/search-history/entities/search.entity";
import { SearchHistoryService } from "@/modules/search-history/search-history.service";
import { SearchHistoryRepository } from "@/modules/search-history/search-history.repository";

import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

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

describe("SearchHistoryService", () => {
  let service: SearchHistoryService;
  let repository: jest.Mocked<SearchHistoryRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchHistoryService,
        {
          provide: SearchHistoryRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(undefined),
            getById: jest.fn(),
            getRecentByUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SearchHistoryService>(SearchHistoryService);
    repository = module.get(SearchHistoryRepository);
  });

  describe("createSearch", () => {
    it("should build entity with correct DynamoDB keys", async () => {
      const dto = {
        userId: "user-1",
        sessionId: "session-1",
        origin: "BEG",
        destination: "DXB",
        departureDate: "2026-07-01",
      };

      await service.createSearch(dto);

      const entity = repository.create.mock.calls[0][0];

      expect(entity.PK).toMatch(/^SEARCH#/);
      expect(entity.SK).toEqual(entity.PK);
      expect(entity.GSI1PK).toBe(`${KEY_PREFIX.USER}user-1`);
      expect(entity.GSI1SK).toMatch(/^SEARCH#/);
      expect(entity.GSI2PK).toBe(`${KEY_PREFIX.SESSION}session-1`);
      expect(entity.GSI2SK).toMatch(/^TS#/);
    });

    it("should return response DTO without DynamoDB keys", async () => {
      const dto = {
        userId: "user-1",
        sessionId: "session-1",
        origin: "BEG",
        destination: "DXB",
        departureDate: "2026-07-01",
      };

      const result = await service.createSearch(dto);

      expect(result).not.toHaveProperty("PK");
      expect(result).not.toHaveProperty("SK");
      expect(result).not.toHaveProperty("GSI1PK");
      expect(result).not.toHaveProperty("GSI1SK");
      expect(result).not.toHaveProperty("GSI2PK");
      expect(result).not.toHaveProperty("GSI2SK");
      expect(result.userId).toBe("user-1");
      expect(result.sessionId).toBe("session-1");
      expect(result.origin).toBe("BEG");
      expect(result.destination).toBe("DXB");
      expect(result.departureDate).toBe("2026-07-01");
    });
  });

  describe("getSearch", () => {
    it("should return response DTO when search is found", async () => {
      repository.getById.mockResolvedValue(testEntity);

      const result = await service.getSearch("search-1");

      expect(result.searchId).toBe("search-1");
      expect(result.userId).toBe("user-1");
      expect(result.sessionId).toBe("session-1");
      expect(result).not.toHaveProperty("PK");
    });

    it("should throw NotFoundException when search is not found", async () => {
      repository.getById.mockResolvedValue(null);

      await expect(service.getSearch("search-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("getRecentSearches", () => {
    it("should return mapped response DTOs", async () => {
      repository.getRecentByUser.mockResolvedValue([testEntity]);

      const result = await service.getRecentSearches("user-1", 10);

      expect(result).toHaveLength(1);
      expect(result[0].searchId).toBe("search-1");
      expect(result[0]).not.toHaveProperty("PK");
      expect(result[0]).not.toHaveProperty("GSI1PK");
    });

    it("should return empty array when no recent searches found", async () => {
      repository.getRecentByUser.mockResolvedValue([]);

      const result = await service.getRecentSearches("user-1", 10);

      expect(result).toEqual([]);
    });
  });
});
