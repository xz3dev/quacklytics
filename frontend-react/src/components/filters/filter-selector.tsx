// src/components/filters/FilterSelector.tsx
import {X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Popover, PopoverContent, PopoverTrigger,} from '@/components/ui/popover'
import {Field, FieldFilter} from "@/model/filters.ts";
import {FilterSelectorCard} from "@/components/filters/filter-selector-card.tsx";

interface Props {
    filter: FieldFilter
    onSave: (filter: FieldFilter) => void
    onRemove: () => void
    availableFields: Field[]
    propertyValues: Record<string, string[]>
    eventTypes: string[]
}

export function FilterSelector({
                                   filter,
                                   onSave,
                                   onRemove,
                                   availableFields,
                                   propertyValues,
                                   eventTypes,
                               }: Props) {
    return (
        <div className="flex">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 mr-0 rounded-r-none pr-0"
                    >
                        <span className="mr-2">
                            {filter.field.name} {filter.operator} {filter.value}
                        </span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                    <FilterSelectorCard
                        initialFilter={filter}
                        onSave={onSave}
                        onDiscard={() => {
                        }}
                        availableFields={availableFields}
                        propertyValues={propertyValues}
                        eventTypes={eventTypes}
                    />
                </PopoverContent>
            </Popover>

            <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-l-none pl-2 border-l-0"
                onClick={onRemove}
            >
                <X className="h-4 w-4"/>
            </Button>
        </div>
    )
}
