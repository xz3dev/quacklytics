import {useContext, useState} from "react";
import {TrendInsightContext} from "@app/insights/insight-context.ts";
import {Button} from "@/components/ui/button.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import { FilterSelectorCard } from "@/components/filters/filter-selector-card";
import {Plus, TrendingUp, X} from "lucide-react";
import {FieldFilter} from "@/model/filters.ts";
import {FilterSelector} from "@/components/filters/filter-selector.tsx";

export function TrendInsightOptions() {
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
            if(insight.series?.[seriesIndex]?.query?.filters[filterIndex]) {
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

    return (
        <div className="flex flex-col items-stretch gap-2">
            {
                data.series?.map((series, seriesIndex) => {
                    return <div
                        key={seriesIndex}
                        className="flex items-center gap-2 p-2 bg-muted/40 border border-border rounded-md"
                    >
                        <TrendingUp className="w-5 h-5 text-muted-foreground mx-1"></TrendingUp>
                        {series.query?.filters.map((filter, filterIndex) => (
                            <FilterSelector
                                key={filterIndex}
                                filter={filter}
                                onSave={(filter) => handleFilterUpdate(seriesIndex, filterIndex, filter)}
                                onRemove={() => handleRemoveFilter(seriesIndex, filterIndex)}
                            />
                        ))}
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
                                    <Plus className="h-4 w-4 mr-2" />
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
                            <X className="w-5 h-5"></X>
                        </Button>
                    </div>
                })
            }
            <Button
                variant="ghost"
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
