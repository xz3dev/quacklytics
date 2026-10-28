import { RequestError } from "../errors";
import {
  createMcpToken,
  deleteMcpToken,
  listMcpTokens,
} from "../domain/mcp-tokens";
import { json, type ProjectRequest } from "./shared";
export function mcpTokensHandler({
  request,
  projectId,
  id,
  idText,
}: ProjectRequest): Response {
  if (idText && id === undefined)
    throw new RequestError(404, "Route not found");
  if (request.method === "GET" && id === undefined)
    return json(listMcpTokens(projectId));
  if (request.method === "POST" && id === undefined)
    return json(createMcpToken(projectId));
  if (request.method === "DELETE" && id !== undefined) {
    deleteMcpToken(projectId, id);
    return json(null);
  }
  throw new RequestError(405, "Method not allowed");
}
