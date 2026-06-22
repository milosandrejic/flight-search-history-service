import { v4 as uuidv4 } from "uuid";
import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";
import { SearchResponseDto } from "@/modules/search-history/dto/search-response.dto";
import { SearchHistoryRepository } from "@/modules/search-history/search-history.repository";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { FollowUpRepository } from "./follow-up.repository";
import { FollowUpEntity } from "./entities/follow-up.entity";
import { CreateFollowUpDto } from "./dto/create-follow-up.dto";
import { FollowUpResponseDto } from "./dto/follow-up-response.dto";

@Injectable()
export class FollowUpService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly followUpRepository: FollowUpRepository,
    private readonly searchHistoryRepository: SearchHistoryRepository,
    private readonly configService: ConfigService,
  ) {
    this.ttlSeconds = this.configService.get<number>("SESSION_TTL_SECONDS") ?? 1800;
  }

  async createFollowUp(dto: CreateFollowUpDto): Promise<FollowUpResponseDto> {
    const followUpId = uuidv4();
    const createdAt = new Date().toISOString();
    const expiresAt = Math.floor(Date.now() / 1000) + this.ttlSeconds;

    const entity: FollowUpEntity = {
      PK: `${KEY_PREFIX.SESSION}${dto.sessionId}`,
      SK: `${KEY_PREFIX.FOLLOWUP}${createdAt}#${followUpId}`,
      followUpId,
      sessionId: dto.sessionId,
      userId: dto.userId,
      content: dto.content,
      createdAt,
      expiresAt,
    };

    await this.followUpRepository.create(entity);

    return {
      followUpId,
      sessionId: dto.sessionId,
      userId: dto.userId,
      content: dto.content,
      createdAt,
      expiresAt,
    };
  }

  async getFollowUps(sessionId: string): Promise<FollowUpResponseDto[]> {
    const entities = await this.followUpRepository.getBySession(sessionId);

    return entities.map((entity) => ({
      followUpId: entity.followUpId,
      sessionId: entity.sessionId,
      userId: entity.userId,
      content: entity.content,
      createdAt: entity.createdAt,
      expiresAt: entity.expiresAt,
    }));
  }

  async getSessionSearches(sessionId: string): Promise<SearchResponseDto[]> {
    const entities = await this.searchHistoryRepository.getBySession(sessionId);

    return entities.map((entity) => ({
      searchId: entity.searchId,
      userId: entity.userId,
      sessionId: entity.sessionId,
      origin: entity.origin,
      destination: entity.destination,
      departureDate: entity.departureDate,
      createdAt: entity.createdAt,
    }));
  }
}