import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

// Helpers for interacting with DynamoDB
const db = new DynamoDBClient({ region: "us-east-1" });
const partiesTable = process.env["PARTIES_TABLE"];
const connectionsTable = process.env["CONNECTIONS_TABLE"];

const getItem = (table, keyName, key) => db.send(new GetItemCommand({
  TableName: table,
  ConsistentRead: true,
  Key: { [keyName]: { S: key } }
}));
const getParty = pid => getItem(partiesTable, "Party", pid);
const getConnectionParty = cid => getItem(connectionsTable, "ConnectionId", cid);

const updateItem = (table, keyName, key, expr, exprAttrs) => db.send(new UpdateItemCommand({
  TableName: table,
  Key: { [keyName]: { S: key } },
  UpdateExpression: expr,
  ExpressionAttributeValues: exprAttrs,
  ReturnValues: "NONE",
}));

// Helpers for sending messages to client connections
const api = new ApiGatewayManagementApiClient({ endpoint: process.env["API_MGMT_URL"] })
const send = (ConnectionId, Data) => {
  if (typeof (Data) !== "string") Data = JSON.stringify(Data);
  return api.send(new PostToConnectionCommand({ Data, ConnectionId }))
};

export const handler = async (event, _context) => {
  const { body, requestContext: { connectionId, eventType } } = event;
  console.log("eventType:", eventType);
  console.log("connectionId:", connectionId);
  console.log("body:", body);
  switch (eventType) {
    case "CONNECT": return await onConnect(connectionId);
    case "DISCONNECT": return await onDisconnect(connectionId);
    case "MESSAGE": return await onMessage(connectionId, body);
    default: return { statusCode: 400 };
  }
}

const onConnect = async cid => {
  return { statusCode: 200 };
}

const onDisconnect = async cid => {
  return { statusCode: 200 };
}

const onMessage = async (cid, body) => {
  if (body.includes("create")) {
    await createParty().then(pid => send(cid, pid));
  } else if (body.includes("get")) {
    const pid = body.split(" ")[1].trim();
    await getParty(pid).then(itm => send(cid, itm));
    await getConnectionParty(cid).then(itm => send(cid, itm));
  }
  return { statusCode: 200 };
}

const createParty = async cid => {
  // Generate a random party id
  const randomId = String(Math.trunc(Math.random() * 10000));
  await updateItem(partiesTable, "Party", randomId, "add Members :m", { ":m": { SS: [cid] } });
  await updateItem(connectionsTable, "ConnectionId", cid, "set Party = :p", { ":p": { S: randomId } });
  return randomId;
};

