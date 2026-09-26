// src/components/filters/FilterSelector.tsx
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FieldFilter } from "@/model/filters.ts";
import { FilterSelectorCard } from "@/components/filters/filter-selector-card.tsx";
import { useState } from "react";
import { format } from "date-fns";

interface Props {
  filter: FieldFilter;
  onSave: (filter: FieldFilter) => void;
  onRemove: () => void;
}

export function FilterSelector({ filter, onSave, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 max-w-full">
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-auto min-h-8 min-w-0 whitespace-normal mr-0 rounded-r-none pr-0 text-left"
          >
            <span className="mr-2 min-w-0 break-all">
              {filter.field.name} {filter.operator}{" "}
              {filter.value instanceof Date
                ? format(filter.value, "yyyy-MM-dd HH:mm")
                : filter.value}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          {open && (
            <FilterSelectorCard
              initialFilter={filter}
              onSave={(filter) => {
                onSave(filter);
                setOpen(false);
              }}
              onDiscard={() => {
                setOpen(false);
              }}
            />
          )}
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="sm"
        className="h-auto min-h-8 shrink-0 rounded-l-none pl-2 border-l-0"
        aria-label={`Remove ${filter.field.name} filter`}
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
