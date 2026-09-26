import { DashboardMosaic } from "./dashboard-mosaic";
import { PageHeader, PageTitle } from "@/components/page-header";
import { useDashboardCollection } from "@/data/collections";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  useCreateDashboard,
  useDeleteDashboard,
  useUpdateDashboard,
  useSetHomeDashboard,
  useRestoreDefaultDashboard,
  useCreateTemplateDashboard,
} from "@/services/dashboards";
import { formatDistance } from "date-fns";
import { Dashboard, type DashboardTemplate } from "@/model/dashboard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Home,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Star,
  X,
} from "lucide-react";
import { useProjectId } from "@/hooks/use-project-id";
import { Link } from "@/lib/navigation";
import { cn } from "@lib/utils/tailwind.ts";
import { toast } from "sonner";

interface Props {
  filter?: (d: Dashboard) => boolean;
  sort?: (d1: Dashboard, d2: Dashboard) => number;
  title?: string;
}

export function DashboardList({ filter, sort, title }: Props) {
  const projectId = useProjectId();
  const {
    data: allDashboards = [],
    isLoading,
    error,
  } = useDashboardCollection(projectId);
  const createDashboardMutation = useCreateDashboard(projectId);
  const updateDashboardMutation = useUpdateDashboard(projectId);
  const setHomeDashboardMutation = useSetHomeDashboard(projectId);
  const deleteDashboardMutation = useDeleteDashboard(projectId);
  const restoreDefaultDashboardMutation = useRestoreDefaultDashboard(projectId);
  const createTemplateDashboardMutation = useCreateTemplateDashboard(projectId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [search, setSearch] = useState("");

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const dashboards = allDashboards.filter(filter ?? (() => true));
  dashboards.sort(
    sort ?? ((d1, d2) => (d2.favorite ? 1 : 0) - (d1.favorite ? 1 : 0)),
  );

  const query = search.trim().toLocaleLowerCase();
  const visibleDashboards = dashboards.filter((dashboard) =>
    dashboard.name.toLocaleLowerCase().includes(query),
  );

  const handleCreate = async () => {
    if (newDashboardName.trim()) {
      await createDashboardMutation.mutateAsync({
        name: newDashboardName.trim(),
        favorite: false,
      });
      setNewDashboardName("");
      setIsCreateOpen(false);
    }
  };

  const handleStartEdit = (dashboard: Dashboard) => {
    setEditingId(dashboard.id);
    if (dashboard.name) setEditingName(dashboard.name);
  };
  const handleSetAsHome = async (dashboard: Dashboard) => {
    await setHomeDashboardMutation.mutateAsync(dashboard.id);
  };

  const handleSaveEdit = async (dashboard: Dashboard) => {
    await updateDashboardMutation.mutateAsync({
      ...dashboard,
      name: editingName.trim(),
    });
    setEditingId(null);
  };

  const toggleFavorite = async (dashboard: Dashboard) => {
    await updateDashboardMutation.mutateAsync({
      ...dashboard,
      favorite: !dashboard.favorite,
    });
  };

  const handleRestoreDefaultDashboard = async () => {
    try {
      await restoreDefaultDashboardMutation.mutateAsync();
      toast.success("Default dashboard restored");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to restore default dashboard",
      );
    }
  };

  const handleCreateTemplateDashboard = async (template: DashboardTemplate) => {
    try {
      await createTemplateDashboardMutation.mutateAsync({
        template,
        data: { home: allDashboards.length === 0 },
      });
      toast.success("Dashboard template created");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create dashboard template",
      );
    }
  };

  return (
    <section className="min-w-0">
      <PageHeader>
        <PageTitle>{title ?? "Dashboards"}</PageTitle>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="relative w-full min-w-0 sm:w-64 sm:flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search dashboards"
              placeholder="Search dashboards..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {import.meta.env.DEV && (
            <Button
              variant="outline"
              onClick={() => handleCreateTemplateDashboard("chart_playground")}
              disabled={createTemplateDashboardMutation.isPending}
            >
              <BarChart3 className="h-4 w-4" />
              Chart playground (dev)
            </Button>
          )}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
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
      </PageHeader>
      <p role="status" className="sr-only">
        {query &&
          `${visibleDashboards.length} of ${dashboards.length} dashboards`}
      </p>

      {allDashboards.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/20 bg-primary/[0.03] px-6 py-10 text-center">
          <div>
            <h3 className="text-lg font-semibold">No dashboards</h3>
            <p className="text-sm text-muted-foreground">
              Start from a template or create a dashboard manually.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleCreateTemplateDashboard("product_analytics")}
              disabled={createTemplateDashboardMutation.isPending}
            >
              <Boxes className="h-4 w-4" />
              Product analytics
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCreateTemplateDashboard("web_analytics")}
              disabled={createTemplateDashboardMutation.isPending}
            >
              <BarChart3 className="h-4 w-4" />
              Web analytics
            </Button>
            <Button
              variant="ghost"
              onClick={handleRestoreDefaultDashboard}
              disabled={restoreDefaultDashboardMutation.isPending}
            >
              <RotateCcw className="h-4 w-4" />
              Restore default
            </Button>
          </div>
        </div>
      )}

      {visibleDashboards.length > 0 ? (
        <div
          className="grid grid-cols-1 gap-3 lg:grid-cols-2"
          aria-label="Dashboards"
        >
          {visibleDashboards.map((dashboard) => (
            <article
              key={dashboard.id}
              aria-label={dashboard.name}
              className="flex min-w-0 gap-3 rounded-xl border border-border/50 bg-card p-3 text-card-foreground transition-colors hover:border-foreground/25"
            >
              <DashboardMosaic insights={dashboard.insights} />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {editingId === dashboard.id ? (
                      <Input
                        aria-label="Dashboard name"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        autoFocus
                      />
                    ) : (
                      <h3 className="min-w-0 break-words text-base font-semibold tracking-tight">
                        <Link
                          to="/app/$projectid/dashboards/$dashboardid"
                          params={{
                            projectid: projectId,
                            dashboardid: String(dashboard.id),
                          }}
                          className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {dashboard.name}
                        </Link>
                      </h3>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`${dashboard.favorite ? "Remove" : "Add"} ${dashboard.name} ${dashboard.favorite ? "from" : "to"} favorites`}
                      aria-pressed={dashboard.favorite}
                      onClick={() => toggleFavorite(dashboard)}
                      disabled={updateDashboardMutation.isPending}
                    >
                      <Star
                        className={cn(
                          "h-5 w-5",
                          dashboard.favorite
                            ? "fill-current text-foreground"
                            : "text-muted-foreground",
                        )}
                      />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`Actions for ${dashboard.name}`}
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleSetAsHome(dashboard)}
                          disabled={dashboard.home}
                        >
                          Set as Home
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStartEdit(dashboard)}
                        >
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            deleteDashboardMutation.mutateAsync(dashboard.id)
                          }
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  {dashboard.home && (
                    <span className="inline-flex items-center gap-2">
                      <Home aria-hidden="true" className="h-4 w-4" />
                      Home dashboard
                    </span>
                  )}
                  <span>
                    {dashboard.insights.length}{" "}
                    {dashboard.insights.length === 1 ? "insight" : "insights"}
                  </span>
                  {dashboard.updatedAt && (
                    <span>
                      Updated{" "}
                      {formatDistance(
                        new Date(dashboard.updatedAt),
                        new Date(),
                        {
                          addSuffix: true,
                        },
                      )}
                    </span>
                  )}
                </div>
                <div className="mt-auto">
                  {editingId === dashboard.id ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveEdit(dashboard)}
                        disabled={
                          !editingName.trim() ||
                          updateDashboardMutation.isPending
                        }
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
                    <Link
                      to="/app/$projectid/dashboards/$dashboardid"
                      params={{
                        projectid: projectId,
                        dashboardid: String(dashboard.id),
                      }}
                      aria-label={`Open dashboard: ${dashboard.name}`}
                      className="inline-flex items-center gap-3 rounded-sm text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Open dashboard{" "}
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : allDashboards.length > 0 ? (
        <div className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.03] px-6 py-10 text-center">
          <h3 className="font-semibold">
            {query ? "No matching dashboards" : "No dashboards to show"}
          </h3>
          {query && (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Try another name or clear your search.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setSearch("")}
              >
                Clear search
              </Button>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
