import {
  listInsights,
  getInsight,
  saveInsight,
  deleteInsight,
} from "../domain/insights";
import { RequestError } from "../errors";
import { json, body, type ProjectRequest } from "./shared";
export async function insightsHandler({
  request,
  db,
  id,
  idText,
  action,
}: ProjectRequest): Promise<Response> {
  if (action || (idText && id === undefined))
    throw new RequestError(404, "Route not found");
  if (request.method === "GET")
    return json(id === undefined ? listInsights(db) : getInsight(db, id));
  if (request.method === "DELETE" && id !== undefined) {
    deleteInsight(db, id);
    return json(null);
  }
  if (
    (request.method === "POST" && id === undefined) ||
    (request.method === "PUT" && id !== undefined)
  )
    return json(saveInsight(db, await body(request), id));
  throw new RequestError(405, "Method not allowed");
}
