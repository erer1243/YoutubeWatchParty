#!/usr/bin/env node
import { App, RemovalPolicy, Stack } from "aws-cdk-lib";
import lambda from "aws-cdk-lib/aws-lambda";
import dynamodb from "aws-cdk-lib/aws-dynamodb";
import { WebSocketApi, WebSocketStage } from "@aws-cdk/aws-apigatewayv2-alpha";
import { WebSocketLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";

const STACK_NAME = "YoutubeWatchParty";
const LAMBDA_NAME = "YTWP-event-handler-lambda";
const CONNECTIONS_TABLE_NAME = "YTWP-connections-table";
const PARTIES_TABLE_NAME = "YTWP-parties-table";
const API_NAME = "YTWP-api";
const API_STAGES_NAME = "YTWP-api-stages";

// The CloudFormation stack
const stack = new Stack(new App(), STACK_NAME);


// Lambda
const eventHandlerLambda = new lambda.Function(stack, LAMBDA_NAME, {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset("lambda.zip"),
});

// Pass tables names to lambda as env vars
eventHandlerLambda.addEnvironment("PARTIES_TABLE", PARTIES_TABLE_NAME);
eventHandlerLambda.addEnvironment("CONNECTIONS_TABLE", CONNECTIONS_TABLE_NAME);


// DynamoDB
const connectionsTable = new dynamodb.Table(stack, CONNECTIONS_TABLE_NAME, {
  partitionKey: { name: "ConnectionId", type: dynamodb.AttributeType.STRING },
  removalPolicy: RemovalPolicy.DESTROY,
});
connectionsTable.grantReadWriteData(eventHandlerLambda);

const partiesTable = new dynamodb.Table(stack, PARTIES_TABLE_NAME, {
  partitionKey: { name: "Party", type: dynamodb.AttributeType.STRING },
  removalPolicy: RemovalPolicy.DESTROY,
})
partiesTable.grantReadWriteData(eventHandlerLambda);


// WebSocket API
const apiProps = () => ({ integration: new WebSocketLambdaIntegration("event_handler", eventHandlerLambda) });
const webSocketApi = new WebSocketApi(stack, API_NAME, {
  connectRouteOptions: apiProps(),
  disconnectRouteOptions: apiProps(),
  defaultRouteOptions: apiProps(),
});
webSocketApi.grantManageConnections(eventHandlerLambda);

const webSocketStage = new WebSocketStage(stack, API_STAGES_NAME, {
  webSocketApi,
  stageName: "main",
  autoDeploy: true,
});

// Pass management url to lambda in an env var
eventHandlerLambda.addEnvironment("API_MGMT_URL", webSocketStage.callbackUrl);
