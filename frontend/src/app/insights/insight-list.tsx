import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table"
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,} from "@/components/ui/dialog"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {useState} from "react"
import {useCreateInsight, useDeleteInsight, useInsights, useUpdateInsight} from "@/services/insights"
import {formatDistance} from "date-fns"
import {Insight, InsightType} from "@/model/insight.ts";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.tsx";
import {MoreHorizontal, Plus, Star} from "lucide-react"
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {ProjectLink} from "@/components/project-link.tsx";
import {cn} from "@lib/utils/tailwind.ts";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {newValueInsight} from "@/model/value-insight.ts";
import {newTrendInsight} from "@/model/trend-insight.ts";

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
    const [selectedType, setSelectedType] = useState<InsightType>('Trend')

    if (isLoading) return <div>Loading...</div>
    if (error) return <div>Error: {error.message}</div>

    const insights = allInsights.filter(filter ?? (() => true))
    insights.sort(sort ?? ((i1, i2) => (i2.favorite ? 1 : 0) - (i1.favorite ? 1 : 0)))


    const handleCreate = async () => {
        if (newInsightName.trim()) {
            let defaults;
            switch (selectedType) {
                case 'Trend':
                    defaults = newTrendInsight
                    break;
                case 'Value':
                    defaults = newValueInsight
                    break;
                default:
                    defaults = newTrendInsight
            }
            await createInsightMutation.mutateAsync({
                ...defaults,
                name: newInsightName.trim(),
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
        <div>
            <div className="mb-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold">{title ?? "Insights"}</h2>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4"/>
                            Create New Insight
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Insight</DialogTitle>
                        </DialogHeader>
                        <div className="grid py-4 gap-4">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-2">
                                    Name
                                </label>
                                <Input
                                    placeholder="Insight name"
                                    value={newInsightName}
                                    onChange={(e) => setNewInsightName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-muted-foreground mb-2">
                                    Insight Type
                                </label>
                                <Select
                                    value={selectedType}
                                    onValueChange={(value) => setSelectedType(value as InsightType)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select Type"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Trend">Trend</SelectItem>
                                        <SelectItem value="Value">Value</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div></div>

                            <Button onClick={handleCreate}>Create</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="w-full">Name</TableHead>
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
                            <TableCell className="whitespace-nowrap">
                                {insight.createdAt && formatDistance(new Date(insight.createdAt), new Date(), {addSuffix: true})}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
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
