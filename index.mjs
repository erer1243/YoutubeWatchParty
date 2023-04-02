#!/usr/bin/env node
import { App, Stack } from "aws-cdk-lib";
import lambda from "aws-cdk-lib/aws-lambda";
import dynamodb from "aws-cdk-lib/aws-dynamodb";
import { WebSocketApi, WebSocketStage } from "@aws-cdk/aws-apigatewayv2-alpha";
import { WebSocketLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";

// The CloudFormation stack
const stack = new Stack(new App(), "YouTubeWatchParty");

// Lambda
const eventHandlerLambda = new lambda.Function(stack, "YTWP-event-handler-lambda", {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset("lambda.zip"),
});

// DynamoDB
const membershipTable = new dynamodb.Table(stack, "YTWP-party-membership-table", {
  partitionKey: { name: "party", type: dynamodb.AttributeType.STRING }
});
membershipTable.addGlobalSecondaryIndex({
  // Maybe this can be binary, since cids are passed as base64?
  partitionKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
  indexName: "connectionId"
});
membershipTable.grantReadWriteData(eventHandlerLambda);

// WebSocket API
const apiProps = () => ({ integration: new WebSocketLambdaIntegration("event_handler", eventHandlerLambda) });
const webSocketApi = new WebSocketApi(stack, "YTWP-api", {
  connectRouteOptions: apiProps(),
  disconnectRouteOptions: apiProps(),
  defaultRouteOptions: apiProps(),
});
webSocketApi.grantManageConnections(eventHandlerLambda);
new WebSocketStage(stack, "YTWP-api-stages", {
  webSocketApi,
  stageName: 'YTWP-main_stage',
  autoDeploy: true,
});
