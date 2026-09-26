import type { DragEndEvent } from "@dnd-kit/core";
import { useContext } from "react";
import { FunnelInsightContext } from "@app/insights/insight-context.ts";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FunnelStepView } from "@app/insights/funnel/funnel-step-view.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Plus } from "lucide-react";
import { generateRandomId } from "@lib/utils/ids.ts";
import { FunnelStep } from "@/model/insights/funnel-insights.ts";
import { funnelCountingMode } from "@quacklytics/contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FunnelInsightSteps() {
  const { data, updateFn } = useContext(FunnelInsightContext);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );

  const steps = data?.config.funnel.steps ?? [];

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      updateFn?.((draft) => {
        const oldIndex = steps?.findIndex((item) => item.id === active.id);
        const newIndex = steps?.findIndex((item) => item.id === over.id);
        draft.config.funnel.steps = arrayMove(steps ?? [], oldIndex, newIndex);
      });
    }
  };

  function handleAddStep() {
    const nextStepIndex = steps.length + 1;
    const newStep: FunnelStep = {
      id: generateRandomId(),
      name: `step ${nextStepIndex}`,
      order: nextStepIndex,
      query: {},
    };
    updateFn?.((draft) => {
      draft.config.funnel.steps = [
        ...(draft.config.funnel.steps ?? []),
        newStep,
      ];
    });
  }

  return (
    <div>
      <div className="mb-5 space-y-2">
        <label htmlFor="funnel-counting-mode" className="text-sm font-medium">
          Count
        </label>
        <Select
          value={data?.config.funnel.countingMode ?? "uniqueUsers"}
          onValueChange={(value) => {
            const countingMode = funnelCountingMode.parse(value);
            updateFn?.((draft) => {
              draft.config.funnel.countingMode = countingMode;
            });
          }}
        >
          <SelectTrigger
            id="funnel-counting-mode"
            aria-label="Funnel counting method"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uniqueUsers">Unique users</SelectItem>
            <SelectItem value="uniqueSessions">Unique sessions</SelectItem>
            <SelectItem value="eventCount">Event count</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {data?.config.funnel.countingMode === "eventCount"
            ? "Counts each matching event after the user completes the preceding steps. Repeated events can make conversion exceed 100%."
            : data?.config.funnel.countingMode === "uniqueSessions"
              ? "Counts each session once per step. All preceding steps must occur in the same session."
              : "Counts each user once per step, across sessions. Anonymous visitors are identified by session."}
        </p>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={steps} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {steps.map((step) => (
              <FunnelStepView key={step.id} step={step} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button
        variant="secondary"
        className="mt-2 w-full"
        onClick={handleAddStep}
      >
        <Plus className="w-5 h-5 mr-2" />
        Add Step
      </Button>
      {/*<div className="mt-8 whitespace-pre-line">*/}
      {/*    {steps.length > 0 && q}*/}
      {/*</div>*/}
    </div>
  );
}
