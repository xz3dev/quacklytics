import { z } from "zod";
import { properties, parseJson } from "@quacklytics/contracts";
import { RequestError } from "../errors";
import {
  eventSelect,
  readCatalog,
  readAnalyticsStatus,
} from "../exports/catalog";
import { readSnapshot } from "../exports/snapshot";
import { requestExport } from "../exports/client";
import { json, type ProjectRequest } from "./shared";
export async function eventsHandler({
  request,
  url,
  db,
  projectId,
  idText,
  action,
}: ProjectRequest): Promise<Response> {
  if (idText === "snapshot") {
    if (request.method !== "GET") throw new RequestError(405, "Use GET");
    const body = JSON.stringify(readSnapshot(db, projectId));
    const gzip = (request.headers.get("accept-encoding") ?? "")
      .split(",")
      .some((entry) => {
        const [encoding, ...parameters] = entry.trim().split(";");
        const quality = parameters.find((parameter) =>
          parameter.trim().startsWith("q="),
        );
        return (
          encoding === "gzip" &&
          (quality === undefined || Number(quality.trim().slice(2)) > 0)
        );
      });
    return new Response(gzip ? Bun.gzipSync(body) : body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        Vary: "Accept-Encoding",
        ...(gzip ? { "Content-Encoding": "gzip" } : {}),
      },
    });
  }
  if (idText === "status") return json(readAnalyticsStatus(db, projectId));
  if (idText === "catalog") {
    if (action === "gen") {
      if (request.method !== "POST") throw new RequestError(405, "Use POST");
      await requestExport(projectId);
      return json(readCatalog(db, projectId));
    }
    return json(readCatalog(db, projectId));
  }
  if (idText) throw new RequestError(404, "Unknown event resource");
  const since = url.searchParams.get("timestamp__gt");
  const timestamp = since ? Date.parse(since) : -8640000000000000;
  if (!Number.isFinite(timestamp))
    throw new RequestError(400, "Invalid timestamp");
  const rows = z
    .array(
      z.object({
        id: z.string(),
        timestamp: z.number(),
        event_type: z.string(),
        session_id: z.string().nullable(),
        person_id: z.string().nullable(),
        properties: z.string(),
      }),
    )
    .parse(
      db
        .query(
          eventSelect +
            " WHERE e.timestamp>? ORDER BY e.timestamp,e.id LIMIT 10000",
        )
        .all(timestamp),
    );
  return json(
    rows.map((r) => ({
      id: r.id,
      timestamp: new Date(r.timestamp).toISOString(),
      eventType: r.event_type,
      sessionId: r.session_id,
      personId: r.person_id,
      properties: properties.parse(parseJson(r.properties)),
      personProperties: {},
    })),
  );
}
