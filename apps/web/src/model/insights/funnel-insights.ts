import { defaultInsights } from "@quacklytics/contracts";
import { Insight } from "@/model/insights/insight.ts";

export type FunnelInsight = Extract<Insight, { type: "Funnel" }>;

export type FunnelInsightConfig = FunnelInsight["config"]["funnel"];

export type FunnelStep = NonNullable<FunnelInsightConfig["steps"]>[number];

export const newFunnelInsight = defaultInsights.Funnel;
