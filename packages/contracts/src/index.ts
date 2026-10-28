export {
  sdkRequest,
  sdkEvent,
  sdkOperation,
  identifyOperation,
  ingestAcknowledgment,
} from "@quacklytics/client/protocol";
import { dashboardLayout } from "./dashboard-layout";
export * from "./dashboard-layout";
import { z } from "zod";

export const jsonValue = z.json();
export const properties = z.record(z.string(), jsonValue);
export type JsonValue = z.infer<typeof jsonValue>;
export const field = z.object({
  name: z.string().min(1),
  type: z.string(),
  isProperty: z.boolean().optional(),
  alias: z.string().optional(),
});
export const operator = z.enum(["=", ">", "<", ">=", "<=", "<>", "LIKE", "IN"]);
export const filter = z.object({
  field,
  operator,
  value: z.union([z.string(), z.number(), z.date()]),
});
export const aggregation = z.object({
  function: z.enum(["COUNT", "SUM", "AVG", "MIN", "MAX"]),
  field,
  alias: z.string().optional(),
  distinct: z.boolean().optional(),
});
export const query = z.object({
  select: z.array(field).optional(),
  filters: z.array(filter).optional(),
  groupBy: z.array(field).optional(),
  orderBy: z
    .array(z.object({ field, direction: z.enum(["ASC", "DESC"]) }))
    .optional(),
  aggregations: z.array(aggregation).optional(),
  limit: z.number().int().positive().max(100000).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export const bucket = z.enum(["Hourly", "Daily", "Weekly", "Monthly"]);
export const funnelCountingMode = z.enum([
  "uniqueUsers",
  "uniqueSessions",
  "eventCount",
]);
const common = {
  breakdownBy: field.optional(),
  name: z.string().max(200).optional(),
  favorite: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
};
export const insightInput = z.discriminatedUnion("type", [
  z.object({
    ...common,
    type: z.literal("Trend"),
    config: z.object({
      trend: z.object({
        duration: z.string(),
        timeBucket: bucket,
        series: z
          .array(
            z.object({
              name: z.string(),
              visualisation: z.enum(["line", "bar"]),
              query: query.optional(),
            }),
          )
          .optional(),
      }),
    }),
  }),
  z.object({
    ...common,
    type: z.literal("Value"),
    config: z.object({
      value: z.object({ duration: z.string(), series: z.object({ query }) }),
    }),
  }),
  z.object({
    ...common,
    type: z.literal("Funnel"),
    config: z.object({
      funnel: z.object({
        duration: z.string(),
        countingMode: funnelCountingMode,
        steps: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              order: z.number(),
              query,
            }),
          )
          .optional(),
      }),
    }),
  }),
  z.object({
    ...common,
    type: z.literal("Breakdown"),
    config: z.object({
      breakdown: z.object({
        duration: z.string(),
        dimension: field,
        aggregation,
        filters: z.array(filter).optional(),
        limit: z.number().int().positive().max(1000).optional(),
      }),
    }),
  }),
  z.object({
    ...common,
    type: z.literal("Retention"),
    config: z.object({
      retention: z.object({
        duration: z.string(),
        cohortBucket: bucket,
        activationQuery: query,
        returnQuery: query,
        maxPeriods: z.number().int().positive().max(366).optional(),
      }),
    }),
  }),
  z.object({
    ...common,
    type: z.literal("Path"),
    config: z.object({
      path: z.object({
        duration: z.string(),
        anchorQuery: query,
        direction: z.enum(["forward", "backward"]),
        stepField: field,
        maxSteps: z.number().int().positive().max(100).optional(),
        limit: z.number().int().positive().max(1000).optional(),
      }),
    }),
  }),
  z.object({
    ...common,
    type: z.literal("Map"),
    config: z.object({
      // Groups by the visitor country that ingestion adds as `$country`.
      map: z.object({
        duration: z.string(),
        aggregation,
        filters: z.array(filter).optional(),
      }),
    }),
  }),
]);
const insightId = { id: z.number().int().positive() };
export const insight = z.discriminatedUnion("type", [
  insightInput.options[0].extend(insightId),
  insightInput.options[1].extend(insightId),
  insightInput.options[2].extend(insightId),
  insightInput.options[3].extend(insightId),
  insightInput.options[4].extend(insightId),
  insightInput.options[5].extend(insightId),
  insightInput.options[6].extend(insightId),
]);
export type Insight = z.infer<typeof insight>;
export type InsightInput = z.infer<typeof insightInput>;
export const insightUpdate = insightInput;
export const projectEmoji = z
  .string()
  .trim()
  .max(64)
  .refine(
    (value) =>
      value === "" ||
      (z.string().emoji().safeParse(value).success &&
        [
          ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
            value,
          ),
        ].length === 1),
    "Choose a single emoji",
  );
export const project = z.object({
  id: z.string(),
  name: z.string(),
  emoji: projectEmoji.default(""),
  partition: z.string(),
  corsOrigins: z.array(z.string()),
});
export const dashboard = z.object({
  id: z.number(),
  name: z.string(),
  favorite: z.boolean(),
  home: z.boolean(),
  insights: z.array(insight),
  layout: dashboardLayout.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
// Commands accept references; responses expand them with the current insight records.
export const insightReference = z.object({ id: z.number().int().positive() });
export const dashboardInput = dashboard.omit({ id: true }).extend({
  favorite: z.boolean().default(false),
  home: z.boolean().default(false),
  insights: z.array(insightReference).default([]),
});
export const dashboardUpdate = dashboardInput;
export const dashboardCreate = dashboardInput;
export const dashboardMetadata = dashboard.omit({
  id: true,
  insights: true,
  layout: true,
});
export const dashboardMembership = z.object({
  insightId: z.number().int().positive(),
  position: z.number().int().nonnegative(),
  layout: dashboardLayout.element.optional(),
});
export const dashboardTemplate = z.enum([
  "web_analytics",
  "product_analytics",
  "chart_playground",
]);
export const dashboardTemplateInput = z.object({
  name: z.string().optional(),
  home: z.boolean().optional(),
});
export const dashboardInsightIds = z.object({
  insight_ids: z
    .array(z.number().int().positive())
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate insight"),
});
export const dashboardLayoutInput = z.object({ layout: dashboardLayout });
export const apiKey = z.object({
  id: z.number(),
  createdAt: z.number(),
  project: z.string(),
  key: z.string(),
});
// Read access for agents. Only the creation response carries the secret.
export const mcpToken = z.object({
  id: z.number(),
  prefix: z.string(),
  createdAt: z.number(),
});
export const createdMcpToken = mcpToken.extend({ token: z.string() });
export const user = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().optional(),
});
export const eventInput = z.object({
  id: z.uuid(),
  eventType: z.string().min(1).max(200),
  timestamp: z.iso.datetime({ offset: true }),
  sessionId: z.string().min(1).max(300).nullable().optional(),
  personId: z.string().min(1).max(300).nullable().optional(),
  properties: properties.default({}),
  personProperties: properties.default({}),
});
export type EventInput = z.infer<typeof eventInput>;
export const ingestRequest = z.object({
  requestId: z.uuid(),
  events: z.array(eventInput).min(1).max(1000),
  deferExport: z.boolean().default(false),
});
export const storedEvent = eventInput.extend({
  timestamp: z.coerce.date(),
  personId: z.string().nullable(),
  sessionId: z.string().nullable(),
});
export const catalogFile = z.object({
  name: z.string(),
  partition: z.string(),
  start: z.string(),
  end: z.string(),
  validUntil: z.string().nullable(),
  checksum: z.string(),
  filesize: z.number(),
  eventCount: z.number(),
  revision: z.number(),
});
export const catalogAccess = catalogFile.extend({
  url: z.url(),
  expiresAt: z.iso.datetime(),
});
export const analyticsStatus = z.object({
  files: catalogAccess.array(),
  committedRevision: z.number().int().nonnegative(),
  exportedRevision: z.number().int().nonnegative(),
  exportedAt: z.string().nullable(),
  pending: z.boolean(),
  exportError: z.string().nullable(),
});

// One response pins remote coverage and SQLite rows to the same read transaction.
export const analyticsRow = z.object({
  id: z.string(),
  timestamp: z.number().int(),
  event_type: z.string(),
  session_id: z.string().nullable(),
  person_id: z.string().nullable(),
  properties,
});
export const analyticsSnapshot = analyticsStatus.extend({
  dayStart: z.iso.datetime(),
  liveEvents: analyticsRow.array(),
  availableStart: z.iso.datetime().nullable(),
  availableEnd: z.iso.datetime().nullable(),
});

export const schemaResponse = z.record(
  z.string(),
  z.record(
    z.string(),
    z.object({
      id: z.number(),
      type: z.enum(["string", "number", "boolean", "json", "timestamp"]),
    }),
  ),
);
export const resultCell = z.union([
  z.string(),
  z.number(),
  z.bigint(),
  z.boolean(),
  z.null(),
  z.date(),
]);
export const resultRow = z.record(z.string(), resultCell);
export type ResultRow = z.infer<typeof resultRow>;
export function parseJson(text: string): unknown {
  return JSON.parse(text);
}

// Shared analytical result contracts. Decoding belongs at the SQL boundary.
export const numericResult = z
  .union([z.number(), z.bigint(), z.string()])
  .transform(Number)
  .pipe(z.number().finite());
export const analyticalTimestamp = z
  .union([z.string(), z.number(), z.date()])
  .transform((value) => new Date(value).toISOString());
export const trendRow = z.object({
  trend_bucket: analyticalTimestamp,
  result_value: numericResult,
});
export const breakdownRow = z.object({
  dimension_value: z.string(),
  result_value: numericResult,
});
export const retentionRow = z.object({
  cohort_start: analyticalTimestamp,
  period_index: numericResult,
  retained_count: numericResult,
});
export const pathRow = z.object({
  source_step: z.string(),
  target_step: z.string(),
  step_distance: numericResult,
  result_value: numericResult,
});
export const chartPoint = z.object({
  label: z.string(),
  value: z.number().finite(),
});
export type ChartPoint = z.infer<typeof chartPoint>;
export type TrendRow = z.infer<typeof trendRow>;
export type RetentionRow = z.infer<typeof retentionRow>;
export type PathRow = z.infer<typeof pathRow>;
export type BreakdownRow = z.infer<typeof breakdownRow>;
/** ISO 3166-1 alpha-2 visitor country, added to browser SDK events at ingestion. */
export const countryField = {
  name: "$country",
  type: "string",
  isProperty: true,
} satisfies z.infer<typeof field>;
export const defaultQuery = {
  filters: [],
  aggregations: [
    {
      function: "COUNT",
      field: { name: "id", type: "string" },
      alias: "result_value",
    },
  ],
} satisfies z.infer<typeof query>;
export const defaultInsights = {
  Trend: {
    type: "Trend",
    favorite: false,
    config: {
      trend: {
        duration: "P30D",
        timeBucket: "Daily",
        series: [
          { name: "Events", visualisation: "line", query: defaultQuery },
        ],
      },
    },
  },
  Value: {
    type: "Value",
    favorite: false,
    config: { value: { duration: "P30D", series: { query: defaultQuery } } },
  },
  Breakdown: {
    type: "Breakdown",
    favorite: false,
    config: {
      breakdown: {
        duration: "P30D",
        dimension: { name: "event_type", type: "string" },
        aggregation: {
          function: "COUNT",
          field: { name: "id", type: "string" },
          alias: "result_value",
        },
        filters: [],
        limit: 10,
      },
    },
  },
  Funnel: {
    type: "Funnel",
    favorite: false,
    config: {
      funnel: { duration: "P30D", countingMode: "uniqueUsers", steps: [] },
    },
  },
  Retention: {
    type: "Retention",
    favorite: false,
    config: {
      retention: {
        duration: "P30D",
        cohortBucket: "Daily",
        activationQuery: { filters: [] },
        returnQuery: { filters: [] },
        maxPeriods: 14,
      },
    },
  },
  Path: {
    type: "Path",
    favorite: false,
    config: {
      path: {
        duration: "P30D",
        anchorQuery: { filters: [] },
        direction: "forward",
        stepField: { name: "event_type", type: "string" },
        maxSteps: 5,
        limit: 10,
      },
    },
  },
  Map: {
    type: "Map",
    favorite: false,
    config: {
      map: {
        duration: "P30D",
        aggregation: {
          function: "COUNT",
          field: { name: "person_id", type: "string" },
          alias: "result_value",
          distinct: true,
        },
        filters: [],
      },
    },
  },
} satisfies {
  [K in Insight["type"]]: Omit<Extract<Insight, { type: K }>, "id">;
};
/**
 * Whether the server sees real client addresses. `direct` and `ok` are healthy;
 * the rest mean visitors would be attributed to a proxy.
 */
export const proxyCheck = z.object({
  status: z.enum(["direct", "ok", "untrusted", "partial", "missing-header"]),
  clientIp: z.string(),
  socketIp: z.string(),
  forwardedFor: z.string().nullable(),
  trustedProxies: z.string().nullable(),
  /** Value to set `TRUSTED_PROXIES` to, when a change would fix the setup. */
  suggestion: z.string().nullable(),
});
export type ProxyCheck = z.infer<typeof proxyCheck>;
/** The most recent accepted ingestion request, as the server received it. */
export const ingestDiagnostic = z.object({
  receivedAt: z.number(),
  origin: z.string().nullable(),
  /** `sdk` for the versioned client protocol, `http` for raw events. */
  client: z.enum(["sdk", "http"]),
  committed: z.number(),
  duplicates: z.number(),
  rejected: z.number(),
  proxy: proxyCheck,
});
export type IngestDiagnostic = z.infer<typeof ingestDiagnostic>;
export const projectSetup = z.object({
  latestEvent: z
    .object({
      id: z.string(),
      eventType: z.string(),
      timestamp: z.number(),
      sessionId: z.string().nullable(),
      personId: z.string().nullable(),
      sdk: z.object({ name: z.string(), version: z.string() }).nullable(),
    })
    .nullable(),
  lastIngest: ingestDiagnostic.nullable(),
  /** Recent browser origins refused by ingestion, newest first. */
  rejectedOrigins: z.array(z.object({ origin: z.string(), at: z.number() })),
  /** When a request last carried an ingestion key that matches no project. */
  invalidKeyAt: z.number().nullable(),
});
export type ProjectSetup = z.infer<typeof projectSetup>;
