import "reflect-metadata";

import * as cdk from "aws-cdk-lib";

import { AppStack } from "../app-stack";
import { PersistentStack } from "../persistent-stack";

const app = new cdk.App();

const region   = app.node.tryGetContext("region")   as string;
const imageTag  = app.node.tryGetContext("imageTag")  as string;

const env = { region };

const persistent = new PersistentStack(app, "PersistentStack", { env });

new AppStack(app, "AppStack", {
  env,
  table:      persistent.table,
  repository: persistent.repository,
  imageTag,
});