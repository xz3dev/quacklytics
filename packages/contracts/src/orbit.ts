import type { InsightInput, filter } from "./index";
import type { z } from "zod";

/**
 * Orbit is the fictional project-management product the development seed
 * tracks with the browser and server SDKs: automatic `$pageview`/`$click`
 * events plus the custom events below.
 */
export const orbitEvents = {
  signedUp: "signed_up",
  workspaceCreated: "workspace_created",
  teammateInvited: "teammate_invited",
  taskCreated: "task_created",
  taskCompleted: "task_completed",
  featureUsed: "feature_used",
  subscriptionStarted: "subscription_started",
  invoicePaid: "invoice_paid",
} as const;
/** Page paths, as the SDK records them in `$context.page.path`. */
export const orbitPaths = { home: "/", pricing: "/pricing", app: "/app" };
export const pagePathField = {
  name: '$."$context".page.path',
  type: "string",
  isProperty: true,
} satisfies z.infer<typeof filter>["field"];

type Filter = z.infer<typeof filter>;
function eventFilter(name: string): Filter {
  return {
    field: { name: "event_type", type: "string" },
    operator: "=",
    value: name,
  };
}
function pageviewOf(path: string, operator: Filter["operator"] = "=") {
  return [
    eventFilter("$pageview"),
    { field: pagePathField, operator, value: path },
  ];
}
function queryFor(name: string) {
  return {
    filters: [eventFilter(name)],
    aggregations: [
      {
        function: "COUNT" as const,
        field: { name: "id", type: "string" },
        alias: "result_value",
      },
    ],
  };
}
export function orbitInsights(days: number): InsightInput[] {
  const duration = `P${days}D`;
  return [
    {
      name: "Daily pageviews and completed tasks",
      favorite: true,
      type: "Trend",
      config: {
        trend: {
          duration,
          timeBucket: "Daily",
          series: [
            {
              name: "Pageviews",
              visualisation: "line",
              query: queryFor("$pageview"),
            },
            {
              name: "Tasks completed",
              visualisation: "bar",
              query: queryFor(orbitEvents.taskCompleted),
            },
          ],
        },
      },
    },
    {
      name: "Revenue this month (EUR)",
      favorite: true,
      type: "Value",
      config: {
        value: {
          duration: "P30D",
          series: {
            query: {
              filters: [eventFilter(orbitEvents.invoicePaid)],
              aggregations: [
                {
                  function: "SUM",
                  field: { name: "amount", type: "number", isProperty: true },
                  alias: "result_value",
                },
              ],
            },
          },
        },
      },
    },
    {
      name: "Feature adoption",
      favorite: true,
      type: "Breakdown",
      config: {
        breakdown: {
          duration,
          dimension: { name: "feature", type: "string", isProperty: true },
          aggregation: {
            function: "COUNT",
            field: { name: "id", type: "string" },
            alias: "result_value",
          },
          filters: [eventFilter(orbitEvents.featureUsed)],
          limit: 10,
        },
      },
    },
    {
      name: "Pricing to paid subscription",
      favorite: true,
      type: "Funnel",
      config: {
        funnel: {
          duration,
          countingMode: "uniqueUsers",
          steps: [
            { name: "Viewed pricing", filters: pageviewOf(orbitPaths.pricing) },
            {
              name: "Signed up",
              filters: [eventFilter(orbitEvents.signedUp)],
            },
            {
              name: "Invited teammate",
              filters: [eventFilter(orbitEvents.teammateInvited)],
            },
            {
              name: "Subscribed",
              filters: [eventFilter(orbitEvents.subscriptionStarted)],
            },
          ].map((step, order) => ({
            id: `orbit-step-${order}`,
            name: step.name,
            order,
            query: { filters: step.filters },
          })),
        },
      },
    },
    {
      name: "Workspace retention by signup cohort",
      favorite: true,
      type: "Retention",
      config: {
        retention: {
          duration,
          cohortBucket: "Daily",
          activationQuery: {
            filters: [eventFilter(orbitEvents.workspaceCreated)],
          },
          returnQuery: { filters: pageviewOf(`${orbitPaths.app}%`, "LIKE") },
          maxPeriods: 14,
        },
      },
    },
    {
      name: "Journeys from the home page",
      favorite: true,
      type: "Path",
      config: {
        path: {
          duration,
          anchorQuery: { filters: pageviewOf(orbitPaths.home) },
          direction: "forward",
          stepField: pagePathField,
          maxSteps: 5,
          limit: 15,
        },
      },
    },
  ];
}
