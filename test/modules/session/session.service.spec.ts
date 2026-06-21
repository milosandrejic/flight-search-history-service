import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";
import { SessionService } from "@/modules/session/session.service";
import { SessionRepository } from "@/modules/session/session.repository";
import { SessionEntity } from "@/modules/session/entities/session.entity";

import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

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

describe("SessionService", () => {
  let service: SessionService;
  let repository: jest.Mocked<SessionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: SessionRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(undefined),
            getById: jest.fn(),
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

    service = module.get<SessionService>(SessionService);
    repository = module.get(SessionRepository);
  });

  describe("createSession", () => {
    it("should build entity with correct DynamoDB keys", async () => {
      const dto = { userId: "user-1", origin: "BEG", destination: "DXB" };

      await service.createSession(dto);

      const entity = repository.create.mock.calls[0][0];

      expect(entity.PK).toMatch(/^SESSION#/);
      expect(entity.SK).toEqual(entity.PK);
      expect(entity.GSI1PK).toBe(`${KEY_PREFIX.USER}user-1`);
      expect(entity.GSI1SK).toMatch(/^SESSION#/);
    });

    it("should set expiresAt as epoch seconds plus TTL", async () => {
      const dto = { userId: "user-1", origin: "BEG", destination: "DXB" };
      const before = Math.floor(Date.now() / 1000);

      await service.createSession(dto);

      const entity = repository.create.mock.calls[0][0];
      const after = Math.floor(Date.now() / 1000);

      expect(entity.expiresAt).toBeGreaterThanOrEqual(before + 1800);
      expect(entity.expiresAt).toBeLessThanOrEqual(after + 1800);
    });

    it("should return response DTO without DynamoDB keys", async () => {
      const dto = { userId: "user-1", origin: "BEG", destination: "DXB" };

      const result = await service.createSession(dto);

      expect(result).not.toHaveProperty("PK");
      expect(result).not.toHaveProperty("SK");
      expect(result).not.toHaveProperty("GSI1PK");
      expect(result).not.toHaveProperty("GSI1SK");
      expect(result.userId).toBe("user-1");
      expect(result.origin).toBe("BEG");
      expect(result.destination).toBe("DXB");
    });
  });

  describe("getSession", () => {
    it("should return response DTO when session is found", async () => {
      repository.getById.mockResolvedValue(testEntity);

      const result = await service.getSession("session-1");

      expect(result.sessionId).toBe("session-1");
      expect(result.userId).toBe("user-1");
      expect(result).not.toHaveProperty("PK");
    });

    it("should throw NotFoundException when session is not found", async () => {
      repository.getById.mockResolvedValue(null);

      await expect(service.getSession("session-1")).rejects.toThrow(NotFoundException);
    });
  });
});
