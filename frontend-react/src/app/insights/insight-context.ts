import {createContext} from "react";
import {Insight} from "@/model/insight.ts";
import {TrendInsight} from "@/model/trend-insight.ts";

export const TrendInsightContext = createContext<{
    data?: TrendInsight,
    updateFn?: (fn: (insight: TrendInsight) => void) => void,
    update?: (insight: TrendInsight) => void,
}>({})


export const BaseInsightContext = createContext<{
    original?: Insight,
    updateWorkingCopy?: (insight: Insight) => void,
    isChanged: boolean,
}>({
    isChanged: false,
})
