import { DynamoModule } from "@/common/dynamo/dynamo.module";
import { SearchHistoryModule } from "@/modules/search-history/search-history.module";

import { Module } from "@nestjs/common";

import { FollowUpService } from "./follow-up.service";
import { FollowUpController } from "./follow-up.controller";
import { FollowUpRepository } from "./follow-up.repository";

@Module({
  imports: [DynamoModule, SearchHistoryModule],
  controllers: [FollowUpController],
  providers: [FollowUpService, FollowUpRepository],
})
export class FollowUpModule {}
