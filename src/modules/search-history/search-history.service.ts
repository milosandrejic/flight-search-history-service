import { v4 as uuidv4 } from "uuid";
import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";

import { Injectable, NotFoundException } from "@nestjs/common";

import { SearchEntity } from "./entities/search.entity";
import { CreateSearchDto } from "./dto/create-search.dto";
import { SearchResponseDto } from "./dto/search-response.dto";
import { SearchHistoryRepository } from "./search-history.repository";

@Injectable()
export class SearchHistoryService {
  constructor(private readonly searchHistoryRepository: SearchHistoryRepository) {}

  async createSearch(dto: CreateSearchDto): Promise<SearchResponseDto> {
    const searchId = uuidv4();
    const createdAt = new Date().toISOString();

    const entity: SearchEntity = {
      PK: `${KEY_PREFIX.SEARCH}${searchId}`,
      SK: `${KEY_PREFIX.SEARCH}${searchId}`,
      GSI1PK: `${KEY_PREFIX.USER}${dto.userId}`,
      GSI1SK: `${KEY_PREFIX.SEARCH}${createdAt}#${searchId}`,
      GSI2PK: `${KEY_PREFIX.SESSION}${dto.sessionId}`,
      GSI2SK: `${KEY_PREFIX.TS}${createdAt}`,
      searchId,
      userId: dto.userId,
      sessionId: dto.sessionId,
      origin: dto.origin,
      destination: dto.destination,
      departureDate: dto.departureDate,
      createdAt,
    };

    await this.searchHistoryRepository.create(entity);

    return {
      searchId,
      userId: dto.userId,
      sessionId: dto.sessionId,
      origin: dto.origin,
      destination: dto.destination,
      departureDate: dto.departureDate,
      createdAt,
    };
  }

  async getSearch(searchId: string): Promise<SearchResponseDto> {
    const entity = await this.searchHistoryRepository.getById(searchId);

    if (!entity) {
      throw new NotFoundException(`Search ${searchId} not found`);
    }

    return {
      searchId: entity.searchId,
      userId: entity.userId,
      sessionId: entity.sessionId,
      origin: entity.origin,
      destination: entity.destination,
      departureDate: entity.departureDate,
      createdAt: entity.createdAt,
    };
  }

  async getRecentSearches(userId: string, limit: number): Promise<SearchResponseDto[]> {
    const entities = await this.searchHistoryRepository.getRecentByUser(userId, limit);

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
