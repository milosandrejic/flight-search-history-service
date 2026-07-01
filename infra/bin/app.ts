import "reflect-metadata";

import * as cdk from "aws-cdk-lib";

import { FlightSearchHistoryStack } from "../stack";

const app = new cdk.App();

const region = app.node.tryGetContext("region") as string;

new FlightSearchHistoryStack(app, "FlightSearchHistoryStack", {
  // account resolved automatically from ~/.aws/credentials or OIDC role
  env: { region },
});