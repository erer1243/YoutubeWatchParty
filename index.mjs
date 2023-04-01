#!/usr/bin/env node
import { App, Stack } from "aws-cdk-lib";
import lambda from "aws-cdk-lib/aws-lambda";
import { WebSocketApi, WebSocketStage } from "@aws-cdk/aws-apigatewayv2-alpha";
import { WebSocketLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { LambdaToElasticachememcached } from "@aws-solutions-constructs/aws-lambda-elasticachememcached";
import path from "path";

// The CloudFormation stack
const stack = new Stack(new App(), "YouTubeWatchParty");

// ElastiCache
process.env['overrideWarningsEnabled'] = "false"; // Disable warnings from @aws-solutions-constructs/core/lib/lambda-helper.js:101
const lambdaElasticache =
  new LambdaToElasticachememcached(stack, "YTWP-lambda-and-cache", {
    lambdaFunctionProps: {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(process.cwd(), "lambda.zip")),
    },
    cacheEndpointEnvironmentVariableName: "CACHE_ENDPOINT",
  });
const evHandlerLambda = lambdaElasticache.lambdaFunction;

// WebSocket API
const apiProps = () => ({ integration: new WebSocketLambdaIntegration("event_handler", evHandlerLambda) });
const webSocketApi = new WebSocketApi(stack, "YTWP-api", {
  connectRouteOptions: apiProps(),
  disconnectRouteOptions: apiProps(),
  defaultRouteOptions: apiProps(),
});
webSocketApi.grantManageConnections(evHandlerLambda);
new WebSocketStage(stack, "YTWP-api_stages", {
  webSocketApi,
  stageName: 'YTWP-main_stage',
  autoDeploy: true,
});
