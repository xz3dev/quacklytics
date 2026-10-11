import { defaultInsights } from "@quacklytics/contracts";
import { Insight } from "@/model/insights/insight.ts";

export type MapInsight = Extract<Insight, { type: "Map" }>;

export type MapInsightConfig = MapInsight["config"]["map"];

export const newMapInsight = defaultInsights.Map;
