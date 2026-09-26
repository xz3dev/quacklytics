import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { FilterSelectorCard } from "@/components/filters/filter-selector-card.tsx";
import { FilterSelector } from "@/components/filters/filter-selector.tsx";
import { FieldFilter } from "@/model/filters.ts";

interface Props {
  filters?: FieldFilter[];
  onAdd: (filter: FieldFilter) => void;
  onUpdate: (index: number, filter: FieldFilter) => void;
  onRemove: (index: number) => void;
  addLabel?: string;
}

export function QueryFilterOptions({
  filters = [],
  onAdd,
  onUpdate,
  onRemove,
  addLabel = "Add Filter",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 gap-y-1">
      {filters.map((filter, index) => (
        <FilterSelector
          key={index}
          filter={filter}
          onSave={(updated) => onUpdate(index, updated)}
          onRemove={() => onRemove(index)}
        />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Plus className="h-4 w-4 mr-2" />
            {addLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          {open && (
            <FilterSelectorCard
              onSave={(filter) => {
                onAdd(filter);
                setOpen(false);
              }}
              onDiscard={() => setOpen(false)}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
