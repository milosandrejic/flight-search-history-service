import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";

export class PersistentStack extends cdk.Stack {
  // Exposed to AppStack via cross-stack references
  public readonly table: dynamodb.Table;
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ----------------------------------------------------------------
    // DynamoDB — CDK owns the table (no more hardcoded stream ARNs)
    // ----------------------------------------------------------------
    this.table = new dynamodb.Table(this, "Table", {
      tableName: "FlightSearchHistory",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey:      { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      stream:       dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      timeToLiveAttribute: "expiresAt",
      // DESTROY so `make destroy` fully tears down the learning environment
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI1 — user-scoped lookups (user's sessions, user's recent searches)
    this.table.addGlobalSecondaryIndex({
      indexName:            "GSI1",
      partitionKey:         { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey:              { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType:       dynamodb.ProjectionType.ALL,
    });

    // GSI2 — session-scoped search collection (continue a session)
    this.table.addGlobalSecondaryIndex({
      indexName:            "GSI2",
      partitionKey:         { name: "GSI2PK", type: dynamodb.AttributeType.STRING },
      sortKey:              { name: "GSI2SK", type: dynamodb.AttributeType.STRING },
      projectionType:       dynamodb.ProjectionType.ALL,
    });

    // ----------------------------------------------------------------
    // ECR — must be in this stack so AppStack can reference the image
    //        before Fargate is created
    // ----------------------------------------------------------------
    this.repository = new ecr.Repository(this, "ApiRepository", {
      repositoryName: "flight-search-history-service",
      removalPolicy:  cdk.RemovalPolicy.DESTROY,
      emptyOnDelete:  true,                          // delete images on cdk destroy
      lifecycleRules: [{ maxImageCount: 10 }],
    });

    // ----------------------------------------------------------------
    // Lambda stream processor — lives with the table (same lifecycle)
    // ----------------------------------------------------------------
    const dlq = new sqs.Queue(this, "StreamProcessorDlq", {
      queueName:       "flight-search-stream-processor-dlq",
      retentionPeriod: cdk.Duration.days(14),
    });

    const streamProcessor = new NodejsFunction(this, "StreamProcessor", {
      functionName: "flight-search-stream-processor",
      runtime:      lambda.Runtime.NODEJS_22_X,
      entry:        path.join(__dirname, "../src/lambda/stream-handler.ts"),
      handler:      "handler",
      bundling: {
        tsconfig: path.join(__dirname, "../tsconfig.json"),
        externalModules: [
          "@nestjs/websockets/socket-module",
          "@nestjs/microservices/microservices-module",
          "@nestjs/microservices",
        ],
      },
      environment: {
        DYNAMODB_REGION:     this.region,
        DYNAMODB_TABLE_NAME: this.table.tableName,
        SESSION_TTL_SECONDS: "604800",
      },
      timeout:    cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.table.grantReadWriteData(streamProcessor);
    this.table.grantStreamRead(streamProcessor);

    streamProcessor.addEventSource(
      new lambdaEventSources.DynamoEventSource(this.table, {
        startingPosition:      lambda.StartingPosition.LATEST,
        batchSize:             10,
        bisectBatchOnError:    true,
        reportBatchItemFailures: true,
        onFailure:             new lambdaEventSources.SqsDlq(dlq),
        retryAttempts:         3,
      }),
    );

    // Outputs
    new cdk.CfnOutput(this, "TableName", { value: this.table.tableName });
    new cdk.CfnOutput(this, "EcrRepositoryUri", { value: this.repository.repositoryUri });
  }
}
