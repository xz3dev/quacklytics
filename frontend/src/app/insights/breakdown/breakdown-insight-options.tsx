import {useContext} from "react";
import {BreakdownInsightContext} from "@app/insights/insight-context.ts";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Input} from "@/components/ui/input.tsx";
import {FieldSelector} from "@app/insights/common/field-selector.tsx";
import {DateRangeSummary} from "@app/insights/common/date-range-summary.tsx";
import {QueryFilterOptions} from "@app/insights/common/query-filter-options.tsx";
import {TrendInsightSeriesAggregationSelection} from "@app/insights/trend/trend-insight-series-aggregation-selection.tsx";
import {AggregationFunction} from "@lib/aggregations.ts";
import {Field, FieldFilter} from "@/model/filters.ts";

export function BreakdownInsightOptions() {
    const {data, updateFn} = useContext(BreakdownInsightContext)
    if (!data) return null

    const config = data.config.breakdown
    const setDuration = (duration: string) => updateFn?.((insight) => {
        insight.config.breakdown.duration = duration
    })
    const setDimension = (field: Field) => updateFn?.((insight) => {
        insight.config.breakdown.dimension = field
    })
    const setLimit = (value: string) => updateFn?.((insight) => {
        insight.config.breakdown.limit = clampInt(value, 1, 100, 10)
    })
    const setAggregation = (func: AggregationFunction, field?: Field, distinct?: boolean) => updateFn?.((insight) => {
        insight.config.breakdown.aggregation = {
            function: func,
            alias: 'result_value',
            field: field ?? {name: 'id', type: 'string'},
            distinct,
        }
    })
    const addFilter = (filter: FieldFilter) => updateFn?.((insight) => {
        insight.config.breakdown.filters = [...(insight.config.breakdown.filters ?? []), filter]
    })
    const updateFilter = (index: number, filter: FieldFilter) => updateFn?.((insight) => {
        const filters = [...(insight.config.breakdown.filters ?? [])]
        filters[index] = filter
        insight.config.breakdown.filters = filters
    })
    const removeFilter = (index: number) => updateFn?.((insight) => {
        insight.config.breakdown.filters = (insight.config.breakdown.filters ?? []).filter((_, i) => i !== index)
    })

    return (
        <Card>
            <CardHeader>
                <CardTitle>Breakdown Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
                <DateRangeSummary value={config.duration} onChange={setDuration}/>
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_120px]">
                    <div className="space-y-2">
                        <Label>Dimension</Label>
                        <FieldSelector value={config.dimension} onChange={setDimension}/>
                    </div>
                    <div className="space-y-2">
                        <Label>Aggregation</Label>
                        <TrendInsightSeriesAggregationSelection
                            currentFunction={config.aggregation.function}
                            selectedField={config.aggregation.field}
                            onSelect={setAggregation}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Limit</Label>
                        <Input
                            type="number"
                            min={1}
                            max={100}
                            value={config.limit ?? 10}
                            onChange={(event) => setLimit(event.target.value)}
                        />
                    </div>
                </div>
                <div className="rounded-md border bg-muted/30 p-2">
                    <QueryFilterOptions
                        filters={config.filters}
                        onAdd={addFilter}
                        onUpdate={updateFilter}
                        onRemove={removeFilter}
                    />
                </div>
            </CardContent>
        </Card>
    )
}

function clampInt(value: string, min: number, max: number, fallback: number) {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(Math.max(parsed, min), max)
}
