import { DynamoModule } from "@/common/dynamo/dynamo.module";

import { Module } from "@nestjs/common";

import { SearchHistoryService } from "./search-history.service";
import { SearchHistoryController } from "./search-history.controller";
import { SearchHistoryRepository } from "./search-history.repository";

@Module({
  imports: [DynamoModule],
  controllers: [SearchHistoryController],
  providers: [SearchHistoryService, SearchHistoryRepository],
})
export class SearchHistoryModule {}
