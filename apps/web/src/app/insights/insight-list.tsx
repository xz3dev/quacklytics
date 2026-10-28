import { PageHeader, PageTitle } from "@/components/page-header";
import { defaultInsights } from "@quacklytics/contracts";
import { useInsightCollection } from "@/data/collections";
import { InsightGlyph } from "./insight-glyph";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  useCreateInsight,
  useDeleteInsight,
  useUpdateInsight,
} from "@/services/insights";
import { Insight, InsightType } from "@/model/insights/insight.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  ArrowRight,
  BarChart3,
  Check,
  MoreHorizontal,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { ProjectLink } from "@/components/project-link.tsx";
import { Link, useNavigate } from "@/lib/navigation";
import { cn } from "@lib/utils/tailwind.ts";
const insightTypeDescriptions: Record<InsightType, string> = {
  Trend: "Track changes over time",
  Value: "Measure a key metric",
  Funnel: "Explore step-by-step conversion",
  Breakdown: "Compare categories",
  Retention: "See who comes back",
  Path: "Discover the routes users take",
  Map: "See where visitors come from",
};

interface Props {
  filter?: (i: Insight) => boolean;
  sort?: (i1: Insight, i2: Insight) => number;
  title?: string;
  createAsFavorite?: boolean;
  overview?: boolean;
}

export function InsightsList({
  filter,
  sort,
  title,
  createAsFavorite,
  overview = false,
}: Props) {
  const projectId = useProjectId();
  const {
    data: allInsights = [],
    isLoading,
    error,
  } = useInsightCollection(projectId);
  const createInsightMutation = useCreateInsight(projectId);
  const updateInsightMutation = useUpdateInsight(projectId);
  const deleteInsightMutation = useDeleteInsight(projectId);
  const navigate = useNavigate();

  const [actionError, setActionError] = useState<string | null>(null);
  const busy =
    createInsightMutation.isPending ||
    updateInsightMutation.isPending ||
    deleteInsightMutation.isPending;
  const runAction = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch {
      setActionError("Could not save changes. Please try again.");
    }
  };

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedType, setSelectedType] = useState<InsightType>("Trend");

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const query = search.trim().toLowerCase();
  const insights = allInsights.filter(
    (insight) =>
      (!filter || filter(insight)) &&
      `${insight.name || "Untitled insight"} ${insight.type}`
        .toLowerCase()
        .includes(query),
  );
  insights.sort(
    sort ?? ((i1, i2) => (i2.favorite ? 1 : 0) - (i1.favorite ? 1 : 0)),
  );

  const handleCreate = async () => {
    const defaults = defaultInsights[selectedType];
    const created = await createInsightMutation.mutateAsync({
      ...defaults,
      name: `Untitled ${selectedType.toLowerCase()}`,
      favorite: createAsFavorite ?? false,
    });
    setIsCreateOpen(false);
    await navigate(`/app/${projectId}/insights/${created.id}/edit`);
  };

  const handleStartEdit = (insight: Insight) => {
    setEditingId(insight.id);
    if (insight.name) setEditingName(insight.name);
  };

  const handleSaveEdit = async (insight: Insight) => {
    await updateInsightMutation.mutateAsync({ ...insight, name: editingName });
    setEditingId(null);
  };

  const toggleFavorite = async (insight: Insight) => {
    await updateInsightMutation.mutateAsync({
      ...insight,
      favorite: !insight.favorite,
    });
  };

  return (
    <div>
      <PageHeader>
        <PageTitle>{overview ? "Analytics" : (title ?? "Insights")}</PageTitle>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="relative w-full min-w-0 sm:w-64 sm:flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search insights"
              placeholder="Search insights..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Create New Insight
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl">
              <DialogHeader>
                <DialogTitle>Create New Insight</DialogTitle>
                <DialogDescription>
                  Choose how you want to explore your data.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 pt-2">
                <fieldset>
                  <legend className="mb-3 text-xs text-muted-foreground">
                    Insight Type
                  </legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Object.values(defaultInsights).map(({ type }) => (
                      <label key={type} className="relative cursor-pointer">
                        <input
                          type="radio"
                          name="insight-type"
                          value={type}
                          checked={selectedType === type}
                          onChange={() => setSelectedType(type)}
                          aria-label={type}
                          aria-describedby={`insight-type-${type}-description`}
                          className="peer sr-only"
                        />
                        <span className="flex h-full flex-col items-center rounded-xl border border-border/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/2.5 peer-checked:border-primary peer-checked:bg-primary/6 peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:outline-solid peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring">
                          <InsightGlyph type={type} />
                          <span className="mt-3 text-sm font-medium">
                            {type}
                          </span>
                          <span
                            id={`insight-type-${type}-description`}
                            className="mt-1 text-xs leading-relaxed text-muted-foreground"
                          >
                            {insightTypeDescriptions[type]}
                          </span>
                        </span>
                        {selectedType === type && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                          >
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <Button disabled={busy} onClick={() => runAction(handleCreate)}>
                  Create
                </Button>
                {actionError && (
                  <p role="alert" className="text-sm text-destructive">
                    {actionError}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {actionError && !isCreateOpen && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      )}
      <section aria-label={title ?? "Insights"}>
        {overview && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight">
              {title ?? "Insights"}
            </h2>
            <ProjectLink to="/insights">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                View all insights <ArrowRight className="h-4 w-4" />
              </span>
            </ProjectLink>
          </div>
        )}
        {insights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-primary/20 bg-primary/3 px-6 py-10 text-center">
            <Star className="mx-auto mb-3 h-6 w-6 text-primary/60" />
            <h3 className="font-medium">
              {query
                ? "No insights found"
                : createAsFavorite
                  ? "Your favorite insights, together"
                  : "No insights yet"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {query
                ? "Try a different search or clear the search field."
                : createAsFavorite
                  ? "Star an insight or create a new one to keep it here."
                  : "Create an insight to start exploring your data."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(overview ? insights.slice(0, 6) : insights).map((insight) => {
              const name = insight.name || "Untitled insight";
              return (
                <li
                  key={insight.id}
                  className="group relative flex min-w-0 items-center gap-4 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-foreground/25"
                >
                  <InsightGlyph type={insight.type} />
                  <div className="min-w-0 flex-1 py-2 pr-14">
                    {editingId === insight.id ? (
                      <div className="relative z-10 flex flex-col gap-2">
                        <Input
                          aria-label="Insight name"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            disabled={busy || !editingName.trim()}
                            onClick={() =>
                              runAction(() => handleSaveEdit(insight))
                            }
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <ProjectLink to={`/insights/${insight.id}`}>
                        <span className="font-medium leading-snug wrap-break-word after:absolute after:inset-0 after:rounded-xl">
                          {name}
                        </span>
                      </ProjectLink>
                    )}
                    <span className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <BarChart3
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      {insight.type}
                    </span>
                  </div>
                  <div className="absolute right-2 top-3 z-10 flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={
                        insight.favorite
                          ? `Remove ${insight.name} from favorites`
                          : `Add ${insight.name} to favorites`
                      }
                      aria-pressed={insight.favorite}
                      disabled={busy}
                      onClick={() => runAction(() => toggleFavorite(insight))}
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          insight.favorite
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
                          aria-label={`Actions for ${insight.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleStartEdit(insight)}
                        >
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={busy}
                          className="text-destructive"
                          onClick={() =>
                            runAction(() =>
                              deleteInsightMutation.mutateAsync(insight.id),
                            )
                          }
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {overview && insights.length > 6 && (
          <div className="mt-3 text-left">
            <Link
              to="/app/$projectid/insights"
              params={{ projectid: projectId }}
              search={{ favorites: true }}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              View all favorite insights
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
