import type { DashboardGridItem } from "./dashboard-layout";
import type { InsightInput } from "./index";

type Slot = Omit<DashboardGridItem, "insightId">;

/**
 * Web analytics built on what the browser SDK sends: `$pageview` events with
 * page, device and browser `$context`, plus the `$country` added at ingestion.
 */
export function websiteInsights(): { insight: InsightInput; slot: Slot }[] {
  const pageviews = [
    {
      field: { name: "event_type", type: "string" },
      operator: "=",
      value: "$pageview",
    },
  ] as const;
  const count = {
    function: "COUNT",
    field: { name: "id", type: "string" },
    alias: "result_value",
  } as const;
  const visitors = {
    ...count,
    field: { name: "person_id", type: "string" },
    distinct: true,
  } as const;
  const sessions = {
    ...visitors,
    field: { name: "session_id", type: "string" },
  } as const;
  type Aggregation = typeof count | typeof visitors | typeof sessions;
  const value = (name: string, aggregation: Aggregation): InsightInput => ({
    type: "Value",
    name,
    favorite: false,
    config: {
      value: {
        duration: "P30D",
        series: {
          query: { filters: [...pageviews], aggregations: [aggregation] },
        },
      },
    },
  });
  const breakdown = (
    name: string,
    field: string,
    aggregation: Aggregation,
    limit: number,
  ): InsightInput => ({
    type: "Breakdown",
    name,
    favorite: false,
    config: {
      breakdown: {
        duration: "P30D",
        dimension: { name: field, type: "string", isProperty: true },
        aggregation,
        filters: [...pageviews],
        limit,
      },
    },
  });
  return [
    {
      insight: value("Visitors", visitors),
      slot: { x: 0, y: 0, w: 4, h: 5 },
    },
    {
      insight: value("Pageviews", count),
      slot: { x: 4, y: 0, w: 4, h: 5 },
    },
    {
      insight: value("Sessions", sessions),
      slot: { x: 8, y: 0, w: 4, h: 5 },
    },
    {
      insight: {
        type: "Trend",
        name: "Visitors and pageviews",
        favorite: false,
        config: {
          trend: {
            duration: "P30D",
            timeBucket: "Daily",
            series: [
              {
                name: "Visitors",
                visualisation: "line",
                query: { filters: [...pageviews], aggregations: [visitors] },
              },
              {
                name: "Pageviews",
                visualisation: "line",
                query: { filters: [...pageviews], aggregations: [count] },
              },
            ],
          },
        },
      },
      slot: { x: 0, y: 5, w: 12, h: 6 },
    },
    {
      insight: {
        type: "Map",
        name: "Visitors by country",
        favorite: false,
        config: {
          map: {
            duration: "P30D",
            aggregation: visitors,
            filters: [...pageviews],
          },
        },
      },
      slot: { x: 0, y: 11, w: 7, h: 8 },
    },
    {
      insight: breakdown("Top pages", '$."$context".page.path', count, 10),
      slot: { x: 7, y: 11, w: 5, h: 8 },
    },
    {
      insight: breakdown(
        "Referrers",
        '$."$context".page.referrer',
        visitors,
        7,
      ),
      slot: { x: 0, y: 19, w: 6, h: 7 },
    },
    {
      // Events the site defines itself, without automatic pageviews and clicks.
      insight: {
        type: "Breakdown",
        name: "Custom events",
        favorite: false,
        config: {
          breakdown: {
            duration: "P30D",
            dimension: { name: "event_type", type: "string" },
            aggregation: count,
            filters: [
              {
                field: { name: "event_type", type: "string" },
                operator: "<>",
                value: "$pageview",
              },
              {
                field: { name: "event_type", type: "string" },
                operator: "<>",
                value: "$click",
              },
            ],
            limit: 7,
          },
        },
      },
      slot: { x: 6, y: 19, w: 6, h: 7 },
    },
    {
      insight: breakdown("Devices", '$."$context".deviceType', visitors, 5),
      slot: { x: 0, y: 26, w: 4, h: 6 },
    },
    {
      insight: breakdown("Browsers", '$."$context".browser', visitors, 5),
      slot: { x: 4, y: 26, w: 4, h: 6 },
    },
    {
      insight: breakdown("Operating systems", '$."$context".os', visitors, 5),
      slot: { x: 8, y: 26, w: 4, h: 6 },
    },
  ];
}
