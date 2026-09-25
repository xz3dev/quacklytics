import { z } from "zod";
import { storedEvent } from "@quacklytics/contracts";
export type AnalyticsEvent = z.infer<typeof storedEvent>;
export interface RawEventRow {
  id: string;
  event_type: string;
  person_id: string | null;
  session_id: string | null;
  timestamp: bigint;
  properties: string;
}
