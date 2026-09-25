import type {
  Insight as ContractInsight,
  InsightInput,
} from "@quacklytics/contracts";
export type Insight = ContractInsight;
export type InsightType = Insight["type"];
export type UsableInsight = Insight;
export type UsableInsightInput = InsightInput;
export type InsightConfig = Insight["config"];
