import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";

export interface AppStackProps extends cdk.StackProps {
  table:      dynamodb.Table;
  repository: ecr.Repository;
  imageTag:   string;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { table, repository, imageTag } = props;

    // ----------------------------------------------------------------
    // VPC — public subnets only, no NAT gateway (learning / cost)
    // Tasks run with a public IP so they can reach ECR + DynamoDB
    // without needing a NAT or VPC endpoints
    // ----------------------------------------------------------------
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs:       2,
      natGateways:  0,
      subnetConfiguration: [
        {
          name:       "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask:   24,
        },
      ],
    });

    // ----------------------------------------------------------------
    // ECS Cluster
    // ----------------------------------------------------------------
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName:        "flight-search-history",
      containerInsights:  true,
    });

    // ----------------------------------------------------------------
    // IAM roles
    // ----------------------------------------------------------------

    // Execution role — used by ECS control plane to pull image + push logs
    const executionRole = new iam.Role(this, "TaskExecutionRole", {
      assumedBy:        new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies:  [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy",
        ),
      ],
    });

    // Task role — assumed by the running container, grants DynamoDB access
    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    table.grantReadWriteData(taskRole);

    // ----------------------------------------------------------------
    // CloudWatch log group
    // ----------------------------------------------------------------
    const logGroup = new logs.LogGroup(this, "ApiLogGroup", {
      logGroupName:  "/ecs/flight-search-history-api",
      retention:     logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ----------------------------------------------------------------
    // ALB + Fargate service (high-level pattern)
    // ----------------------------------------------------------------
    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "ApiService",
      {
        cluster,
        serviceName:    "flight-search-history-api",
        desiredCount:   1,
        cpu:            256,   // 0.25 vCPU
        memoryLimitMiB: 512,
        assignPublicIp: true,  // required when natGateways=0
        taskImageOptions: {
          image:          ecs.ContainerImage.fromEcrRepository(repository, imageTag),
          containerPort:  3000,
          executionRole,
          taskRole,
          logDriver: ecs.LogDrivers.awsLogs({
            logGroup,
            streamPrefix: "api",
          }),
          environment: {
            NODE_ENV:            "production",
            PORT:                "3000",
            DYNAMODB_REGION:     this.region,
            DYNAMODB_TABLE_NAME: table.tableName,
            SESSION_TTL_SECONDS: "604800",
          },
        },
        // ALB health check
        healthCheckGracePeriod: cdk.Duration.seconds(60),
      },
    );

    // Adjust ALB target group health check
    service.targetGroup.configureHealthCheck({
      path:                "/health",
      healthyHttpCodes:    "200",
      interval:            cdk.Duration.seconds(30),
      unhealthyThresholdCount: 3,
    });

    // ----------------------------------------------------------------
    // Autoscaling — scale on CPU utilisation
    // ----------------------------------------------------------------
    const scaling = service.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 4,
    });

    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown:  cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ----------------------------------------------------------------
    // Outputs
    // ----------------------------------------------------------------
    new cdk.CfnOutput(this, "ApiUrl", {
      value: `http://${service.loadBalancer.loadBalancerDnsName}`,
    });
  }
}
