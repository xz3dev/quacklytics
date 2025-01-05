import {Button} from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import {Checkbox} from "@/components/ui/checkbox"
import {ScrollArea} from "@/components/ui/scroll-area"
import {Dashboard} from "@/model/dashboard"
import {useInsights} from "@/services/insights"
import {useProjectId} from "@/hooks/use-project-id"
import {useState, useEffect} from "react"
import {useSetDashboardInsights} from "@/services/dashboards"
import {Settings2} from "lucide-react"

interface Props {
    dashboard: Dashboard
}

export function DashboardManageInsights({dashboard}: Props) {
    const [open, setOpen] = useState(false)
    const [selectedInsights, setSelectedInsights] = useState<Set<number>>(new Set())

    const projectId = useProjectId()
    const setInsightsMutation = useSetDashboardInsights(projectId)

    // Initialize selected insights with current dashboard insights when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedInsights(new Set(dashboard.insights.map(i => i.id)))
        }
    }, [open, dashboard.insights])

    const allInsightsQuery = useInsights(projectId)
    if(allInsightsQuery.isLoading || allInsightsQuery.isPending) return <div>Loading...</div>
    if(allInsightsQuery.error) return <div>Error: {allInsightsQuery.error.message}</div>

    const allInsights = allInsightsQuery.data

    const handleToggleInsight = (insightId: number) => {
        const newSelected = new Set(selectedInsights)
        if (newSelected.has(insightId)) {
            newSelected.delete(insightId)
        } else {
            newSelected.add(insightId)
        }
        setSelectedInsights(newSelected)
    }

    const handleSave = async () => {
        await setInsightsMutation.mutateAsync({
            dashboardId: dashboard.id,
            insightIds: Array.from(selectedInsights)
        })
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Manage Insights
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Manage Dashboard Insights</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                        <div className="font-medium text-sm text-muted-foreground mb-2">
                            Selected Insights ({selectedInsights.size})
                        </div>
                        {allInsights.map((insight) => {
                            const isSelected = selectedInsights.has(insight.id)
                            const wasInitiallySelected = dashboard.insights.some(i => i.id === insight.id)

                            return (
                                <div
                                    key={insight.id}
                                    className={`flex items-center space-x-2 p-2 hover:bg-accent rounded-lg`}
                                >
                                    <Checkbox
                                        id={`insight-${insight.id}`}
                                        checked={isSelected}
                                        onCheckedChange={() => handleToggleInsight(insight.id)}
                                    />
                                    <label
                                        htmlFor={`insight-${insight.id}`}
                                        className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        {insight.name}
                                    </label>
                                    {wasInitiallySelected && (
                                        <span className="text-xs text-muted-foreground">
                                            initially selected
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setSelectedInsights(new Set())
                            setOpen(false)
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={selectedInsights.size === 0}
                    >
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
