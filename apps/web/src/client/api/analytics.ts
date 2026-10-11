import { z } from "zod";
import {
  catalogAccess,
  analyticsStatus,
  analyticsSnapshot,
} from "@quacklytics/contracts";
import { http } from "./http";
export type FileMetadata = z.infer<typeof catalogAccess>;
export type AnalyticsStatus = z.infer<typeof analyticsStatus>;
export function getAnalyticsStatus(projectId: string, signal: AbortSignal) {
  return http.get(`${projectId}/events/status`, analyticsStatus, signal);
}

export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshot>;
export function getAnalyticsSnapshot(projectId: string, signal: AbortSignal) {
  return http.get(`${projectId}/events/snapshot`, analyticsSnapshot, signal);
}
