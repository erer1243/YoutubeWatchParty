import { DeleteItemCommand, DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

// Helpers for interacting with DynamoDB
let db = { /* populated in proceeding block */ };
{
  const dbClient = new DynamoDBClient({ region: "us-east-1" });
  const partiesTable = process.env["PARTIES_TABLE"];
  const connectionsTable = process.env["CONNECTIONS_TABLE"];

  const basicInputs = (table, keyName, key) => ({
    TableName: table,
    Key: { [keyName]: { S: key } },
  });

  const getItem = (table, keyName, key) => dbClient.send(new GetItemCommand({
    ...basicInputs(table, keyName, key),
    ConsistentRead: true,
  }));

  const updateItem = (table, keyName, key, expr, exprAttrs) => dbClient.send(new UpdateItemCommand({
    ...basicInputs(table, keyName, key),
    UpdateExpression: expr,
    ExpressionAttributeValues: exprAttrs,
    ReturnValues: "ALL_NEW", // Makes updateItem return the complete, updated item
  }));

  const deleteItem = (table, keyName, key, cond) => dbClient.send(new DeleteItemCommand({
    ...basicInputs(table, keyName, key),
    ConditionExpression: cond,
  }));

  db.getParty = pid => getItem(partiesTable, "Party", pid);
  db.getConnectionParty = cid => getItem(connectionsTable, "ConnectionId", cid);

  db.joinParty = async (cid, pid) => {
    await updateItem(partiesTable, "Party", pid, "add Members :m", { ":m": { SS: [cid] } });
    await updateItem(connectionsTable, "ConnectionId", cid, "set Party = :p", { ":p": { S: pid } });
  }
  db.leaveParty = async (cid, pid) => {

  }
  db.deletePartyIfEmpty = pid => deleteItem(partiesTable, "Party", )
}

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
    await createParty(cid).then(pid => send(cid, pid));
  } else if (body.includes("get")) {
    const pid = body.split(" ")[1].trim();
    const party = (await db.getParty(pid))["Item"] ?? {};
    const conn = (await db.getConnectionParty(cid))["Item"] ?? {};
    await send(cid, { party, conn });
  } else {
    await send(cid, "default response");
  }
  return { statusCode: 200 };
}

const createParty = async cid => {
  // Generate a random party id
  const randomId = String(Math.trunc(Math.random() * 10000));
  return randomId;
};

const leaveParty = async cid => {

}

