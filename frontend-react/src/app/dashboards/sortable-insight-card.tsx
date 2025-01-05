import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVertical} from "lucide-react"
import {InsightCard} from "@app/insights/insight-card.tsx";

interface Props {
    insight: {
        id: number
    }
}

export function SortableInsightCard({insight}: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({id: insight.id})

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="relative group"
        >
            <div
                {...attributes}
                {...listeners}
                className="absolute left-2 top-2 cursor-move opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <InsightCard insightId={insight.id} />
        </div>
    )
}
