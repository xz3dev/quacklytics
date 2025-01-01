import {useContext, useState} from "react";
import {TrendInsightContext} from "@app/insights/insight-context.ts";
import {Button} from "@/components/ui/button.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import { FilterSelectorCard } from "@/components/filters/filter-selector-card";
import {Plus} from "lucide-react";

export function TrendInsightOptions() {
    const {data, update} = useContext(TrendInsightContext)
    const [addFilterOpen, setAddFilterOpen] = useState<boolean[]>([])

    if (!data) return <></>

    return (
        <div className="flex flex-col items-start gap-2">
            {
                data.series?.map((series, i) => {
                    return <div
                        key={i}
                        className="flex items-center gap-2"
                    >
                        ({series.name})
                        {series.query?.filters.map(() => <div>Filter</div>)}
                        <Popover
                            open={addFilterOpen[i]}
                            onOpenChange={(open) => {
                                const newOpenStates = [...addFilterOpen]
                                newOpenStates[i] = open
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
                                    availableFields={[]}
                                    eventTypes={[]}
                                    propertyValues={{}}
                                    onSave={() => {
                                        // handleFilterChange(i, undefined, filter)
                                        // const newOpenStates = [...addFilterOpen]
                                        // newOpenStates[i] = false
                                        // setAddFilterOpen(newOpenStates)
                                    }}
                                    onDiscard={() => {
                                        // handleFilterChange(i, undefined, undefined)
                                        // const newOpenStates = [...addFilterOpen]
                                        // newOpenStates[i] = false
                                        // setAddFilterOpen(newOpenStates)
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
