// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

export const handler = async (event, _context) => {
  const s = x => JSON.stringify(x, null, 2);
  console.log("EVENT:\n", s(event));

  const cid = event.requestContext.connectionId;
  const body = event.body;

  const api = new ApiGatewayManagementApiClient({
    endpoint: "https://" + event.requestContext.domainName + "/" + event.requestContext.stage
  });
  const send = (ConnectionId, Data) => {
    const cmd = new PostToConnectionCommand({ Data, ConnectionId });
    return api.send(cmd);
  }

  switch (event.requestContext.eventType) {
    case "CONNECT": return await onConnect(cid);
    case "DISCONNECT": return await onDisconnect(cid);
    case "MESSAGE": return await onMessage(cid, send);
    default: return { statusCode: 400 };
  }
}

const onConnect = async cid => {
  return { statusCode: 200 };
}

const onDisconnect = async cid => {
  return { statusCode: 200 };
}

const onMessage = async (cid, send) => {
  for (let i = 0; i < 3; i++)
    await send(cid, "Test response");

  return { statusCode: 200 };
}
