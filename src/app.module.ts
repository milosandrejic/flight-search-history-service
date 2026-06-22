import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module";
import { AppConfigModule } from "./config/config.module";
import { DynamoModule } from "./common/dynamo/dynamo.module";
import { SessionModule } from "./modules/session/session.module";
import { SearchHistoryModule } from "./modules/search-history/search-history.module";

@Module({
  imports: [
    AppConfigModule,
    DynamoModule,
    HealthModule,
    SessionModule,
    SearchHistoryModule
  ],
})
export class AppModule {}
