import {useContext, useState} from "react";
import {FunnelInsightContext} from "@app/insights/insight-context.ts";
import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {FieldFilter} from "@/model/filters.ts";
import {GripVertical, Plus, X} from "lucide-react";
import {Button} from "@/components/ui/button.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover.tsx";
import {FilterSelectorCard} from "@/components/filters/filter-selector-card.tsx";
import {FilterSelector} from "@/components/filters/filter-selector.tsx";
import {FunnelStep} from "@/model/insights/funnel-insights.ts";

interface FunnelStepProps {
    step: FunnelStep;
}

export function FunnelStepView({step}: FunnelStepProps) {

    const {updateFn} = useContext(FunnelInsightContext);
    const [addFilterOpen, setAddFilterOpen] = useState(false);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({id: step.id});

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const stepUpdateFn = (fn: (step: FunnelStep) => void) => {
        return updateFn?.((insight) => {
            const currentStep = insight.config.funnel.steps?.find(s => s.id === step.id);
            if (!currentStep) return;
            fn(currentStep);
        });
    }


    const handleAddFilter = (filter: FieldFilter) => {
        stepUpdateFn((step) => {
            if (!step.query.filters) {
                step.query.filters = [];
            }
            step.query.filters.push(filter);
        })
    };

    const closeAddFilter = () => {
        setAddFilterOpen(false);
    };

    const handleDeleteStep = () => {
        updateFn?.((insight) => {
            if (!insight.config.funnel.steps) return;

            const stepIndex = insight.config.funnel.steps.findIndex(s => s.id === step.id);
            if (stepIndex === -1) return;

            insight.config.funnel.steps.splice(stepIndex, 1);
        });
    }

    function handleRemoveFilter(filterIndex: number) {
        stepUpdateFn((step) => {
            step.query.filters?.splice(filterIndex, 1);
        })
    }

    function handleFilterUpdate(filterIndex: number, filter: FieldFilter) {
        stepUpdateFn((step) => {
            if (!step.query.filters || !step.query.filters[filterIndex]) return;
            step.query.filters[filterIndex] = filter;
        })
    }


    return (
        <div
            ref={setNodeRef}
            style={style}
            className="border rounded bg-muted/40 shadow flex flex-col items-start"
        >
            <div className="flex items-center pr-2 self-stretch">
                <div
                    className="cursor-grab p-4 grid place-content-center"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical
                        className="w-5 h-5 text-muted-foreground"
                    ></GripVertical>
                </div>
                {
                    step?.name && <div className="text-muted-foreground text-sm">
                        {step.name}
                    </div>
                }

                <div className="flex-1"></div>

                <Button
                    variant="ghost"
                    onClick={handleDeleteStep}
                >
                    <X className="w-5 h-5"/>
                </Button>
            </div>

            <div className="flex items-center gap-2 px-4 pb-3">
                {step?.query?.filters?.map((filter, filterIndex) => (
                    <FilterSelector
                        key={filterIndex}
                        filter={filter}
                        onSave={(filter) => handleFilterUpdate(filterIndex, filter)}
                        onRemove={() => handleRemoveFilter(filterIndex)}
                    />
                ))}
                <Popover
                    open={addFilterOpen}
                    onOpenChange={(isOpen) => {
                        setAddFilterOpen(isOpen);
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
                                handleAddFilter(filter);
                                closeAddFilter();
                            }}
                            onDiscard={() => {
                                closeAddFilter();
                            }}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
