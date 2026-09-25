import { defaultInsights } from "@quacklytics/contracts";
import { Insight } from "@/model/insights/insight.ts";

export type RetentionInsight = Extract<Insight, { type: "Retention" }>;

export type RetentionInsightConfig = RetentionInsight["config"]["retention"];

export const newRetentionInsight = defaultInsights.Retention;
