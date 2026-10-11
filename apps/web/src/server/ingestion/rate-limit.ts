import { z } from "zod";

// Admission state is intentionally ephemeral; event authority remains SQLite.
const limit = z.coerce
  .number()
  .int()
  .positive()
  .parse(process.env.INGEST_REQUESTS_PER_MINUTE ?? 600);
const windows = new Map<string, { expires: number; requests: number }>();
export function ingestionRetryAfter(project: string): number | undefined {
  const now = Date.now();
  for (const [id, window] of windows)
    if (window.expires <= now) windows.delete(id);
  const window = windows.get(project) ?? { expires: now + 60_000, requests: 0 };
  windows.set(project, window);
  if (window.requests >= limit)
    return Math.max(1, Math.ceil((window.expires - now) / 1000));
  window.requests++;
  return undefined;
}
