import type { InsightInput, filter } from "./index";
import type { z } from "zod";

export const eventNames = {
  trend: ["demo.trend.workspace_opened", "demo.trend.task_completed"],
  value: ["demo.value.invoice_paid"],
  breakdown: ["demo.breakdown.feature_used"],
  funnel: [
    "demo.funnel.pricing_viewed",
    "demo.funnel.trial_started",
    "demo.funnel.teammate_invited",
    "demo.funnel.subscription_started",
  ],
  retention: [
    "demo.retention.workspace_created",
    "demo.retention.workspace_active",
  ],
  path: [
    "demo.path.home",
    "demo.path.project_list",
    "demo.path.board",
    "demo.path.task_detail",
    "demo.path.reports",
    "demo.path.export",
    "demo.path.settings",
    "demo.path.help",
  ],
} as const;

function eventFilter(name: string): z.infer<typeof filter> {
  return {
    field: { name: "event_type", type: "string" },
    operator: "=",
    value: name,
  };
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
      name: "Daily workspace visits and completed tasks",
      favorite: true,
      type: "Trend",
      config: {
        trend: {
          duration,
          timeBucket: "Daily",
          series: [
            {
              name: "Workspace visits",
              visualisation: "line",
              query: queryFor(eventNames.trend[0]),
            },
            {
              name: "Tasks completed",
              visualisation: "bar",
              query: queryFor(eventNames.trend[1]),
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
              filters: [eventFilter(eventNames.value[0])],
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
          filters: [eventFilter(eventNames.breakdown[0])],
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
          steps: eventNames.funnel.map((name, order) => ({
            id: `orbit-step-${order}`,
            name:
              [
                "Viewed pricing",
                "Started trial",
                "Invited teammate",
                "Subscribed",
              ][order] ?? name,
            order,
            query: { filters: [eventFilter(name)] },
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
          activationQuery: { filters: [eventFilter(eventNames.retention[0])] },
          returnQuery: { filters: [eventFilter(eventNames.retention[1])] },
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
          anchorQuery: { filters: [eventFilter(eventNames.path[0])] },
          direction: "forward",
          stepField: { name: "event_type", type: "string" },
          maxSteps: 5,
          limit: 15,
        },
      },
    },
  ];
}
