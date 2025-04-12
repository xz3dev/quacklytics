import {createContext} from "react";
import {Insight} from "@/model/insights/insight.ts";
import {TrendInsight} from "@/model/insights/trend-insight.ts";
import {ValueInsight} from "@/model/insights/value-insight.ts";
import {FunnelInsight} from "@/model/insights/funnel-insights.ts";

export const TrendInsightContext = createContext<{
    data?: TrendInsight,
    updateFn?: (fn: (insight: TrendInsight) => void) => void,
    update?: (insight: TrendInsight) => void,
}>({})

export const ValueInsightContext = createContext<{
    data?: ValueInsight,
    updateFn?: (fn: (insight: ValueInsight) => void) => void,
    update?: (insight: ValueInsight) => void,
}>({})

export const FunnelInsightContext = createContext<{
    data?: FunnelInsight,
    updateFn?: (fn: (insight: FunnelInsight) => void) => void,
    update?: (insight: FunnelInsight) => void,
}>({})



export const BaseInsightContext = createContext<{
    original?: Insight,
    updateWorkingCopy?: (insight: Insight) => void,
    isChanged: boolean,
    readOnly?: boolean
}>({
    isChanged: false,
})
