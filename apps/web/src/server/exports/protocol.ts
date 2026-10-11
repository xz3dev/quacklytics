import { z } from "zod";
export const exportRequest = z.discriminatedUnion("type", [
  z.object({ type: z.literal("export"), project: z.string() }),
  z.object({ type: z.literal("shutdown") }),
]);
export const exportResponse = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("export"),
    project: z.string(),
    error: z.string().nullable(),
  }),
  z.object({ type: z.literal("shutdown") }),
]);
