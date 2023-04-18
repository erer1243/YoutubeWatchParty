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
    ReturnValues: "ALL_NEW", // Returns the updated attributes in .Attributes
  }));
  const deleteItem = (...args) => assertSend(new DeleteItemCommand({
    ...basicInputs(...args),
    ReturnValues: "ALL_OLD", // Return the deleted attributes in .Attributes
  }));

  db.getPartyInfo = async pid => {
    const resp = await getItem(partiesTable, pid);
    const item = unmarshall(resp.Item);

    const members = Array.from(item.members ?? []);
    const paused = item.paused ?? true;
    const video = item.video ?? "jNQXAC9IVRw";
    const seekLastUpdated = item.seekLastUpdated ?? now();
    let seek = item.seek ?? 0;

    if (!paused && seekLastUpdated) {
      const seekOffset = Math.floor((now() - seekLastUpdated) / 1000);
      seek += seekOffset;
    }

    if (item.seekLastUpdated === undefined)
      await db.setSeek(pid, 0);

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
    const dAttrs = unmarshall(dResp.Attributes);
    const pid = dAttrs.pid;

    if (pid !== undefined) {
      // Remove the user from their party's member list
      const uResp = await updateItem("delete members :m", { ":m": marshall(new Set([cid])) }, partiesTable, pid);
      const uAttrs = unmarshall(uResp.Attributes);
      const partyMembers = uAttrs?.members ?? [];

      // If the party is empty, we can delete it
      if (partyMembers.length == 0) await deleteItem(partiesTable, pid);
    }
  }

  db.setPaused = async (pid, paused) => {
    const { seek } = await db.getPartyInfo(pid);
    await updateItem(
      "set paused = :p, seek = :s, seekLastUpdated = :t",
      marshall({ ":p": paused, ":s": seek, ":t": now() }),
      partiesTable,
      pid,
    );
  }

  db.setSeek = (pid, seek) => updateItem(
    "set seek = :s, seekLastUpdated = :t",
    marshall({ ":s": seek, ":t": now() }),
    partiesTable,
    pid
  );

  db.setVideo = (pid, vid) => updateItem(
    "set video = :v, seek = :s, seekLastUpdated = :t",
    marshall({ ":v": vid, ":s": 0, ":t": now() }),
    partiesTable,
    pid
  )
}

export const handler = async (event, _context) => {
  const { body, requestContext: { connectionId: cid, eventType } } = event;
  console.log("eventType:", eventType);
  console.log("connectionId:", cid);
  console.log("body:", body);

  switch (eventType) {
    case "MESSAGE":
      const msg = JSON.parse(body);
      await actionHandlers[msg.action](cid, msg);
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
    const info = await db.getPartyInfo(pid);

    const out = { ...info, action: "info", timestamp: now() };
    await send(cid, out);
  },

  info: async (cid, msg) => {
    const pid = await db.getConnectionParty(cid);
    const info = await db.getPartyInfo(pid);

    const out = { ...msg, ...info, timestamp: now() };
    await send(cid, out);
  },

  paused: async (cid, msg) => {
    const paused = msg.paused;
    assert(typeof paused === "boolean");

    const pid = await db.getConnectionParty(cid);
    await db.setPaused(pid, paused);

    const out = { ...msg, timestamp: now() };
    await sendOtherPartyMembers(cid, pid, out);
  },

  seek: async (cid, msg) => {
    const seek = msg.seek;
    assert(typeof seek === "number");
    assert(Number.isInteger(seek));

    const pid = await db.getConnectionParty(cid);
    await db.setSeek(pid, seek);

    const out = { ...msg, timestamp: now() };
    await sendOtherPartyMembers(cid, pid, out);
  },

  video: async (cid, msg) => {
    const vid = msg.vid;
    assert(typeof vid === "string");
    assert(vid.match(/^[A-Za-z0-9_-]{11}$/));

    const pid = await db.getConnectionParty(cid);
    await db.setVideo(pid, vid);

    const out = { ...msg, timestamp: now() };
    await sendOtherPartyMembers(cid, pid, out);
  },
}

const sendOtherPartyMembers = async (cid, pid, msg) => {
  const members = (await db.getPartyInfo(pid)).members;
  const others = members.filter(m => m !== cid);
  for (const otherCid of others) {
    try {
      await send(otherCid, msg);
    } catch (e) {
      // ignore the error so that clients still receive this message
      console.error(`\n${otherCid}: ${e}`);
    }
  }
} 
