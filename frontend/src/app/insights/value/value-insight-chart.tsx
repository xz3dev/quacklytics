import {ValueInsight} from "@/model/value-insight.ts";
import {buildDateRangeFilters, buildRangeFilters} from "@/model/filters.ts";
import {useMemo} from "react";
import {mergeQueries} from "@lib/queries.ts";
import {useDuckDBQuery} from "@/services/duck-db-queries.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {simpleHash} from "@lib/checksums.ts";
import {Spinner} from "@/components/spinner.tsx";
import {determinePreviousDateRange} from "@/model/InsightDateRange.ts";
import {ArrowDownRight, ArrowUpRight} from "lucide-react";
import {isPresent} from "ts-is-present";
import {cn} from "@lib/utils/tailwind.ts";

type Props = {
    insight: ValueInsight
}

export function ValueInsightChart({insight}: Props) {
    const projectId = useProjectId()
    const dateRangeFilter = buildRangeFilters(insight.config.duration)
    const prevRange = determinePreviousDateRange(insight.config.duration)
    const previousDateRangeFilter = buildDateRangeFilters(prevRange.start, prevRange.end)

    const query = useMemo(() => {
        const series = insight?.series[0]
        const query = mergeQueries(
            series?.query ?? {},
            {
                filters: [...dateRangeFilter],
            },
        )
        const hash = simpleHash(JSON.stringify(series) + JSON.stringify(insight.config))
        return {projectId, query, hash}
    }, [projectId, insight])

    const queryPrev = useMemo(() => {
        const series = insight?.series[0]
        const query = mergeQueries(
            series?.query ?? {},
            {
                filters: [...previousDateRangeFilter],
            },
        )
        const hash = simpleHash(JSON.stringify(series) + JSON.stringify(insight.config))
        return {projectId, query, hash}
    }, [projectId, insight])


    const queryResult = useDuckDBQuery(query.projectId, `value-${query.hash}`, query.query)
    const queryResultPrev = useDuckDBQuery(queryPrev.projectId, `value-prev-${queryPrev.hash}`, queryPrev.query)

    if (queryResult.isPending || queryResult.isLoading || queryResultPrev.isPending || queryResultPrev.isLoading) return (
        <Spinner/>
    )

    if (queryResult.error || queryResultPrev.error) return (
        <div>Error: {queryResult.error?.message ?? queryResultPrev.error?.message}</div>
    )
    const data = queryResult.data
    const dataPrev = queryResultPrev.data

    const result = data[0] as ResultRow | undefined
    const resultPrev = dataPrev[0] as ResultRow | undefined

    const value = isPresent(result?.result_value) ? Number(result?.result_value ?? 0) : null
    const valuePrev = isPresent(resultPrev?.result_value) ? Number(resultPrev.result_value) : null

    const trend = (isPresent(value) && isPresent(valuePrev)) ? (value - valuePrev) : null

    // const trend =

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-col">
                <span
                    className="text-muted-foreground tracking-widest"
                    style={{'fontSize': '10px'}}
                >
                    CURRENT
                </span>
                <span className="text-3xl tracking-wider font-bold">
                {value}
            </span>
            </div>

            <div className="flex flex-row">
                <div className="flex flex-col">
                <span
                    className="text-muted-foreground/60 tracking-widest"
                    style={{'fontSize': '10px'}}
                >
                    PREVIOUS
                </span>
                    <div className="flex flex-row items-center gap-2">
                    <span className="text-xl tracking-wider font-bold text-muted-foreground">
                        {valuePrev}
                    </span>
                        {trend && <div
                            className={cn(
                                "flex items-center gap-x-0.5 text-sm text-muted-foreground/60",
                                trend > 0 ? "text-green-600" : "text-red-600"
                            )}>
                        <span>
                            {trend > 0 ? '+' : ''}
                            {trend}
                        </span>
                            {trend > 0 && <ArrowUpRight size="18"></ArrowUpRight>}
                            {trend < 0 && <ArrowDownRight size="18"></ArrowDownRight>}
                        </div>
                        }
                    </div>
                </div>
            </div>
        </div>)
}


interface ResultRow {
    trend_bucket: string
    result_value: BigInt
}
