import "reflect-metadata";

import * as cdk from "aws-cdk-lib";

import { FlightSearchHistoryStack } from "../stack";

const app = new cdk.App();

new FlightSearchHistoryStack(app, "FlightSearchHistoryStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
});