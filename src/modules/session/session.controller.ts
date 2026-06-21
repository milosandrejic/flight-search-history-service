import { Get, Body, Post, Param, Controller } from "@nestjs/common";

import { SessionService } from "./session.service";
import { CreateSessionDto } from "./dto/create-session.dto";

@Controller("session")
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  create(@Body() dto: CreateSessionDto) {
    return this.sessionService.createSession(dto);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.sessionService.getSession(id);
  }
}