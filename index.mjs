#!/usr/bin/env node
import { App, Stack } from "aws-cdk-lib";
import lambda from "aws-cdk-lib/aws-lambda";
import apigw from "@aws-cdk/aws-apigatewayv2-alpha";
import apigw_integrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import path from "path";

// The CloudFormation stack
const stack = new Stack(new App(), "YouTubeWatchParty");

// Lambdas
const code = name => lambda.Code.fromAsset(path.join(process.cwd(), name));
const testLam = new lambda.Function(stack, "YTWP-testfn", {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: "index.handler",
  code: code("testlambda")
});

// const fn_onConnect = new lambda.Function(stack, "onConnect")

// WebSocket API
const testlamApiProps = () => { return { integration: new apigw_integrations.WebSocketLambdaIntegration("testlam", testLam) } };
const webSocketApi = new apigw.WebSocketApi(stack, "YTWP-api", {
  connectRouteOptions: testlamApiProps(),
  disconnectRouteOptions: testlamApiProps(),
  defaultRouteOptions: testlamApiProps(),
})
webSocketApi.grantManageConnections(testLam);

new apigw.WebSocketStage(stack, "YTWP-api_stages", {
  webSocketApi,
  stageName: 'YTWP-main_stage',
  autoDeploy: true,
});
