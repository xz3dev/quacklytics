import { createContext, type ReactNode } from "react";
import { Insight } from "@/model/insights/insight.ts";
import { TrendInsight } from "@/model/insights/trend-insight.ts";
import { ValueInsight } from "@/model/insights/value-insight.ts";
import { FunnelInsight } from "@/model/insights/funnel-insights.ts";
import { BreakdownInsight } from "@/model/insights/breakdown-insight.ts";
import { RetentionInsight } from "@/model/insights/retention-insight.ts";
import { PathInsight } from "@/model/insights/path-insight.ts";
import { MapInsight } from "@/model/insights/map-insight.ts";

export const TrendInsightContext = createContext<{
  data?: TrendInsight;
  updateFn?: (fn: (insight: TrendInsight) => void) => void;
  update?: (insight: TrendInsight) => void;
}>({});

export const ValueInsightContext = createContext<{
  data?: ValueInsight;
  updateFn?: (fn: (insight: ValueInsight) => void) => void;
  update?: (insight: ValueInsight) => void;
}>({});

export const FunnelInsightContext = createContext<{
  data?: FunnelInsight;
  updateFn?: (fn: (insight: FunnelInsight) => void) => void;
  update?: (insight: FunnelInsight) => void;
}>({});

export const BreakdownInsightContext = createContext<{
  data?: BreakdownInsight;
  updateFn?: (fn: (insight: BreakdownInsight) => void) => void;
  update?: (insight: BreakdownInsight) => void;
}>({});

export const RetentionInsightContext = createContext<{
  data?: RetentionInsight;
  updateFn?: (fn: (insight: RetentionInsight) => void) => void;
  update?: (insight: RetentionInsight) => void;
}>({});

export const PathInsightContext = createContext<{
  data?: PathInsight;
  updateFn?: (fn: (insight: PathInsight) => void) => void;
  update?: (insight: PathInsight) => void;
}>({});

export const MapInsightContext = createContext<{
  data?: MapInsight;
  updateFn?: (fn: (insight: MapInsight) => void) => void;
  update?: (insight: MapInsight) => void;
}>({});

export const BaseInsightContext = createContext<{
  chartControls?: ReactNode;
  original?: Insight;
  updateWorkingCopy?: (insight: Insight) => void;
  isChanged: boolean;
  readOnly?: boolean;
}>({
  isChanged: false,
});
