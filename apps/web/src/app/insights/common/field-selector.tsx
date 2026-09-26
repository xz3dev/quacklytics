import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import { Field } from "@/model/filters.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { useSchema } from "@/services/schemas.ts";
import { cn } from "@lib/utils/tailwind.ts";
import { useMemo, useState } from "react";

interface Props {
  value?: Field;
  onChange: (field: Field) => void;
  allowedTypes?: string[];
  placeholder?: string;
  ariaLabel?: string;
}

const EVENT_FIELDS: Field[] = [
  { name: "event_type", type: "string" },
  { name: "session_id", type: "string" },
  { name: "person_id", type: "string" },
  { name: "timestamp", type: "timestamp" },
];

export function FieldSelector({
  value,
  onChange,
  allowedTypes,
  placeholder,
  ariaLabel,
}: Props) {
  const projectId = useProjectId();
  const schema = useSchema(projectId);
  const [open, setOpen] = useState(false);

  const fields = useMemo(() => {
    const allFields = [
      ...EVENT_FIELDS,
      ...(schema.data?.uniqueProperties ?? []),
    ];
    if (!allowedTypes?.length) return allFields;
    return allFields.filter((field) => allowedTypes.includes(field.type));
  }, [schema.data, allowedTypes]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          className="w-full justify-between"
        >
          <span className="truncate">
            {value?.name ?? placeholder ?? "Select field"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search field..." />
          <CommandEmpty>No field found.</CommandEmpty>
          <CommandList>
            {fields.map((field) => (
              <CommandItem
                key={`${field.name}-${field.type}`}
                onSelect={() => {
                  onChange(field);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value?.name === field.name ? "opacity-100" : "opacity-0",
                  )}
                />
                <span>{field.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {field.type}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
