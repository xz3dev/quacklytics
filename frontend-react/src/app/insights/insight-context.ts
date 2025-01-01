import {createContext} from "react";
import {Insight} from "@/model/insight.ts";
import {TrendInsight} from "@/model/trend-insight.ts";

export const InsightContext = createContext<{
    data?: Insight,
    update?: (fn: (insight: Insight) => void) => void,
}>({})



export const TrendInsightContext = createContext<{
    data?: TrendInsight,
    update?: (fn: (insight: TrendInsight) => void) => void,
}>({})


