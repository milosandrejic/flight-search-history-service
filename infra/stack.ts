import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";

export class FlightSearchHistoryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const streamArn = process.env.DYNAMODB_STREAM_ARN;

    if (!streamArn) {
      throw new Error("DYNAMODB_STREAM_ARN env var is required");
    }

    // Import existing table — CDK doesn't own it, just references it
    const table = dynamodb.Table.fromTableAttributes(this, "Table", {
      tableName: "FlightSearchHistory",
      tableStreamArn: streamArn,
    });

    // Dead Letter Queue — receives records that fail after all retries
    const dlq = new sqs.Queue(this, "StreamProcessorDlq", {
      queueName: "flight-search-stream-processor-dlq",
      retentionPeriod: cdk.Duration.days(14),
    });

    // Lambda — NodejsFunction uses esbuild to bundle + resolve @/ paths automatically
    const streamProcessor = new NodejsFunction(this, "StreamProcessor", {
      functionName: "flight-search-stream-processor",
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "../src/lambda/stream-handler.ts"),
      handler: "handler",
      bundling: {
        tsconfig: path.join(__dirname, "../tsconfig.json"),
        // NestJS lazily requires these optional modules — mark external so esbuild
        // skips them. They are never invoked since we don't use websockets/microservices.
        externalModules: [
          "@nestjs/websockets/socket-module",
          "@nestjs/microservices/microservices-module",
          "@nestjs/microservices",
        ],
      },
      environment: {
        DYNAMODB_REGION: "us-east-1",
        DYNAMODB_TABLE_NAME: "FlightSearchHistory",
        SESSION_TTL_SECONDS: "604800",
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    // Grant Lambda exactly what it needs — nothing more
    table.grantReadWriteData(streamProcessor);
    table.grantStreamRead(streamProcessor);

    // Wire the stream to the Lambda
    streamProcessor.addEventSource(
      new lambdaEventSources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        bisectBatchOnError: true,   // on error: split batch in half to isolate poison record
        onFailure: new lambdaEventSources.SqsDlq(dlq),
        retryAttempts: 3,
      })
    );
  }
}