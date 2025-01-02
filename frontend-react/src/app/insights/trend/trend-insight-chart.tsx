// src/app/insights/trend/trend-insight-chart.tsx
import {useDuckDBQueries} from "@/services/duck-db-queries"
import {Card, CardContent, CardHeader, CardTitle,} from "@/components/ui/card"
import {TrendInsight} from "@/model/trend-insight.ts";
import {useProjectId} from "@/hooks/use-project-id";
import {renderQuery} from "@lib/renderQuery.tsx";
import {useMemo} from "react";
import {Query} from "@lib/queries.ts";

interface Props {
    insight: TrendInsight
}

export function TrendInsightChart({insight}: Props) {
    const projectId = useProjectId()

    // Create a query for each series
    const queries = useMemo(() =>
            insight?.series?.map((series, index) => ({
                uniqId: `trend-${insight.id}-${index}`,
                query: {
                    filters: [],
                    aggregations: [],
                    ...(series.query ?? {}),
                } satisfies Query,
                metadata: {
                    visualisation: series.visualisation,
                    name: series.name
                },
            })) ?? []
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

    function toObject(val: any) {
        return JSON.stringify(val, (key, value) =>
            typeof value === 'bigint'
                ? value.toString()
                : value // return everything else unchanged
        );
    }
    const renderChart = (query: any, index: number) => {
        return <div key={index}>{toObject(query)}</div>
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
                            (data) => renderChart(data, index),
                            index,
                        )
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
