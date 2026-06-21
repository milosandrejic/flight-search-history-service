import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module";
import { AppConfigModule } from "./config/config.module";
import { DynamoModule } from "./common/dynamo/dynamo.module";

@Module({
  imports: [AppConfigModule, DynamoModule, HealthModule],
})
export class AppModule {}
