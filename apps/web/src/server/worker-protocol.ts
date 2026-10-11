import { z } from "zod";
const httpRequest = z.object({
  type: z.literal("request"),
  id: z.string(),
  url: z.string(),
  method: z.string(),
  headers: z.array(z.tuple([z.string(), z.string()])),
  body: z.string().optional(),
});
const httpResponse = z.object({
  type: z.literal("response"),
  id: z.string(),
  status: z.number(),
  headers: z.array(z.tuple([z.string(), z.string()])),
  body: z.union([z.string(), z.instanceof(Uint8Array)]),
});

const shutdown = z.object({ type: z.literal("shutdown") });
export const workerRequest = z.discriminatedUnion("type", [
  httpRequest,
  shutdown,
]);
export const workerResponse = z.discriminatedUnion("type", [
  httpResponse,
  shutdown,
]);
