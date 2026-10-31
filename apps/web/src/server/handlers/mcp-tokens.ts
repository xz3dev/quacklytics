import { RequestError } from "../errors";
import {
  createMcpToken,
  deleteMcpToken,
  listMcpTokens,
  revealMcpToken,
} from "../domain/mcp-tokens";
import { json } from "./shared";
export function mcpTokensHandler(
  request: Request,
  userId: string,
  idText: string | undefined,
): Response {
  const id = idText && /^\d+$/.test(idText) ? Number(idText) : undefined;
  if (idText && id === undefined)
    throw new RequestError(404, "Route not found");
  if (request.method === "GET")
    return json(
      id === undefined ? listMcpTokens(userId) : revealMcpToken(userId, id),
    );
  if (request.method === "POST" && id === undefined)
    return json(createMcpToken(userId));
  if (request.method === "DELETE" && id !== undefined) {
    deleteMcpToken(userId, id);
    return json(null);
  }
  throw new RequestError(405, "Method not allowed");
}
