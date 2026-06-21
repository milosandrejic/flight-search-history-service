import {v4 as uuidv4} from "uuid";
import { KEY_PREFIX } from "@/common/dynamo/dynamo.constants";

import { ConfigService } from "@nestjs/config";
import { Injectable, NotFoundException } from "@nestjs/common";

import { SessionRepository } from "./session.repository";
import { CreateSessionDto } from "./dto/create-session.dto";
import { SessionResponseDto } from "./dto/session-response.dto";

@Injectable()
export class SessionService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly configService: ConfigService
  ) {
    this.ttlSeconds = this.configService.get<number>("SESSION_TTL_SECONDS") ?? 1800;
  }

  async createSession(dto: CreateSessionDto): Promise<SessionResponseDto> {
    const sessionId = uuidv4();
    const createdAt = new Date().toISOString();
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = nowInSeconds + this.ttlSeconds;

    const entity = {
      PK: `${KEY_PREFIX.SESSION}${sessionId}`,
      SK: `${KEY_PREFIX.SESSION}${sessionId}`,
      GSI1PK: `${KEY_PREFIX.USER}${dto.userId}`,
      GSI1SK: `${KEY_PREFIX.SESSION}${createdAt}#${sessionId}`,
      sessionId,
      userId: dto.userId,
      origin: dto.origin,
      destination: dto.destination,
      createdAt,
      expiresAt,
    };

    await this.sessionRepository.create(entity);

    return {
      sessionId,
      userId: dto.userId,
      origin: dto.origin,
      destination: dto.destination,
      createdAt,
      expiresAt
    };
  }

  async getSession(sessionId: string): Promise<SessionResponseDto> {
    const entity = await this.sessionRepository.getById(sessionId);

    if (!entity) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    return {
      sessionId: entity.sessionId,
      userId: entity.userId,
      origin: entity.origin,
      destination: entity.destination,
      createdAt: entity.createdAt,
      expiresAt: entity.expiresAt
    };
  }
}