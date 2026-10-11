import type { Database } from "bun:sqlite";
import { parseJson } from "@quacklytics/contracts";
import { RequestError } from "../errors";
export const json = (value: unknown, status = 200) =>
  Response.json(value, { status });
export async function body(request: Request) {
  const reader = request.body?.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "",
    bytes = 0;
  if (reader) {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2_000_000) {
          await reader.cancel();
          throw new RequestError(413, "Request too large");
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } catch (error) {
      if (error instanceof TypeError)
        throw new RequestError(400, "Invalid UTF-8");
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
  return text ? parseJson(text) : {};
}
export interface ProjectRequest {
  request: Request;
  url: URL;
  db: Database;
  projectId: string;
  id: number | undefined;
  idText: string | undefined;
  action: string | undefined;
  segments: string[];
}
