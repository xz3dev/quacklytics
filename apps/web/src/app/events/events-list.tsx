import { PageHeader, PageTitle } from "@/components/page-header";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FieldFilter } from "@/model/filters";
import { QueryFilterOptions } from "@/app/insights/common/query-filter-options";
import { useProjectId } from "@/hooks/use-project-id";
import {
  buildEventsQuery,
  EVENT_LIMITS,
  type EventLimit,
} from "@/lib/events-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistance } from "date-fns";
import { JsonViewerThemed } from "@/components/json-viewer-themed.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDuckDb } from "@app/duckdb/duckdb-provider.tsx";
import { LiveIndicator } from "@app/duckdb/live-indicator.tsx";

export function EventsList() {
  const projectId = useProjectId();
  return <ProjectEventsList key={projectId} projectId={projectId} />;
}

function ProjectEventsList({ projectId }: { projectId: string }) {
  const [filters, setFilters] = useState<FieldFilter[]>([]);
  const [limit, setLimit] = useState<EventLimit>(100);
  const db = useDuckDb();
  const results = useQuery({
    queryKey: ["duckdb", projectId, "events", filters, limit],
    queryFn: ({ signal }) => {
      const query = buildEventsQuery(filters, limit);
      return db.runEventsQuery(query.sql, query.params, signal);
    },
    retry: false,
  });
  const events = results.data ?? [];

  return (
    <div className="min-w-0">
      <PageHeader>
        <PageTitle>Events</PageTitle>
        <LiveIndicator />
      </PageHeader>
      <div className="space-y-4">
        <div className="space-y-4 rounded-xl border border-border/50 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Filter events</h2>
            {filters.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFilters([])}>
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <QueryFilterOptions
                filters={filters}
                onAdd={(filter) =>
                  setFilters((current) => [...current, filter])
                }
                onUpdate={(index, filter) =>
                  setFilters((current) =>
                    current.map((entry, i) => (i === index ? filter : entry)),
                  )
                }
                onRemove={(index) =>
                  setFilters((current) => current.filter((_, i) => i !== index))
                }
              />
            </div>
            <Select
              value={String(limit)}
              onValueChange={(value) => {
                const next = EVENT_LIMITS.find(
                  (option) => String(option) === value,
                );
                if (next !== undefined) setLimit(next);
              }}
            >
              <SelectTrigger
                className="h-8 w-[130px] shrink-0"
                aria-label="Event limit"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_LIMITS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    Latest {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                  <TableHead>Path</TableHead>
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
                      colSpan={5}
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
                      <code className="text-xs text-muted-foreground">
                        {pagePath(event.properties)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger className="text-left">
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
                          defaultInspectDepth={1}
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

function pagePath(properties: Record<string, unknown>) {
  const context = properties["$context"];
  if (!isRecord(context) || !isRecord(context.page)) return null;
  const path = context.page.path;
  return typeof path === "string" ? path : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
