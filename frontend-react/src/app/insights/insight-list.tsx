import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table"
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,} from "@/components/ui/dialog"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {useState} from "react"
import {useCreateInsight, useDeleteInsight, useInsights, useUpdateInsight} from "@/services/insights"
import {formatDistance} from "date-fns"
import {Insight} from "@/model/insight.ts";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.tsx";
import {MoreHorizontal, Star} from "lucide-react"
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {ProjectLink} from "@/components/project-link.tsx";
import {cn} from "@lib/utils.ts";

interface Props {
    filter?: (i: Insight) => boolean
    sort?: (i1: Insight, i2: Insight) => number
    title?: string
}

export function InsightsList({filter, sort, title}: Props) {
    const projectId = useProjectId()
    const {data: allInsights = [], isLoading, error} = useInsights(projectId)
    const createInsightMutation = useCreateInsight(projectId)
    const updateInsightMutation = useUpdateInsight(projectId)
    const deleteInsightMutation = useDeleteInsight(projectId)

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newInsightName, setNewInsightName] = useState("")
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState("")

    if (isLoading) return <div>Loading...</div>
    if (error) return <div>Error: {error.message}</div>

    const insights = allInsights.filter(filter ?? (() => true))
    insights.sort(sort ?? ((i1, i2) => (i2.favorite ? 1 : 0) - (i1.favorite ? 1 : 0)))


    const handleCreate = async () => {
        if (newInsightName.trim()) {
            await createInsightMutation.mutateAsync({
                name: newInsightName.trim(),
                type: 'Trend',
                series: [],
                config: {
                    timeBucket: 'Daily',
                    duration: 'P4W',
                },
                favorite: false,
            })
            setNewInsightName("")
            setIsCreateOpen(false)
        }
    }

    const handleStartEdit = (insight: Insight) => {
        setEditingId(insight.id)
        if (insight.name) setEditingName(insight.name)
    }

    const handleSaveEdit = async (insight: Insight) => {
        await updateInsightMutation.mutateAsync({...insight, name: editingName})
        setEditingId(null)
    }

    const toggleFavorite = async (insight: Insight) => {
        await updateInsightMutation.mutateAsync({...insight, favorite: !insight.favorite})
    }

    return (
        <div className="p-4">
            <div className="mb-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold">{title ?? "Insights"}</h2>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>Create New Insight</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Insight</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <Input
                                placeholder="Insight name"
                                value={newInsightName}
                                onChange={(e) => setNewInsightName(e.target.value)}
                            />
                            <Button onClick={handleCreate}>Create</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {insights.map((insight) => (
                        <TableRow key={insight.id}>
                            <TableCell>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => toggleFavorite(insight)}
                                >
                                    <Star
                                        className={cn(
                                            "h-4 w-4",
                                            insight.favorite
                                                ? "fill-current text-yellow-400"
                                                : "text-muted-foreground"
                                        )}
                                    />
                                </Button>
                            </TableCell>
                            <TableCell>
                                {editingId === insight.id ? (
                                    <Input
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        className="w-full"
                                    />
                                ) : (
                                    <ProjectLink to={`/insights/${insight.id}`}>{insight.name}</ProjectLink>
                                )}
                            </TableCell>
                            <TableCell>
                                {insight.createdAt && formatDistance(new Date(insight.createdAt), new Date(), {addSuffix: true})}
                            </TableCell>
                            <TableCell>
                                {insight.updatedAt && formatDistance(new Date(insight.updatedAt), new Date(), {addSuffix: true})}
                            </TableCell>
                            <TableCell className="text-right">
                                {editingId === insight.id ? (
                                    <div className="space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSaveEdit(insight)}
                                        >
                                            Save
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingId(null)}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4"/>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleStartEdit(insight)}>
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600"
                                                onClick={() => deleteInsightMutation.mutateAsync(insight.id)}
                                            >
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
