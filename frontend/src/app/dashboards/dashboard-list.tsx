import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {useState} from "react"
import {
    useCreateDashboard,
    useDeleteDashboard,
    useDashboards,
    useUpdateDashboard,
    useSetHomeDashboard
} from "@/services/dashboards"
import {formatDistance} from "date-fns"
import {Dashboard} from "@/model/dashboard"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {Home, MoreHorizontal, Plus, Star} from "lucide-react"
import {useProjectId} from "@/hooks/use-project-id"
import {ProjectLink} from "@/components/project-link"
import {cn} from "@lib/utils/tailwind.ts"

interface Props {
    filter?: (d: Dashboard) => boolean
    sort?: (d1: Dashboard, d2: Dashboard) => number
    title?: string
}

export function DashboardList({filter, sort, title}: Props) {
    const projectId = useProjectId()
    const {data: allDashboards = [], isLoading, error} = useDashboards(projectId)
    const createDashboardMutation = useCreateDashboard(projectId)
    const updateDashboardMutation = useUpdateDashboard(projectId)
    const setHomeDashboardMutation = useSetHomeDashboard(projectId)
    const deleteDashboardMutation = useDeleteDashboard(projectId)

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newDashboardName, setNewDashboardName] = useState("")
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState("")

    if (isLoading) return <div>Loading...</div>
    if (error) return <div>Error: {error.message}</div>

    const dashboards = allDashboards.filter(filter ?? (() => true))
    dashboards.sort(sort ?? ((d1, d2) => (d2.favorite ? 1 : 0) - (d1.favorite ? 1 : 0)))

    const handleCreate = async () => {
        if (newDashboardName.trim()) {
            await createDashboardMutation.mutateAsync({
                name: newDashboardName.trim(),
                favorite: false,
            })
            setNewDashboardName("")
            setIsCreateOpen(false)
        }
    }

    const handleStartEdit = (dashboard: Dashboard) => {
        setEditingId(dashboard.id)
        if (dashboard.name) setEditingName(dashboard.name)
    }
    const handleSetAsHome = async (dashboard: Dashboard) => {
        await setHomeDashboardMutation.mutateAsync(dashboard.id)
    }

    const handleSaveEdit = async (dashboard: Dashboard) => {
        await updateDashboardMutation.mutateAsync({...dashboard, name: editingName})
        setEditingId(null)
    }

    const toggleFavorite = async (dashboard: Dashboard) => {
        await updateDashboardMutation.mutateAsync({...dashboard, favorite: !dashboard.favorite})
    }

    return (
        <div className="p-4">
            <div className="mb-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold">{title ?? "Dashboards"}</h2>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4"/>
                            Create New Dashboard
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Dashboard</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <Input
                                placeholder="Dashboard name"
                                value={newDashboardName}
                                onChange={(e) => setNewDashboardName(e.target.value)}
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
                        <TableHead className="w-full">Name</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {dashboards.map((dashboard) => (
                        <TableRow key={dashboard.id}>
                            <TableCell>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => toggleFavorite(dashboard)}
                                >
                                    <Star
                                        className={cn(
                                            "h-4 w-4",
                                            dashboard.favorite
                                                ? "fill-current text-yellow-400"
                                                : "text-muted-foreground"
                                        )}
                                    />
                                </Button>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                {editingId === dashboard.id ? (
                                    <Input
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        className="w-full"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <ProjectLink to={`/dashboards/${dashboard.id}`}>{dashboard.name}</ProjectLink>
                                        {dashboard.home && <Home className="h-4 w-4 text-muted-foreground"/>}
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                {dashboard.createdAt && formatDistance(new Date(dashboard.createdAt), new Date(), {addSuffix: true})}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                {dashboard.updatedAt && formatDistance(new Date(dashboard.updatedAt), new Date(), {addSuffix: true})}
                            </TableCell>
                            <TableCell className="text-right">
                                {editingId === dashboard.id ? (
                                    <div className="space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSaveEdit(dashboard)}
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
                                            <DropdownMenuItem
                                                onClick={() => handleSetAsHome(dashboard)}
                                                disabled={dashboard.home}
                                            >
                                                Set as Home
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStartEdit(dashboard)}>
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600"
                                                onClick={() => deleteDashboardMutation.mutateAsync(dashboard.id)}
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
