import {useContext, useState} from "react";
import {TrendInsightContext} from "@app/insights/insight-context.ts";
import {Button} from "@/components/ui/button.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {FilterSelectorCard} from "@/components/filters/filter-selector-card";
import {ChartNoAxesColumnIncreasing, Plus, TrendingUp, X} from "lucide-react";
import {Field, FieldFilter} from "@/model/filters.ts";
import {FilterSelector} from "@/components/filters/filter-selector.tsx";
import {
    TrendInsightSeriesAggregationSelection
} from "@app/insights/trend/trend-insight-series-aggregation-selection.tsx";
import {AggregationFunction} from "@lib/aggregations.ts";

export function TrendInsightSeriesOptions() {
    const {data, updateFn} = useContext(TrendInsightContext)
    const [addFilterOpen, setAddFilterOpen] = useState<boolean[]>([])

    if (!data) return <></>

    const handleAddFilter = (filter: FieldFilter, seriesIndex: number) => {
        updateFn?.((insight) => {
            insight.series?.[seriesIndex]?.query?.filters.push(filter)
        })
    }

    const handleRemoveFilter = (seriesIndex: number, filterIndex: number) => {
        updateFn?.((insight) => {
            insight.series?.[seriesIndex]?.query?.filters.splice(filterIndex, 1)
        })
    }

    const handleFilterUpdate = (seriesIndex: number, filterIndex: number, filter: FieldFilter) => {
        console.log(`update`, filter)
        updateFn?.((insight) => {
            if (insight.series?.[seriesIndex]?.query?.filters[filterIndex]) {
                insight.series[seriesIndex].query.filters[filterIndex] = filter
            }
        })
    }

    const closeAddFilter = (seriesIndex: number) => {
        const newOpenStates = [...addFilterOpen]
        newOpenStates[seriesIndex] = false
        setAddFilterOpen(newOpenStates)
    }

    const handleRemoveSeries = (seriesIndex: number) => {
        updateFn?.((insight) => {
            insight.series?.splice(seriesIndex, 1)
        })
    }

    function toggleVisualization(seriesIndex: number) {
        updateFn?.((insight) => {
            if(!insight.series?.[seriesIndex]) return
            insight.series[seriesIndex].visualisation = insight.series[seriesIndex].visualisation === 'line' ? 'bar' : 'line'
        })
    }

    function handleAggregationChange(
        seriesIndex: number,
        func: AggregationFunction,
        field?: Field,
        distinct?: boolean
    ) {
        console.log(`update`, func, field, distinct)
        updateFn?.((insight) => {
            if (!insight.series?.[seriesIndex]?.query?.aggregations?.[0]) return
            insight.series[seriesIndex].query.aggregations[0] = {
                function: func,
                alias: 'result_value',
                field: field ?? {name: 'id', type: 'string'},
                distinct
            }
        })
    }


    return (
        <div className="flex flex-col items-stretch gap-2">
            {
                data.series?.map((series, seriesIndex) => {
                    return <div
                        key={seriesIndex}
                        className="flex items-center gap-2 p-2 bg-muted/40 border border-border rounded-md"
                    >
                        <Button
                            variant="ghost"
                            onClick={() => toggleVisualization(seriesIndex)}
                        >
                            {series.visualisation === 'line' && <TrendingUp className="w-5 h-5 text-muted-foreground mx-1"></TrendingUp>}
                            {series.visualisation === 'bar' && <ChartNoAxesColumnIncreasing className="w-5 h-5 text-muted-foreground mx-1"></ChartNoAxesColumnIncreasing>}
                        </Button>
                        {series.query?.filters.map((filter, filterIndex) => (
                            <FilterSelector
                                key={filterIndex}
                                filter={filter}
                                onSave={(filter) => handleFilterUpdate(seriesIndex, filterIndex, filter)}
                                onRemove={() => handleRemoveFilter(seriesIndex, filterIndex)}
                            />
                        ))}
                        <TrendInsightSeriesAggregationSelection
                            currentFunction={series.query?.aggregations[0]?.function ?? 'COUNT'}
                            selectedField={series.query?.aggregations[0]?.field}
                            onSelect={(func, field, distinct) =>
                                handleAggregationChange(seriesIndex, func, field, distinct)
                            }
                        />
                        <Popover
                            open={addFilterOpen[seriesIndex]}
                            onOpenChange={(isOpen) => {
                                const newOpenStates = [...addFilterOpen]
                                newOpenStates[seriesIndex] = isOpen
                                setAddFilterOpen(newOpenStates)
                            }}
                        >
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8">
                                    <Plus className="h-4 w-4 mr-2"/>
                                    Add Filter
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0">
                                <FilterSelectorCard
                                    onSave={(filter) => {
                                        handleAddFilter(filter, seriesIndex)
                                        closeAddFilter(seriesIndex)
                                    }}
                                    onDiscard={() => {
                                        closeAddFilter(seriesIndex)
                                    }}
                                />
                            </PopoverContent>
                        </Popover>

                        <div className="flex-1"></div>
                        <Button
                            variant="ghost"
                            onClick={() => handleRemoveSeries(seriesIndex)}
                        >
                            <X className="w-5 h-5"/>
                        </Button>
                    </div>
                })
            }
            <Button
                variant="secondary"
                onClick={() => {
                    updateFn?.((data) => {
                        data.series = [...(data.series ?? []), {
                            name: 'New Series',
                            visualisation: 'line',
                            query: {
                                filters: [],
                                aggregations: [
                                    {
                                        function: 'COUNT',
                                        alias: 'result_value',
                                        field: {name: 'id', type: 'string'},
                                    },
                                ],
                            },
                        }]
                    })
                }}
            >
                <Plus className="w-4 h-4"/>
                Add Series
            </Button>
        </div>
    )
}
