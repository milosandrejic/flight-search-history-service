import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module";
import { AppConfigModule } from "./config/config.module";
import { DynamoModule } from "./common/dynamo/dynamo.module";
import { SessionModule } from "./modules/session/session.module";
import { FollowUpModule } from "./modules/follow-up/follow-up.module";
import { SearchHistoryModule } from "./modules/search-history/search-history.module";

@Module({
  imports: [
    AppConfigModule,
    DynamoModule,
    HealthModule,
    SessionModule,
    SearchHistoryModule,
    FollowUpModule,
  ],
})
export class AppModule {}
