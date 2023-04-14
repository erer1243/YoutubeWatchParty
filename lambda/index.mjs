import { DeleteItemCommand, DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";


/* Database Schema
   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
`connections` table:
  { id: string (primary key) = The `connectionId` (cid) of a websocket connection, as provided by API gateway
    pid: string = The id of the party that this connection currently belongs to
  }

`parties` table:
  { id: string (primary key) = The user-provided identifier of the party
    members: set<string> = The cids of users in this party
    paused: boolean = Whether the party's video is paused
    video: string = The id of the party's youtube video (youtube.com/watch?v=XXXXXXXXXX)
    seek: number = The seek time into the video (not updated in real time, only the last update)
    seek_timestamp: number = The time that the latest seek update came in. Given by `new Date().getTime()`.
                             Used to calculate the current seek time when it is requested.
  }
*/

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
  const basicInputs = (TableName, id) => ({ TableName, Key: marshall({ id }) });
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

  db.getParty = async pid => {
    const resp = await getItem(partiesTable, pid);
    const item = unmarshall(resp.Item);
    
    return item;
  }

  db.getConnectionParty = cid => getItem(connectionsTable, cid);

  db.joinParty = async (cid, pid) => {
    await updateItem("add members :m", { ":m": marshall(set(cid)) }, partiesTable, pid);
    await updateItem("set pid = :p", { ":p": marshall(pid) }, connectionsTable, cid);
  }

  db.leaveCurrentParty = async cid => {
    // Remove the user from the connections table
    const dResp = (await deleteItem(connectionsTable, cid));

    // Remove the user from their party's member list
    const pid = dResp.Attributes.pid.S;
    const uResp = await updateItem("delete members :m", { ":m": marshall(set(cid)) }, partiesTable, pid);

    // If the party is empty, we can delete it
    const partyMembers = uResp.Attributes?.members?.SS ?? [];
    if (partyMembers.length == 0)
      await deleteItem(partiesTable, pid);
  }

  const set = (...args) => new Set(args);
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

const onDisconnect = async cid => {
  await db.leaveCurrentParty(cid);
  return { statusCode: 200 };
}

const onMessage = async (cid, body) => {
  await db.joinParty(cid, "my party!");
  await send(cid, await db.getParty("my party!"));
  await db.leaveCurrentParty(cid);
  // interpretation of the body is described in the SCHEMA file
  // const message = JSON.parse(body);
  return { statusCode: 200 };
}

const actionHandlers = {
  join: pid => {
    assert(typeof pid === 'string');
    assert(pid.length > 0 && pid.length < 20);

    const timestamp = getTimestamp();

  },
  paused: paused => {

  },
  seek: time => {

  },
  video: vid => {

  },
  info: () => {

  }
}

const getTimestamp = () => new Date().getTime();
