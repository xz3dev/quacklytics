// src/app/insights/trend/trend-insight-chart.tsx
import {useDuckDBQueries} from "@/services/duck-db-queries"
import {TimeBucket, timeBucketData, TrendInsight, TrendSeriesType} from "@/model/trend-insight.ts";
import {useProjectId} from "@/hooks/use-project-id";
import {useMemo} from "react";
import {mergeQueries} from "@lib/queries.ts";
import {buildGroupByFilter, buildRangeFilters} from "@/model/filters.ts";
import {Spinner} from "@/components/spinner.tsx";
import {ChartContainer, ChartTooltip, ChartTooltipContent,} from "@/components/ui/chart"
import {Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis} from "recharts";
import {add, format} from "date-fns";
import {simpleHash} from "@lib/checksums.ts";
import {determineDateRange} from "@/model/InsightDateRange.ts";
import {UTCDate} from "@date-fns/utc";

interface Props {
    insight: TrendInsight
}

export function TrendInsightChart({insight}: Props) {
    const projectId = useProjectId()


    const dateRangeFilter = buildRangeFilters(insight.config.duration)
    const bucketFilter = buildGroupByFilter(insight.config.timeBucket, insight.config.duration)

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
        , [projectId, insight])

    const results = useDuckDBQueries(projectId, queries)

    const seriesQueries = results.map((result, index) => ({
        ...result,
        visualisation: queries[index].metadata.visualisation,
        name: queries[index].metadata.name
    }))

    const seriesData = seriesQueries
        .map((q, index) => ({
            rows: (q.data ?? []) as ResultRow[],
            visualization: q.visualisation,
            index,
        } satisfies Series))


    const chartData: ChartData[] = useMemo(
        () => buildChartData(seriesData, insight.config.timeBucket, determineDateRange(insight.config.duration)),
        [seriesData, insight.config],
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
                    left: 0,
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
                    tickLine={true}
                    axisLine={true}
                    tickCount={4}
                    width={30}
                />
                <ChartTooltip
                    cursor={true}
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


function buildChartData(
    data: Series[],
    bucket: TimeBucket,
    dateRange: {
        start: UTCDate
        end: UTCDate
    },
): ChartData[] {
    console.log(`building chart data for ${bucket}. ${data[0].rows.length}`)
    if (data.length === 0 || data.every(s => s.rows.length === 0)) return []
    const seriesCount = data.length

    const emptyValues: Record<number, number> = {}
    for (let i = 0; i < seriesCount; i++) {
        emptyValues[i] = 0
    }

    const stepSize = timeBucketData[bucket].interval
    const dataMap = new Map<number, Record<number, number>>()
    const steps: {
        key: number
    }[] = []

    const start = dateRange.start
    dataMap.set(start.getTime(), {...emptyValues})
    steps.push({
        key: start.getTime(),
    })

    let lastStep = start
    while (lastStep.getTime() < dateRange.end.getTime()) {
        const step = add(lastStep, stepSize)
        if (step.getTime() <= dateRange.end.getTime()) {
            dataMap.set(step.getTime(), {...emptyValues})
            steps.push({
                key: step.getTime(),
            })
        }
        lastStep = step
    }

    const getBucketKey = (date: UTCDate) => {
        // First step is handled specially since it doesn't have a previous step
        if (date.getTime() <= steps[0].key) {
            return steps[0].key
        }

        const bucket = steps.find(step =>
            step.key === date.getTime()
        )

        if (!bucket) {
            console.log(`No bucket found for ${format(date, 'yyyy-MM-dd HH:mm:ss')}`)
            // Don't default to first bucket, this might hide data issues
            return null
        }


        return bucket.key
    }

    // Fill in actual values
    data.forEach(({rows}, seriesIndex) => {
        rows.forEach(row => {
            const date = new UTCDate(row.trend_bucket)
            const key = getBucketKey(date)
            if (key && dataMap.has(key)) {
                const values = dataMap.get(key)!
                values[seriesIndex] = Number(row.result_value)
            } else {
                console.log(`No data bucket found for ${format(date, 'yyyy-MM-dd HH:mm:ss')}`)
            }
        })
    })

    return Array.from(dataMap.entries())
        .sort(([a], [b]) => a - b)  // Sort by timestamp
        .map(([date, values]) => ({
            date: new Date(date).toISOString(),  // Or format as needed
            values,
        }))
}
