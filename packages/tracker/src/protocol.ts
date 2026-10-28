import { z } from "zod";

export const SDK_VERSION = "0.4.0";
export const jsonProperties = z.record(z.string(), z.json());
export type EventProperties = z.infer<typeof jsonProperties>;
export type JsonValue = z.infer<ReturnType<typeof z.json>>;
const identity = z.string().min(1).max(300);
export const eventContext = z.object({
  sdk: z.object({
    name: z.literal("@quacklytics/client"),
    version: z.string(),
  }),
  page: z
    .object({
      url: z.string(),
      path: z.string(),
      title: z.string(),
      referrer: z.string(),
      pageViewId: z.uuid().optional(),
      previousUrl: z.string().optional(),
    })
    .optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
  deviceType: z.enum(["desktop", "mobile", "tablet"]).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  viewport: z.object({ width: z.number(), height: z.number() }).optional(),
});
export const sdkEvent = z
  .object({
    kind: z.literal("event"),
    id: z.uuid(),
    timestamp: z.iso.datetime({ offset: true }),
    eventType: z
      .string()
      .min(1)
      .max(200)
      .refine(
        (name) =>
          !name.startsWith("$") || name === "$pageview" || name === "$click",
        "Unknown reserved event",
      ),
    anonymousId: identity.optional(),
    userId: identity.optional(),
    sessionId: identity.optional(),
    /** Declined consent: the service derives a cookieless daily visitor and session. */
    anonymous: z.literal(true).optional(),
    properties: jsonProperties.refine(
      (value) => !("$context" in value),
      "Reserved property $context",
    ),
    context: eventContext,
  })
  .strict()
  .superRefine((event, ctx) => {
    if (
      event.anonymous &&
      (event.anonymousId || event.userId || event.sessionId)
    )
      ctx.addIssue({
        code: "custom",
        message: "Anonymous events cannot carry identities",
      });
    if (event.eventType === "$pageview" && !event.context.page?.pageViewId)
      ctx.addIssue({
        code: "custom",
        message: "Pageviews require page context and pageViewId",
      });
    if (
      event.eventType === "$click" &&
      typeof event.properties.tagName !== "string"
    )
      ctx.addIssue({ code: "custom", message: "Clicks require tagName" });
  });
export const identifyOperation = z
  .object({
    kind: z.literal("identify"),
    id: z.uuid(),
    timestamp: z.iso.datetime({ offset: true }),
    anonymousId: identity,
    userId: identity,
    traits: jsonProperties,
  })
  .strict();
export const sdkOperation = z.discriminatedUnion("kind", [
  sdkEvent,
  identifyOperation,
]);
export const sdkRequest = z
  .object({
    protocolVersion: z.literal(1),
    requestId: z.uuid(),
    operations: z.array(sdkOperation).min(1).max(1000),
  })
  .strict();
export const ingestAcknowledgment = z.object({
  committed: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  // Events for archived months are dropped; only backfill can add them.
  rejected: z.number().int().nonnegative().default(0),
  revision: z.number().int().nonnegative(),
});
export type SdkEvent = z.infer<typeof sdkEvent>;
export type SdkOperation = z.infer<typeof sdkOperation>;
