import { useState } from "react";
import {
  BarChart3,
  ChevronsUpDown,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dashboard } from "@/model/dashboard";
import { useInsights } from "@/services/insights";
import { useProjectId } from "@/hooks/use-project-id";
import { useSetDashboardInsights } from "@/services/dashboards";

interface Props {
  dashboard: Dashboard;
}

export function DashboardManageInsights({ dashboard }: Props) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedInsights, setSelectedInsights] = useState<number[]>([]);
  const projectId = useProjectId();
  const setInsightsMutation = useSetDashboardInsights(projectId);
  const allInsightsQuery = useInsights(projectId);
  const allInsights = allInsightsQuery.data ?? [];
  const insightsById = new Map(
    [...dashboard.insights, ...allInsights].map((insight) => [
      insight.id,
      insight,
    ]),
  );
  const selectedCharts = selectedInsights.flatMap((id) => {
    const insight = insightsById.get(id);
    return insight ? [insight] : [];
  });
  const availableCharts = allInsights.filter(
    (insight) => !selectedInsights.includes(insight.id),
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (setInsightsMutation.isPending) return;
    if (nextOpen) {
      setSelectedInsights(dashboard.insights.map((insight) => insight.id));
      setInsightsMutation.reset();
    }
    setPickerOpen(false);
    setOpen(nextOpen);
  };

  const handleSave = () => {
    setInsightsMutation.mutate(
      { dashboardId: dashboard.id, insightIds: selectedInsights },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Settings2 className="h-4 w-4 mr-2" />
          Manage Insights
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-6 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Manage Dashboard Insights</DialogTitle>
          <DialogDescription>
            Search for charts to add to your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <span
            id="dashboard-chart-picker-label"
            className="text-sm font-medium"
          >
            Add a chart
          </span>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={pickerOpen}
                aria-labelledby="dashboard-chart-picker-label"
                disabled={setInsightsMutation.isPending}
                className="w-full justify-between gap-2 font-normal text-muted-foreground"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Search charts...</span>
                <ChevronsUpDown className="h-4 w-4 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-(--radix-popover-trigger-width) p-1"
            >
              <Command>
                <CommandInput
                  placeholder="Search charts..."
                  aria-label="Search charts"
                />
                <CommandList className="max-h-[min(260px,40dvh)]">
                  {allInsightsQuery.isPending ? (
                    <div
                      role="status"
                      className="p-4 text-sm text-muted-foreground"
                    >
                      Loading charts...
                    </div>
                  ) : allInsightsQuery.isError ? (
                    <div role="alert" className="p-3 text-sm">
                      <p>Could not load charts.</p>
                      <Button
                        variant="ghost"
                        onClick={() => void allInsightsQuery.refetch()}
                      >
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>
                        {availableCharts.length === 0
                          ? "All available charts are already added."
                          : "No charts found."}
                      </CommandEmpty>
                      {availableCharts.map((insight) => (
                        <CommandItem
                          key={insight.id}
                          value={String(insight.id)}
                          keywords={[
                            insight.name ?? "Untitled chart",
                            insight.type,
                          ]}
                          onSelect={() => {
                            setSelectedInsights((current) =>
                              current.includes(insight.id)
                                ? current
                                : [...current, insight.id],
                            );
                            setPickerOpen(false);
                          }}
                          className="gap-3 py-3"
                        >
                          <BarChart3 />
                          <span className="min-w-0 flex-1 wrap-break-word">
                            {insight.name ?? "Untitled chart"}
                          </span>
                          <Plus className="text-muted-foreground" />
                        </CommandItem>
                      ))}
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <section
          aria-labelledby="dashboard-charts-heading"
          className="flex min-h-0 flex-1 flex-col gap-3"
        >
          <h3 id="dashboard-charts-heading" className="text-sm font-medium">
            Charts in this dashboard{" "}
            <span className="ml-1 text-muted-foreground">
              ({selectedInsights.length})
            </span>
          </h3>
          <div className="min-h-0 overflow-y-auto rounded-lg border">
            {selectedCharts.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                <BarChart3 className="mx-auto mb-3 h-6 w-6" />
                <p className="font-medium text-foreground">
                  No charts added yet
                </p>
                <p className="mt-1">
                  Use the search above to add your first chart.
                </p>
              </div>
            ) : (
              <ul aria-label="Selected charts" className="divide-y">
                {selectedCharts.map((insight) => (
                  <li key={insight.id} className="flex items-center gap-3 p-3">
                    <div className="rounded-md bg-muted p-2 text-muted-foreground">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="wrap-break-word text-sm font-medium">
                        {insight.name ?? "Untitled chart"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {insight.type}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground"
                      aria-label={`Remove ${insight.name ?? "Untitled chart"}`}
                      disabled={setInsightsMutation.isPending}
                      onClick={() =>
                        setSelectedInsights((current) =>
                          current.filter((id) => id !== insight.id),
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        {setInsightsMutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            Could not save changes. Please try again.
          </p>
        )}
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={setInsightsMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={setInsightsMutation.isPending}>
            {setInsightsMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
