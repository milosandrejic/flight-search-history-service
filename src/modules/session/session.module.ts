import { DynamoModule } from "@/common/dynamo/dynamo.module";

import { Module } from "@nestjs/common";

import { SessionService } from "./session.service";
import { SessionController } from "./session.controller";
import { SessionRepository } from "./session.repository";

@Module({
  imports: [DynamoModule],
  controllers: [SessionController],
  providers: [SessionService, SessionRepository],
})
export class SessionModule {}