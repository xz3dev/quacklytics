// trend-insight-series-aggregation-selection.tsx
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import {Button} from "@/components/ui/button"
import {Check, ChevronDown, ChevronsUpDown} from "lucide-react"
import {Field} from "@/model/filters"
import {AggregationFunction} from "@lib/aggregations"
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover"
import {Command, CommandEmpty, CommandInput, CommandItem, CommandList} from "@/components/ui/command"
import {useSchema} from "@/services/schemas"
import {useProjectId} from "@/hooks/use-project-id"
import {cn} from "@/lib/utils"

interface TrendAggregationOptions {
    name: string
    func: AggregationFunction
    distinct?: Field
    resetField?: boolean
}

const TREND_AGGREGATION_OPTIONS: TrendAggregationOptions[] = [
    {
        name: 'Count',
        func: 'COUNT',
        distinct: { name: 'id', type: 'string' },
        resetField: true
    },
    {
        name: 'Distinct Users',
        func: 'COUNT',
        distinct: { name: 'user_id', type: 'string' },
        resetField: true
    },
    {
        name: 'Sum',
        func: 'SUM'
    },
    {
        name: 'Average',
        func: 'AVG'
    },
    {
        name: 'Minimum',
        func: 'MIN'
    },
    {
        name: 'Maximum',
        func: 'MAX'
    }
]

const AGGREGATIONS_REQUIRING_FIELD: AggregationFunction[] = ['SUM', 'AVG', 'MIN', 'MAX']

interface TrendAggregationSelectorProps {
    currentFunction: AggregationFunction
    selectedField?: Field
    onSelect: (func: AggregationFunction, field?: Field, distinct?: boolean) => void
}

export function TrendInsightSeriesAggregationSelection({
                                                           currentFunction,
                                                           selectedField,
                                                           onSelect
                                                       }: TrendAggregationSelectorProps) {
    const projectId = useProjectId()
    const schemaQuery = useSchema(projectId)

    const availableFields = [
        { name: 'event_type', type: 'string' as const },
        { name: 'timestamp', type: 'timestamp' as const },
        ...(schemaQuery.data?.uniqueProperties ?? [])
    ].filter(field => field.type === 'number')

    const needsFieldSelection = AGGREGATIONS_REQUIRING_FIELD.includes(currentFunction)

    const isDistinctUsers = currentFunction === 'COUNT' && selectedField?.name === 'user_id'

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        {isDistinctUsers ? 'Distinct Users' : currentFunction}
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {TREND_AGGREGATION_OPTIONS.map((option) => (
                        <DropdownMenuItem
                            key={`${option.func}-${option.name}`}
                            onClick={() => {
                                const needsNumberField = AGGREGATIONS_REQUIRING_FIELD.includes(option.func)
                                const firstNumberField = availableFields.find(f => f.type === 'number')

                                const field = option.resetField
                                    ? option.distinct
                                    : selectedField?.type === 'number' || !needsNumberField ? selectedField : firstNumberField

                                onSelect(
                                    option.func,
                                    field,
                                    !!option.distinct
                                );
                            }}
                        >
                            {option.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {needsFieldSelection && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                            role="combobox"
                        >
                            {selectedField?.name || 'Select property'}
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                        <Command>
                            <CommandInput placeholder="Search property..." />
                            <CommandEmpty>No property found.</CommandEmpty>
                            <CommandList>
                                {availableFields?.map((field) => (
                                    <CommandItem
                                        key={field.name}
                                        onSelect={() => onSelect(currentFunction, field, false)}
                                        className="flex items-center gap-2"
                                    >
                                        <Check
                                            className={cn(
                                                "h-4 w-4",
                                                selectedField?.name === field.name
                                                    ? "opacity-100"
                                                    : "opacity-0"
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
            )}
        </div>
    )
}
