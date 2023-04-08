import { App, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { WebSocketApi, WebSocketStage } from "@aws-cdk/aws-apigatewayv2-alpha";
import { WebSocketLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { LambdaToDynamoDB } from "@aws-solutions-constructs/aws-lambda-dynamodb";

const STACK_NAME = "YoutubeWatchParty";

const API_NAME = "YTWP-api";
const API_STAGES_NAME = "YTWP-api-stages";

const PARTIES_TABLE_NAME = "YTWP-parties-table";
const CONNECTIONS_TABLE_NAME = "YTWP-connections-table";

const LAMBDA_NAME = "YTWP-event-handler-lambda";

const BUCKET_NAME = "YTWP-website-bucket";
const BUCKET_DEPLOYMENT_NAME = "YTWP-bucket-deployment";
const API_URL_OBJECT_KEY = "api-url";

// The CloudFormation stack
const stack = new Stack(new App(), STACK_NAME);

// Lambda
const eventHandlerLambda = new Function(stack, LAMBDA_NAME, {
  runtime: Runtime.NODEJS_18_X,
  handler: "index.handler",
  code: Code.fromAsset("lambda.zip"),
  timeout: Duration.seconds(5),
  environment: {
    // Pass tables names to lambda as env vars
    ["PARTIES_TABLE"]: PARTIES_TABLE_NAME,
    ["CONNECTIONS_TABLE"]: CONNECTIONS_TABLE_NAME,
  }
});

// DynamoDB Tables
const partiesTableProps = {
  tableName: PARTIES_TABLE_NAME,
  partitionKey: { name: "id", type: AttributeType.STRING },
  removalPolicy: RemovalPolicy.DESTROY,
};
const connectionsTableProps = {
  tableName: CONNECTIONS_TABLE_NAME,
  partitionKey: { name: "id", type: AttributeType.STRING },
  removalPolicy: RemovalPolicy.DESTROY,
};

const partiesTable = new LambdaToDynamoDB(stack, PARTIES_TABLE_NAME, {
  dynamoTableProps: partiesTableProps,
  existingLambdaObj: eventHandlerLambda,
  tablePermissions: "ReadWrite"
});
const connectionsTable = new LambdaToDynamoDB(stack, CONNECTIONS_TABLE_NAME, {
  dynamoTableProps: connectionsTableProps,
  existingLambdaObj: eventHandlerLambda,
  existingVpc: partiesTable.vpc,
  tablePermissions: "ReadWrite"
})
void connectionsTable;

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

// S3 Bucket
const bucket = new Bucket(stack, BUCKET_NAME, {
  publicReadAccess: true,
  removalPolicy: RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});

const websiteSource = Source.asset("webpages");
const apiUrlSource = Source.data(API_URL_OBJECT_KEY, webSocketStage.url);
new BucketDeployment(stack, BUCKET_DEPLOYMENT_NAME, {
  sources: [websiteSource, apiUrlSource],
  destinationBucket: bucket
});
