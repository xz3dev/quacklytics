import {useDashboard, useSetDashboardInsights} from "@/services/dashboards"
import {useProjectId} from "@/hooks/use-project-id"
import {Spinner} from "@/components/spinner"
import {DashboardManageInsights} from "@app/dashboards/dashboard-manage-insights"
import {DndContext, DragEndEvent} from '@dnd-kit/core'
import {arrayMove, SortableContext, rectSortingStrategy} from '@dnd-kit/sortable'
import {SortableInsightCard} from './sortable-insight-card'
import {useEffect, useState} from 'react'
import {Insight} from "@/model/insight.ts";
import { useDebounce } from "@uidotdev/usehooks"
import { ProjectLink } from "@/components/project-link"

interface Props {
    dashboardId: number
    readOnly?: boolean
}

export function DashboardView({dashboardId, readOnly}: Props) {
    const projectId = useProjectId()
    const {data: dashboard, isLoading, error} = useDashboard(projectId, dashboardId)
    const [insights, setInsights] = useState<Insight[]>([])
    const debouncedInsights = useDebounce(insights, 1000)
    const setDashboardInsights = useSetDashboardInsights(projectId)

    useEffect(() => {
        setInsights(dashboard?.insights ?? [])
    }, [dashboard])

    useEffect(() => {
        if(!dashboard || !debouncedInsights.length) return
        void setDashboardInsights.mutateAsync({
            dashboardId: dashboard.id,
            insightIds: debouncedInsights.map(i => i.id)
        })
    }, [debouncedInsights]);

    if (isLoading) return <Spinner/>
    if (error) return <div>Error: {error.message}</div>
    if (!dashboard) return null


    const handleDragEnd = ({active, over}: DragEndEvent) => {
        if (over && active.id !== over.id) {
            setInsights(items => {
                const oldIndex = items.findIndex(item => item.id === active.id)
                const newIndex = items.findIndex(item => item.id === over.id)
                return arrayMove(items, oldIndex, newIndex)
            })
        }
    }

    return (
        <div className="flex flex-col gap-4 my-4">
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                    <ProjectLink to={`/dashboards/${dashboard.id}`}>
                        {dashboard.name}
                    </ProjectLink>
                </h1>
                <div className="flex-1"/>
                {!readOnly && <DashboardManageInsights dashboard={dashboard}/>}
            </div>
            <DndContext onDragEnd={handleDragEnd}>
                <SortableContext items={insights} strategy={rectSortingStrategy}>
                    <div className="grid gap-4 py-4 grid-cols-2 items-stretch">
                        {insights.map(insight => (
                            <SortableInsightCard
                                key={insight.id}
                                insight={insight}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}
