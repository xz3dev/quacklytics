import {useContext, useState} from "react";
import {ValueInsightContext} from "@app/insights/insight-context.ts";
import {Field, FieldFilter} from "@/model/filters.ts";
import {AggregationFunction} from "@lib/aggregations.ts";
import {
    TrendInsightSeriesAggregationSelection
} from "@app/insights/trend/trend-insight-series-aggregation-selection.tsx";
import {FilterSelector} from "@/components/filters/filter-selector.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Plus} from "lucide-react";
import {FilterSelectorCard} from "@/components/filters/filter-selector-card.tsx";

export function ValueInsightSeriesOptions() {
    const {data, updateFn} = useContext(ValueInsightContext);
    const [addFilterOpen, setAddFilterOpen] = useState<boolean>(false);

    const handleAddFilter = (filter: FieldFilter) => {
        updateFn?.((insight) => {
            if (!insight.config.value.series.query.filters) return
            insight.config.value.series.query.filters.push(filter);
        });
    };

    const handleRemoveFilter = (filterIndex: number) => {
        updateFn?.((insight) => {
            if (!insight.config.value.series.query.filters) return
            insight.config.value.series.query?.filters.splice(filterIndex, 1);
        });
    };

    const handleFilterUpdate = (filterIndex: number, filter: FieldFilter) => {
        updateFn?.((insight) => {
            if (insight.config.value.series.query?.filters?.[filterIndex]) {
                insight.config.value.series.query.filters[filterIndex] = filter;
            }
        });
    };

    const closeAddFilter = () => {
        setAddFilterOpen(false);
    };

    function handleAggregationChange(
        func: AggregationFunction,
        field?: Field,
        distinct?: boolean
    ) {
        console.log(`update`, func, field, distinct);
        updateFn?.((insight) => {
            if (!insight.config.value.series?.query?.aggregations) {
                insight.config.value.series.query.aggregations = []
            }
            insight.config.value.series.query.aggregations[0] = {
                function: func,
                alias: 'result_value',
                field: field ?? {name: 'id', type: 'string'},
                distinct,
            };
        });
    }

    return (
        <div className="flex flex-col items-stretch gap-2">
            <div
                className="flex gap-2 p-2 bg-muted/40 border border-border rounded-md"
            >
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                    <TrendInsightSeriesAggregationSelection
                        currentFunction={data?.config.value.series?.query?.aggregations?.[0]?.function ?? 'COUNT'}
                        selectedField={data?.config.value.series?.query?.aggregations?.[0]?.field}
                        onSelect={(func, field, distinct) =>
                            handleAggregationChange(func, field, distinct)
                        }
                    />
                    {data?.config.value.series?.query?.filters?.map((filter, filterIndex) => (
                        <FilterSelector
                            key={filterIndex}
                            filter={filter}
                            onSave={(filter) => handleFilterUpdate(filterIndex, filter)}
                            onRemove={() => handleRemoveFilter(filterIndex)}
                        />
                    ))}
                    <Popover
                        open={addFilterOpen}
                        onOpenChange={setAddFilterOpen}
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
                                    handleAddFilter(filter);
                                    closeAddFilter();
                                }}
                                onDiscard={closeAddFilter}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
}
