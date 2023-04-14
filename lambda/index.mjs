import { DeleteItemCommand, DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import assert from 'assert';

// Helper for sending messages to client connections
const api = new ApiGatewayManagementApiClient({ endpoint: process.env["API_MGMT_URL"] })
const send = (ConnectionId, Data) => {
  if (typeof (Data) !== "string") Data = JSON.stringify(Data);
  return api.send(new PostToConnectionCommand({ Data, ConnectionId }))
};

// Shorthand for getting timestamp
const now = () => new Date().getTime();

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
    seekLastUpdated: number = The time that the latest seek or pause update came in
                              Always the result of now()
                              Used to calculate the current seek time when it is requested
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

  db.getPartyInfo = async pid => {
    const resp = await getItem(partiesTable, pid);
    const item = unmarshall(resp.Item);

    const members = Array.from(item.members ?? []);
    const paused = item.paused ?? true;
    const video = item.video ?? "jNQXAC9IVRw";

    // Database times are in milliseconds, but client seek time must be sent in whole seconds
    const seekLastUpdated = item.seekLastUpdated;
    const prevSeek = item.seek ?? 0;
    const seek = prevSeek + (seekLastUpdated ? Math.floor((now() - prevSeek) / 1000) : 0);

    return { members, paused, video, seek };
  }

  db.getConnectionParty = async cid => {
    const resp = await getItem(connectionsTable, cid);
    const item = unmarshall(resp.Item);
    return item.pid;
  }

  db.joinParty = async (cid, pid) => {
    await updateItem("add members :m", { ":m": marshall(new Set([cid])) }, partiesTable, pid);
    await updateItem("set pid = :p", { ":p": marshall(pid) }, connectionsTable, cid);
  }

  db.leaveCurrentParty = async cid => {
    // Remove the user from the connections table
    const dResp = (await deleteItem(connectionsTable, cid));

    // Remove the user from their party's member list
    const dAttrs = unmarshall(dResp.Attributes);
    if (dAttrs.pid !== undefined) {
      const uResp = await updateItem("delete members :m", { ":m": marshall(new Set([cid])) }, partiesTable, pid);

      // If the party is empty, we can delete it
      const uAttrs = unmarshall(uResp.Attributes);
      const partyMembers = uAttrs?.members ?? [];
      if (partyMembers.length == 0) {
        await deleteItem(partiesTable, pid);
      }
    }
  }
}

export const handler = async (event, _context) => {
  const { body, requestContext: { connectionId: cid, eventType } } = event;
  console.log("eventType:", eventType);
  console.log("connectionId:", cid);
  console.log("body:", body);

  // "CONNECT" is ignored
  switch (eventType) {
    case "MESSAGE": 
      const msg = JSON.parse(body);
      assert(msg.action in actionHandlers);
      const out = await actionHandlers[msg.action](cid, msg);
      await send(cid, out);
      break;

    case "DISCONNECT": 
      await db.leaveCurrentParty(cid);
      break;
  }

  return { statusCode: 200 };
}

const actionHandlers = {
  join: async (cid, msg) => {
    const pid = msg.pid;
    assert(typeof pid === 'string');
    assert(pid.length > 0 && pid.length < 20);

    await db.joinParty(cid, pid);
    return await db.getPartyInfo(pid);
  },

  info: async () => {

  },

  paused: async paused => {

  },

  seek: async time => {

  },

  video: async vid => {

  },
}
