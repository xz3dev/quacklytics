import { defaultInsights } from "@quacklytics/contracts";
import { Insight } from "@/model/insights/insight.ts";
import { Query } from "@lib/trend-queries.ts";

export type ValueInsight = Extract<Insight, { type: "Value" }>;

export type ValueInsightConfig = ValueInsight["config"]["value"];

export interface ValueSeries {
  query: Query;
}

export const newValueInsight = defaultInsights.Value;
