// src/app/insights/trend/trend-insight-chart.tsx
import {useDuckDBQueries} from "@/services/duck-db-queries"
import {TrendInsight, TrendSeriesType} from "@/model/trend-insight.ts";
import {useProjectId} from "@/hooks/use-project-id";
import {useMemo} from "react";
import {mergeQueries} from "@lib/queries.ts";
import {buildGroupByFilter, buildRangeFilters} from "@/model/filters.ts";
import {Spinner} from "@/components/spinner.tsx";
import {ChartContainer, ChartTooltip, ChartTooltipContent,} from "@/components/ui/chart"
import {Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis} from "recharts";
import {format} from "date-fns";
import {simpleHash} from "@lib/checksums.ts";

interface Props {
    insight: TrendInsight
}

export function TrendInsightChart({insight}: Props) {
    const projectId = useProjectId()


    const dateRangeFilter = buildRangeFilters(insight.config.duration)
    const bucketFilter = buildGroupByFilter(insight.config.timeBucket)

    // Create a query for each series
    const queries = useMemo(() =>
            insight?.series?.map((series) => {
                const query = mergeQueries(
                    series.query ?? {},
                    {
                        filters: [...dateRangeFilter],
                        groupBy: [...bucketFilter.groupBy],
                        orderBy: [...bucketFilter.orderBy],
                    },
                )
                const hash = simpleHash(JSON.stringify(series) + JSON.stringify(insight.config))
                return ({
                    uniqId: `trend-${hash}`,
                    query,
                    metadata: {
                        visualisation: series.visualisation,
                        name: series.name
                    },
                });
            }) ?? []
        , [insight])

    const results = useDuckDBQueries(projectId, queries)

    const seriesQueries = useMemo(
        () => results.map((result, index) => ({
            ...result,
            visualisation: queries[index].metadata.visualisation,
            name: queries[index].metadata.name
        })),
        [results, queries],
    )


    const seriesData = useMemo(() => {
        return seriesQueries
            .map((q, index) => ({
                rows: (q.data ?? []) as ResultRow[],
                visualization: q.visualisation,
                index,
            } satisfies Series))
    }, [seriesQueries])

    const chartData: ChartData[] = useMemo(
        () => buildChartData(seriesData),
        [seriesData],
    );

    if (seriesQueries.some(q => q.status === 'error')) {
        return <div>Error</div>
    }

    if (seriesQueries.some(q => q.status === 'pending')) {
        return <Spinner/>
    }
    return (
        <ChartContainer config={{}} className="aspect-auto w-full h-[400px]">
            <ComposedChart
                data={chartData}
                margin={{
                    left: 12,
                    right: 12,
                    top: 12,
                    bottom: 12,
                }}
            >
                <CartesianGrid vertical={false}/>
                <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    padding={{left: 0, right: 0}}
                    tickFormatter={(value) => format(new Date(value), 'yyyy-MM-dd')}
                />
                <YAxis
                    orientation="left"
                    tickLine={false}
                    axisLine={false}
                    tickCount={2}
                    width={5}
                />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot"/>}
                />
                {seriesQueries.map((q, index) => {
                    if (q.visualisation === 'bar') {
                        return (
                            <Bar
                                key={`series-${index}`}
                                dataKey={`values.${index}`}
                                name={seriesQueries[index].name}
                                fillOpacity={0.2}
                                stroke={`hsl(var(--chart-${(index + 1) % 5}))`}
                                strokeOpacity={0.8}
                                fill={`hsl(var(--chart-${(index + 1) % 5}))`}
                                isAnimationActive={false}
                            />
                        )
                    }
                    return (
                        q.visualisation === 'line' && <Line
                            key={`series-${index}`}
                            dataKey={`values.${index}`}
                            name={seriesQueries[index].name}
                            type="linear"
                            stroke={`hsl(var(--chart-${(index + 1) % 5}))`}
                            fillOpacity={0.4}
                            strokeWidth={2}
                            isAnimationActive={false}
                        />

                    );
                })}
            </ComposedChart>
        </ChartContainer>
    )
}


interface ResultRow {
    trend_bucket: string
    result_value: BigInt
}

interface Series {
    rows: ResultRow[]
    visualization: TrendSeriesType
    index: number
}

interface ChartData {
    date: string
    values: Record<number, number> // Map series index to their values
}


function buildChartData(data: Series[]): ChartData[] {
    const map = new Map<string, Record<number, number>>()
    const seriesCount = data.length

    // First pass: collect all dates and initialize with zeros for all series
    data.forEach(({rows}) => {
        rows.forEach(row => {
            if (!map.has(row.trend_bucket)) {
                const values: Record<number, number> = {}
                // Initialize all series indices with 0
                for (let i = 0; i < seriesCount; i++) {
                    values[i] = 0
                }
                map.set(row.trend_bucket, values)
            }
        })
    })

    // Second pass: fill in actual values
    data.forEach(({rows}, seriesIndex) => {
        rows.forEach(row => {
            map.get(row.trend_bucket)![seriesIndex] = Number(row.result_value)
        })
    })

    return Array.from(map.entries()).map(([date, values]) => ({
        date,
        values,
    }))
}
