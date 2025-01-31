import {createContext} from "react";
import {Insight} from "@/model/insight.ts";
import {TrendInsight} from "@/model/trend-insight.ts";
import {ValueInsight} from "@/model/value-insight.ts";

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



export const BaseInsightContext = createContext<{
    original?: Insight,
    updateWorkingCopy?: (insight: Insight) => void,
    isChanged: boolean,
    readOnly?: boolean
}>({
    isChanged: false,
})
