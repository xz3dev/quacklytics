import { mcpResource } from "../auth";
import { disconnectAgent, listConnectedAgents } from "../domain/agents";
import { RequestError } from "../errors";
import { json } from "./shared";

/** Agent access for the signed-in user: the MCP endpoint and approved agents. */
export function agentsHandler(
  request: Request,
  userId: string,
  clientId: string | undefined,
): Response {
  if (request.method === "GET" && clientId === undefined)
    return json({
      endpoint: mcpResource ?? null,
      agents: listConnectedAgents(userId),
    });
  if (request.method === "DELETE" && clientId) {
    let id: string;
    try {
      id = decodeURIComponent(clientId);
    } catch {
      throw new RequestError(404, "Agent not found");
    }
    disconnectAgent(userId, id);
    return json(null);
  }
  throw new RequestError(405, "Method not allowed");
}
