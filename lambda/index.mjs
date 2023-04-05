import { DeleteItemCommand, DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

// Helpers for interacting with DynamoDB
let db = { /* populated in proceeding block */ };
{
  const dbClient = new DynamoDBClient({ region: "us-east-1" });
  const partiesTable = process.env["PARTIES_TABLE"];
  const connectionsTable = process.env["CONNECTIONS_TABLE"];

  const assertSend = (...args) => dbClient.send(...args).then(resp => {
    if (resp["$metadata"].httpStatusCode != 200)
      return Promise.reject(`Failed db access: ${resp}`);
    return resp;
  });
  const basicInputs = (TableName, S) => ({ TableName, Key: { ["id"]: { S } } });
  const getItem = (...args) => assertSend(new GetItemCommand({
    ...basicInputs(...args),
    ConsistentRead: true,
  }));
  const updateItem = (expr, exprAttrs, ...args) => assertSend(new UpdateItemCommand({
    ...basicInputs(...args),
    UpdateExpression: expr,
    ExpressionAttributeValues: exprAttrs,
    ReturnValues: "ALL_NEW", // Makes updateItem return the updated attributes
  }));
  const deleteItem = (...args) => assertSend(new DeleteItemCommand({
    ...basicInputs(...args),
    ReturnValues: "ALL_OLD", // Makes deleteItem return the deleted attributes
  }));

  db.getParty = pid => getItem(partiesTable, pid);
  db.getConnectionParty = cid => getItem(connectionsTable, cid);
  db.joinParty = async (cid, pid) => {
    await updateItem("add members :m", { ":m": { SS: [cid] } }, partiesTable, pid);
    await updateItem("set pid = :p", { ":p": { S: pid } }, connectionsTable, cid);
  }
  db.leaveCurrentParty = async cid => {
    // Remove the user from the connections table
    const dResp = (await deleteItem(connectionsTable, cid));

    // Remove the user from their party's member list
    const pid = dResp.Attributes.pid.S;
    const uResp = await updateItem("delete members :m", { ":m": { SS: [cid] } }, partiesTable, pid);

    // If the party is empty, we can delete it
    const partyMembers = uResp.Attributes?.members?.SS ?? [];
    if (partyMembers.length() == 0)
      await deleteItem(partiesTable, pid);
  }
}

// Helper for sending messages to client connections
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
    case "CONNECT": return { statusCode: 200 };
    case "DISCONNECT": return await onDisconnect(connectionId);
    case "MESSAGE": return await onMessage(connectionId, body);
    default: return { statusCode: 400 };
  }
}

const onDisconnect = async _cid => {
  return { statusCode: 200 };
}

const onMessage = async (cid, body) => {
  if (body.includes("create")) {
    const pid = String(Math.trunc(Math.random() * 10000));
    await send(cid, pid);
    await db.joinParty(cid, pid);
  } else if (body.includes("leave")) {
    await db.leaveCurrentParty(cid);
  } else if (body.includes("get")) {
    const pid = body.split(" ")[1].trim();
  } else {
    await send(cid, "default response");
  }
  return { statusCode: 200 };
}
