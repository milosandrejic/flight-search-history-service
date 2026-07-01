import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apprunner from "aws-cdk-lib/aws-apprunner";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";

export class FlightSearchHistoryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tableName = this.node.tryGetContext("tableName") as string;
    const streamArn = this.node.tryGetContext("streamArn") as string;
    const imageTag  = this.node.tryGetContext("imageTag")  as string;

    // Import existing table — CDK doesn't own it, just references it
    const table = dynamodb.Table.fromTableAttributes(this, "Table", {
      tableName,
      tableStreamArn: streamArn,
    });

    // ----------------------------------------------------------------
    // Lambda stream processor
    // ----------------------------------------------------------------

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
        DYNAMODB_REGION:     this.region,
        DYNAMODB_TABLE_NAME: tableName,
        SESSION_TTL_SECONDS: "604800",
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    table.grantReadWriteData(streamProcessor);
    table.grantStreamRead(streamProcessor);

    streamProcessor.addEventSource(
      new lambdaEventSources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        bisectBatchOnError: true,          // on error: split batch in half to isolate poison record
        reportBatchItemFailures: true,     // only retry failed records, not the whole batch
        onFailure: new lambdaEventSources.SqsDlq(dlq),
        retryAttempts: 3,
      })
    );

    // ----------------------------------------------------------------
    // ECR — stores Docker images for the NestJS API
    // ----------------------------------------------------------------
    const repository = new ecr.Repository(this, "ApiRepository", {
      repositoryName: "flight-search-history-service",
      removalPolicy: cdk.RemovalPolicy.RETAIN,   // keep images if stack is destroyed
      lifecycleRules: [{ maxImageCount: 10 }],   // prune old images automatically
    });

    // ----------------------------------------------------------------
    // App Runner — runs the NestJS API from the ECR image
    // ----------------------------------------------------------------

    // Role that allows App Runner to pull images from ECR
    const ecrAccessRole = new iam.Role(this, "AppRunnerEcrAccessRole", {
      assumedBy: new iam.ServicePrincipal("build.apprunner.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSAppRunnerServicePolicyForECRAccess",
        ),
      ],
    });

    // Role assumed by the running container — grants DynamoDB access
    const instanceRole = new iam.Role(this, "AppRunnerInstanceRole", {
      assumedBy: new iam.ServicePrincipal("tasks.apprunner.amazonaws.com"),
    });

    table.grantReadWriteData(instanceRole);

    const apiService = new apprunner.CfnService(this, "ApiService", {
      serviceName: "flight-search-history-api",
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: ecrAccessRole.roleArn,
        },
        autoDeploymentsEnabled: false,   // deployments are triggered by CI/CD only
        imageRepository: {
          imageIdentifier: `${repository.repositoryUri}:${imageTag}`,
          imageRepositoryType: "ECR",
          imageConfiguration: {
            port: "3000",
            runtimeEnvironmentVariables: [
              { name: "NODE_ENV",            value: "production" },
              { name: "PORT",                value: "3000" },
              { name: "DYNAMODB_REGION",     value: this.region },
              { name: "DYNAMODB_TABLE_NAME", value: tableName },
              { name: "SESSION_TTL_SECONDS", value: "604800" },
            ],
          },
        },
      },
      instanceConfiguration: {
        instanceRoleArn: instanceRole.roleArn,
        cpu:    "0.25 vCPU",
        memory: "0.5 GB",
      },
      healthCheckConfiguration: {
        protocol: "HTTP",
        path:     "/health",
      },
    });

    // Outputs — printed after every cdk deploy
    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      value: repository.repositoryUri,
    });

    new cdk.CfnOutput(this, "AppRunnerServiceUrl", {
      value: `https://${apiService.attrServiceUrl}`,
    });
  }
}