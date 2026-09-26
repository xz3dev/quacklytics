import { PageHeader, PageTitle } from "@/components/page-header";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FieldFilter } from "@/model/filters";
import { QueryFilterOptions } from "@/app/insights/common/query-filter-options";
import { useProjectId } from "@/hooks/use-project-id";
import { buildEventsQuery } from "@/lib/events-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistance } from "date-fns";
import { JsonViewerThemed } from "@/components/json-viewer-themed.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDuckDb } from "@app/duckdb/duckdb-provider.tsx";

export function EventsList() {
  const projectId = useProjectId();
  return <ProjectEventsList key={projectId} projectId={projectId} />;
}

function ProjectEventsList({ projectId }: { projectId: string }) {
  const [filters, setFilters] = useState<FieldFilter[]>([]);
  const db = useDuckDb();
  const results = useQuery({
    queryKey: ["duckdb", projectId, "events", filters],
    queryFn: () => {
      const query = buildEventsQuery(filters);
      return db.runEventsQuery(query.sql, query.params);
    },
    retry: false,
  });
  const events = results.data ?? [];

  return (
    <div className="min-w-0">
      <PageHeader>
        <PageTitle>Events</PageTitle>
      </PageHeader>
      <div className="space-y-4">
        <div className="space-y-4 rounded-xl border border-border/50 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">Filter events</h2>
              <p className="text-sm text-muted-foreground">
                Show the latest 100 events matching all filters.
              </p>
            </div>
            {filters.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFilters([])}>
                Clear filters
              </Button>
            )}
          </div>
          <QueryFilterOptions
            filters={filters}
            onAdd={(filter) => setFilters((current) => [...current, filter])}
            onUpdate={(index, filter) =>
              setFilters((current) =>
                current.map((entry, i) => (i === index ? filter : entry)),
              )
            }
            onRemove={(index) =>
              setFilters((current) => current.filter((_, i) => i !== index))
            }
          />
          {results.error && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 text-destructive text-sm"
            >
              Could not load events: {results.error.message}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void results.refetch()}
              >
                Try again
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Person ID</TableHead>
                  <TableHead>Properties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(results.isPending ||
                  results.isError ||
                  events.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                      role="status"
                    >
                      {results.isPending
                        ? "Loading events…"
                        : results.isError
                          ? "Events could not be loaded."
                          : filters.length
                            ? "No events match your filters."
                            : "No events yet."}
                    </TableCell>
                  </TableRow>
                )}
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      {event.eventType}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-xs text-muted-foreground">
                            {formatDistance(event.timestamp, new Date(), {
                              addSuffix: true,
                            })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>{event.timestamp.toLocaleString()}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">
                        {event.personId}
                      </code>
                    </TableCell>
                    <TableCell>
                      <pre className="max-w-md text-xs min-w-[200px]">
                        <JsonViewerThemed
                          json={event.properties}
                          rootName="props"
                        />
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
