import type { IngestDiagnostic } from "@quacklytics/contracts";

// Setup diagnostics are intentionally ephemeral; event authority remains
// SQLite. After a restart the next ingestion request repopulates them.
const RETENTION_MS = 30 * 60_000;
const latest = new Map<string, IngestDiagnostic>();
const rejected = new Map<string, { at: number; project: string | null }>();
let invalidKeyAt: number | null = null;

export function recordIngest(project: string, diagnostic: IngestDiagnostic) {
  latest.set(project, diagnostic);
}

/**
 * Preflights are refused before the ingestion key identifies a project, so
 * those origins are recorded without one and shown to every project.
 */
export function recordRejectedOrigin(origin: string, project: string | null) {
  if (!origin) return;
  rejected.delete(origin);
  rejected.set(origin, { at: Date.now(), project });
  if (rejected.size > 20) {
    const oldest = rejected.keys().next().value;
    if (oldest !== undefined) rejected.delete(oldest);
  }
}

export function recordInvalidKey() {
  invalidKeyAt = Date.now();
}

export function setupDiagnostics(project: string, allowed: string[]) {
  const since = Date.now() - RETENTION_MS;
  return {
    lastIngest: latest.get(project) ?? null,
    rejectedOrigins: [...rejected]
      .filter(
        ([origin, entry]) =>
          entry.at >= since &&
          (entry.project === null || entry.project === project) &&
          !allowed.includes(origin) &&
          !allowed.includes("*"),
      )
      .map(([origin, entry]) => ({ origin, at: entry.at }))
      .reverse(),
    invalidKeyAt:
      invalidKeyAt !== null && invalidKeyAt >= since ? invalidKeyAt : null,
  };
}
