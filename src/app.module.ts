import { Module } from "@nestjs/common";

import { AppConfigModule } from "./config/config.module";
import { DynamoModule } from "./common/dynamo/dynamo.module";

@Module({
  imports: [AppConfigModule, DynamoModule],
})
export class AppModule {}
