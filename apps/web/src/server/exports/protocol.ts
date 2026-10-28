import { z } from "zod";
/** Signed access to every event of a project, as get_dataset returns it to agents. */
export const dataset = z.object({
  setupSql: z.string(),
  eventCount: z.number(),
  availableStart: z.string().nullable(),
  availableEnd: z.string().nullable(),
  capturedAt: z.string(),
  expiresAt: z.string(),
});
export const exportRequest = z.discriminatedUnion("type", [
  z.object({ type: z.literal("export"), project: z.string() }),
  z.object({ type: z.literal("dataset"), project: z.string() }),
  z.object({ type: z.literal("shutdown") }),
]);
export const exportResponse = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("export"),
    project: z.string(),
    error: z.string().nullable(),
  }),
  // The worker logs why a dataset could not be provided.
  z.object({
    type: z.literal("dataset"),
    project: z.string(),
    dataset: dataset.nullable(),
  }),
  z.object({ type: z.literal("shutdown") }),
]);
