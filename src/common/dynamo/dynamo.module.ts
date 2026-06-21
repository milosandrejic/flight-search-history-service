import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const DYNAMO_CLIENT = "DYNAMO_CLIENT";

@Module({
  providers: [
    {
      provide: DYNAMO_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const region = configService.get<string>("DYNAMODB_REGION");

        const client = new DynamoDBClient({ region });

        return DynamoDBDocumentClient.from(client, {
          marshallOptions: {
            removeUndefinedValues: true,
          },
        });
      },
    },
  ],
  exports: [DYNAMO_CLIENT],
})
export class DynamoModule {}
