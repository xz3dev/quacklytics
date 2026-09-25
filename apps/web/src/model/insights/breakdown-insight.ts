import { defaultInsights } from "@quacklytics/contracts";
import { Insight } from "@/model/insights/insight.ts";

export type BreakdownInsight = Extract<Insight, { type: "Breakdown" }>;

export type BreakdownInsightConfig = BreakdownInsight["config"]["breakdown"];

export const newBreakdownInsight = defaultInsights.Breakdown;
