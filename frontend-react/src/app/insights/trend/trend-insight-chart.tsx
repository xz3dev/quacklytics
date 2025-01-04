// src/app/insights/trend/trend-insight-chart.tsx
import {useDuckDBQueries} from "@/services/duck-db-queries"
import {Card, CardContent, CardHeader, CardTitle,} from "@/components/ui/card"
import {TrendAggregation, TrendInsight} from "@/model/trend-insight.ts";
import {useProjectId} from "@/hooks/use-project-id";
import {renderQuery} from "@lib/renderQuery.tsx";
import {useMemo} from "react";
import {mergeQueries} from "@lib/queries.ts";
import {AggregationResult} from "@lib/aggregations.ts";
import {buildGroupByFilter, buildRangeFilters} from "@/model/filters.ts";

interface Props {
    insight: TrendInsight
}

export function TrendInsightChart({insight}: Props) {
    const projectId = useProjectId()


    const dateRangeFilter = buildRangeFilters(insight.config.duration)
    const bucketFilter = buildGroupByFilter(insight.config.timeBucket)

    // Create a query for each series
    const queries = useMemo(() =>
            insight?.series?.map((series, index) => {

                const query = mergeQueries(
                    series.query ?? {},
                    {
                        filters: [...dateRangeFilter],
                        groupBy: [...bucketFilter.groupBy],
                        orderBy: [...bucketFilter.orderBy],
                    },
                )
                return ({
                    uniqId: `trend-${insight.id}-${index}`,
                    query,
                    metadata: {
                        visualisation: series.visualisation,
                        name: series.name
                    },
                });
            }) ?? []
        , [insight?.series, insight?.id])

    const results = useDuckDBQueries(projectId, queries)

    const seriesQueries = useMemo(
        () => results.map((result, index) => ({
            ...result,
            visualisation: queries[index].metadata.visualisation,
            name: queries[index].metadata.name
        })),
        [results, queries],
    )

    function renderSeries(data: AggregationResult<TrendAggregation[]>, index: number) {
        return data.map((row, i) => {
            return <div className="flex flex-row items-center gap-2" key={`${index}-${i}`}>
                <div>{i}:{row.result_value.toString()}</div>
            </div>
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{insight?.name}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col">
                    {seriesQueries.map((query, index) => (
                        renderQuery(
                            query,
                            (data) => renderSeries(data, index),
                            index,
                        )
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
