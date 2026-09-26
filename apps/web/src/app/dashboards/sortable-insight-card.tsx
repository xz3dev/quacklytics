import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  InsightCard,
  type InsightTimeOverrides,
} from "@app/insights/insight-card.tsx";

interface Props {
  className?: string | undefined;
  timeOverrides?: InsightTimeOverrides;
  insight: {
    id: number;
  };
}

export function SortableInsightCard({
  insight,
  timeOverrides,
  className,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: insight.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group min-w-0 ${className ?? ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 right-2 h-4 cursor-move opacity-0 group-hover:opacity-100 transition-opacity z-10"
      ></div>
      <InsightCard insightId={insight.id} timeOverrides={timeOverrides} />
    </div>
  );
}
