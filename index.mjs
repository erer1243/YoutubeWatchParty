import { App, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { WebSocketApi, WebSocketStage } from "@aws-cdk/aws-apigatewayv2-alpha";
import { WebSocketLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { LambdaToDynamoDB } from "@aws-solutions-constructs/aws-lambda-dynamodb";
import { Distribution, OriginAccessIdentity } from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { readFileSync } from 'fs';

let {
  STACK_NAME,
  API_NAME,
  API_STAGES_NAME,
  PARTIES_TABLE_NAME,
  CONNECTIONS_TABLE_NAME,
  LAMBDA_NAME,
  BUCKET_NAME,
  BUCKET_DEPLOYMENT_NAME,
  BUCKET_ID,
  API_URL_OBJECT_KEY,
  DISTRIBUTION_NAME,
  ORIGIN_ACCESS_IDENTITY_NAME
} = JSON.parse(readFileSync("names.json"));

// The CloudFormation stack
const stack = new Stack(new App(), STACK_NAME, { description: "Youtube Watch Party - Team 9" });

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
// Schemas described at the top of lambda/index.mjs
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
  removalPolicy: RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
  bucketName: BUCKET_ID,
});

const websiteSource = Source.asset("webpages");
const apiUrlSource = Source.data(API_URL_OBJECT_KEY, webSocketStage.url);
new BucketDeployment(stack, BUCKET_DEPLOYMENT_NAME, {
  sources: [websiteSource, apiUrlSource],
  destinationBucket: bucket
});

// CloudFront Distribution
const originAccessIdentity = new OriginAccessIdentity(stack, ORIGIN_ACCESS_IDENTITY_NAME);
bucket.grantRead(originAccessIdentity);

const distribution = new Distribution(stack, DISTRIBUTION_NAME, {
  defaultRootObject: "index.html",
  defaultBehavior: {
    origin: new S3Origin(bucket, { originAccessIdentity })
  }
})

void distribution;
