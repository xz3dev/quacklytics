import {useContext} from "react";
import {FunnelInsightContext} from "@app/insights/insight-context.ts";
import {closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors} from "@dnd-kit/core";
import {arrayMove, SortableContext, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {FunnelStepView} from "@app/insights/funnel/funnel-step-view.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Plus} from "lucide-react";
import {generateRandomId} from "@lib/utils/ids.ts";
import {FunnelStep} from "@/model/insights/funnel-insights.ts";

export function FunnelInsightSteps() {
    const {data, updateFn} = useContext(FunnelInsightContext);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor)
    );

    const steps = data?.config.funnel.steps ?? [];


    const handleDragEnd = ({active, over}: { active: any; over: any }) => {
        if (active.id !== over.id) {
            updateFn?.((draft) => {
                const oldIndex = steps?.findIndex((item) => item.id === active.id);
                const newIndex = steps?.findIndex((item) => item.id === over.id);
                draft.config.funnel.steps = arrayMove(steps ?? [], oldIndex, newIndex);
            })
        }
    };

    function handleAddStep() {
        const nextStepIndex = steps.length + 1;
        const newStep: FunnelStep = {
            id: generateRandomId(),
            name: `step ${nextStepIndex}`,
            order: nextStepIndex,
            query: {},
        }
        updateFn?.((draft) => {
            draft.config.funnel.steps = [...(draft.config.funnel.steps ?? []), newStep]
        })
    }

    return (
        <div>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={steps} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-2">
                        {steps.map((step) => (
                            <FunnelStepView key={step.id} step={step}/>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            <Button
                variant="secondary"
                className="mt-2 w-full"
                onClick={handleAddStep}
            >
                <Plus className="w-5 h-5 mr-2"/>
                Add Step
            </Button>
            {/*<div className="mt-8 whitespace-pre-line">*/}
            {/*    {steps.length > 0 && q}*/}
            {/*</div>*/}
        </div>
    );
}


