import { Memcached } from "@joshbetz/memcached";

// Docs: https://github.com/joshbetz/node-memcached#api
const mc = new Memcached(...process.env["CACHE_ENDPOINT"].split(":").reverse());
await mc.ready();

export const handler = async (event, _context) => {
  const s = x => JSON.stringify(x, null, 2);
  console.log("EVENT:\n", s(event));

  const cid = event.requestContext.connectionId;
  const body = event.body;

  switch (event.requestContext.eventType) {
    case "CONNECT": return await onConnect(cid);
    case "DISCONNECT": return await onDisconnect(cid);
    case "MESSAGE": return await onMessage(cid, body);
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
  return { statusCode: 200, body };
}
