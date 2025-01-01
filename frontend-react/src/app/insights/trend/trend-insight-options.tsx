import {useContext, useState} from "react";
import {TrendInsightContext} from "@app/insights/insight-context.ts";
import {Button} from "@/components/ui/button.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import { FilterSelectorCard } from "@/components/filters/filter-selector-card";
import {Plus} from "lucide-react";
import {FieldFilter} from "@/model/filters.ts";
import {FilterSelector} from "@/components/filters/filter-selector.tsx";

export function TrendInsightOptions() {
    const {data, update} = useContext(TrendInsightContext)
    const [addFilterOpen, setAddFilterOpen] = useState<boolean[]>([])

    if (!data) return <></>

    const handleAddFilter = (filter: FieldFilter, seriesIndex: number) => {
        update?.((insight) => {
            insight.series?.[seriesIndex]?.query?.filters.push(filter)
        })
    }

    const handleRemoveFilter = (seriesIndex: number, filterIndex: number) => {
        update?.((insight) => {
            insight.series?.[seriesIndex]?.query?.filters.splice(filterIndex, 1)
        })
    }

    const handleFilterUpdate = (seriesIndex: number, filterIndex: number, filter: FieldFilter) => {
        console.log(`update`, filter)
        update?.((insight) => {
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

    return (
        <div className="flex flex-col items-start gap-2">
            {
                data.series?.map((series, seriesIndex) => {
                    return <div
                        key={seriesIndex}
                        className="flex items-center gap-2"
                    >
                        ({series.name})
                        {series.query?.filters.map((filter, filterIndex) => (
                            <FilterSelector filter={filter} onSave={(filter) => handleFilterUpdate(seriesIndex, filterIndex, filter)} onRemove={() => handleRemoveFilter(seriesIndex, filterIndex)}/>
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
                    </div>
                })
            }
            <Button
                variant="outline"
                onClick={() => {
                    update?.((data) => {
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
            >Add Series</Button>
        </div>
    )
}
