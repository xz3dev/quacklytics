import { z } from "zod";
export const workerRequest = z.object({
  id: z.string(),
  url: z.string(),
  method: z.string(),
  headers: z.array(z.tuple([z.string(), z.string()])),
  body: z.string().optional(),
});
export const workerResponse = z.object({
  id: z.string(),
  status: z.number(),
  headers: z.array(z.tuple([z.string(), z.string()])),
  body: z.string(),
});
