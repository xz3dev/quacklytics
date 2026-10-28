import { PageHeader, PageTitle } from "@/components/page-header";
import { useMemo, useState } from "react";
import { ChevronRight, Copy, Database, Search } from "lucide-react";
import { toast } from "sonner";
import { useSchema, type Schema, type FieldWithId } from "@/services/schemas";
import { useProjectId } from "@/hooks/use-project-id";
import { Spinner } from "@/components/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/tailwind";
import { SchemaPropValueList } from "./schema-prop-value-list";

export function SchemaView() {
  const projectId = useProjectId();
  const query = useSchema(projectId);

  if (query.isPending || query.isPlaceholderData) return <Spinner />;
  if (query.error)
    return (
      <div role="alert" className="space-y-3 p-6">
        <p>Could not load event schema: {query.error.message}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );

  return (
    <div className="min-w-0">
      <PageHeader>
        <PageTitle>Event Schema</PageTitle>
      </PageHeader>
      <SchemaBrowser key={projectId} schema={query.data} />
    </div>
  );
}

function SchemaBrowser({ schema }: { schema: Schema }) {
  const [filter, setFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedProp, setSelectedProp] = useState<FieldWithId | null>(null);
  const events = useMemo(
    () =>
      Object.entries(schema.events)
        .map(([name, properties]) => ({
          name,
          properties: [...properties].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [schema.events],
  );
  const search = filter.trim().toLowerCase();
  const filteredEvents = events.filter((event) =>
    event.name.toLowerCase().includes(search),
  );
  const selectedEvent =
    filteredEvents.find((event) => event.name === selectedName) ??
    filteredEvents[0];
  const propertySearch = propertyFilter.trim().toLowerCase();
  const filteredProperties =
    selectedEvent?.properties.filter((field) =>
      field.name.toLowerCase().includes(propertySearch),
    ) ?? [];

  return (
    <div className="grid min-w-0 overflow-hidden rounded-xl border border-border/50 bg-card lg:h-[calc(100dvh-7rem)] lg:min-h-128 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
      <section
        aria-label="Events"
        className="flex min-h-0 min-w-0 flex-col border-b border-border/50 lg:border-b-0 lg:border-r"
      >
        <div className="p-4">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Search events"
              placeholder="Search events..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ul
          aria-label="Event list"
          className="max-h-80 flex-1 overflow-y-auto p-2 lg:max-h-none"
        >
          {filteredEvents.map((event) => (
            <li key={event.name}>
              <button
                type="button"
                aria-label={event.name}
                aria-pressed={selectedEvent?.name === event.name}
                onClick={() => setSelectedName(event.name)}
                className={cn(
                  "my-1 flex w-full items-center gap-3 rounded-md px-4 py-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  selectedEvent?.name === event.name
                    ? "bg-accent"
                    : "hover:bg-muted",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium wrap-anywhere">
                    {event.name}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {event.properties.length} properties
                  </p>
                  <div
                    className="mt-3 flex flex-wrap gap-1.5"
                    aria-hidden="true"
                  >
                    {event.properties.slice(0, 3).map((property) => (
                      <Badge
                        key={property.id}
                        variant="secondary"
                        className="max-w-full truncate px-2 font-normal"
                      >
                        {property.name}
                      </Badge>
                    ))}
                    {event.properties.length > 3 && (
                      <span className="py-0.5 text-xs text-muted-foreground">
                        +{event.properties.length - 3}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </button>
            </li>
          ))}
        </ul>
        {filteredEvents.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            <p>
              {events.length === 0
                ? "No events yet. Send your first event to explore its schema."
                : "No events match your filters."}
            </p>
            {events.length > 0 && (
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setFilter("")}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </section>

      <section
        aria-label="Event inspector"
        className="min-w-0 overflow-y-auto p-4"
      >
        {selectedEvent ? (
          <>
            <h2 className="text-xl font-semibold tracking-tight xl:text-2xl">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="group inline-flex max-w-full items-center gap-2 rounded-sm text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            selectedEvent.name,
                          );
                          toast.success("Event name copied");
                        } catch {
                          toast.error("Could not copy event name");
                        }
                      }}
                    >
                      <span className="min-w-0 wrap-anywhere">
                        {selectedEvent.name}
                      </span>
                      <Copy
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Copy event name</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h2>
            <div className="relative mb-5 mt-6">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Search properties"
                placeholder="Search properties..."
                value={propertyFilter}
                onChange={(event) => setPropertyFilter(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>
                      <span className="sr-only">Values</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProperties.map((field) => (
                    <TableRow
                      key={field.id}
                      onClick={() => setSelectedProp(field)}
                      className="cursor-pointer"
                    >
                      <TableCell className="max-w-0">
                        <button
                          type="button"
                          className="rounded-sm text-left text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring wrap-anywhere"
                        >
                          {field.name}
                        </button>
                      </TableCell>
                      <TableCell className="w-24">
                        <Badge variant="secondary" className="font-normal">
                          {field.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-10 px-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`View values for ${field.name}`}
                        >
                          <ChevronRight />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredProperties.length === 0 && (
                <p role="status" className="p-6 text-sm text-muted-foreground">
                  {selectedEvent.properties.length === 0
                    ? "This event has no properties."
                    : "No properties match your search."}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-48 h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Database className="size-7" />
            <p className="text-sm">
              Select an event to inspect its properties.
            </p>
          </div>
        )}
      </section>
      {selectedProp && (
        <SchemaPropValueList
          key={selectedProp.id}
          propId={selectedProp.id}
          isOpen={true}
          onClose={() => setSelectedProp(null)}
          fieldName={selectedProp.name}
        />
      )}
    </div>
  );
}
