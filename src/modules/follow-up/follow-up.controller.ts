import { Get, Body, Post, Query, Controller } from "@nestjs/common";

import { FollowUpService } from "./follow-up.service";
import { CreateFollowUpDto } from "./dto/create-follow-up.dto";

@Controller("follow-up")
export class FollowUpController {
  constructor(private readonly followUpService: FollowUpService) {}

  @Post()
  create(@Body() dto: CreateFollowUpDto) {
    return this.followUpService.createFollowUp(dto);
  }

  @Get()
  getBySession(@Query("sessionId") sessionId: string) {
    return this.followUpService.getFollowUps(sessionId);
  }

  @Get("session-searches")
  getSessionSearches(@Query("sessionId") sessionId: string) {
    return this.followUpService.getSessionSearches(sessionId);
  }
}
