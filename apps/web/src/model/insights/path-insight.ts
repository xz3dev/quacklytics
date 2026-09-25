import { defaultInsights } from "@quacklytics/contracts";
import { Insight } from "@/model/insights/insight.ts";

export type PathInsight = Extract<Insight, { type: "Path" }>;

export type PathDirection = "forward" | "backward";

export type PathInsightConfig = PathInsight["config"]["path"];

export const newPathInsight = defaultInsights.Path;
