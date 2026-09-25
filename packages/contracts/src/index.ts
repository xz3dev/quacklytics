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
const common = {
  id: z.number().int().positive(),
  name: z.string().max(200).optional(),
  favorite: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
};
export const insight = z.discriminatedUnion("type", [
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
]);
export type Insight = z.infer<typeof insight>;
export type InsightInput = Insight extends infer I
  ? I extends { id: number }
    ? Omit<I, "id">
    : never
  : never;
export const project = z.object({
  id: z.string(),
  name: z.string(),
  partition: z.string(),
  corsOrigins: z.array(z.string()),
});
export const dashboard = z.object({
  id: z.number(),
  name: z.string(),
  favorite: z.boolean(),
  home: z.boolean(),
  insights: z.array(insight),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export const apiKey = z.object({
  id: z.number(),
  createdAt: z.number(),
  project: z.string(),
  key: z.string(),
});
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
    config: { funnel: { duration: "P30D", steps: [] } },
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
} satisfies {
  [K in Insight["type"]]: Omit<Extract<Insight, { type: K }>, "id">;
};
