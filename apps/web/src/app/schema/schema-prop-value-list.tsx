import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePropValues } from "@/services/schemas.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, Search } from "lucide-react";

export function SchemaPropValueList({
  propId,
  isOpen,
  onClose,
  fieldName,
}: {
  propId: number;
  isOpen: boolean;
  onClose: () => void;
  fieldName: string;
}) {
  const [search, setSearch] = useState("");
  const projectId = useProjectId();
  const parentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setSearch("");
  }, [propId, isOpen]);
  const propQuery = usePropValues(projectId, propId, isOpen);
  const values = useMemo(() => propQuery.data ?? [], [propQuery.data]);

  const filteredValues = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) return values;

    return values.filter((value) => value.toLowerCase().includes(searchTerm));
  }, [search, values]);

  const virtualizer = useVirtualizer({
    count: filteredValues.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    measureElement: (element) => element?.getBoundingClientRect().height ?? 0,
    overscan: 8,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [propId, isOpen, filteredValues.length, virtualizer]);

  const valueCountLabel =
    values.length === 1 ? "1 value" : `${values.length} values`;
  const filteredCountLabel =
    filteredValues.length === 1
      ? "1 match"
      : `${filteredValues.length} matches`;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      key={propId}
    >
      <DialogContent className="w-[min(calc(100vw-2rem),56rem)] max-w-none gap-0 overflow-hidden p-0 sm:rounded-lg">
        <div className="flex max-h-[min(760px,calc(100vh-3rem))] flex-col">
          <DialogHeader className="gap-3 bg-muted/50 px-6 py-6 pr-14 text-left sm:px-8">
            <div className="min-w-0 space-y-2">
              <DialogTitle className="text-xl leading-7">
                Values for{" "}
                <span className="font-mono text-lg text-primary [overflow-wrap:anywhere]">
                  {fieldName}
                </span>
              </DialogTitle>
              <DialogDescription className="text-sm leading-6">
                {search.trim()
                  ? `${filteredCountLabel} from ${valueCountLabel}`
                  : valueCountLabel}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 px-6 py-6 sm:px-8">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search values..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full pl-10 text-sm"
                autoFocus
              />
            </div>

            {propQuery.isLoading || propQuery.isPending ? (
              <div className="flex h-[min(52vh,430px)] items-center justify-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading values...
              </div>
            ) : filteredValues.length === 0 ? (
              <div className="flex h-[min(52vh,430px)] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                No values match this search.
              </div>
            ) : (
              <div
                ref={parentRef}
                className="h-[min(52vh,430px)] overflow-auto"
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="my-2 rounded-md bg-muted/50 px-4 py-4 font-mono text-[13px] leading-7 text-foreground/90 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {filteredValues[virtualRow.index]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
