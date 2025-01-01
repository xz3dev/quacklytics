// src/components/filters/FilterSelectorCard.tsx
import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {Field, FieldFilter, Operator} from "@/model/filters.ts";

const ALL_OPERATORS: Operator[] = ['=', '>', '<', '>=', '<=', '<>', 'LIKE', 'IN']

interface Props {
    initialFilter?: FieldFilter
    onSave: (filter: FieldFilter) => void
    onDiscard: () => void
    availableFields: Field[]
    propertyValues: Record<string, string[]>
    eventTypes: string[]
}

export function FilterSelectorCard({
                                       initialFilter,
                                       onSave,
                                       onDiscard,
                                       availableFields,
                                       propertyValues,
                                       eventTypes,
                                   }: Props) {
    const [currentField, setCurrentField] = useState<Field | null>(null)
    const [currentOperator, setCurrentOperator] = useState<Operator>('=')
    const [currentValue, setCurrentValue] = useState('')
    const [openField, setOpenField] = useState(false)
    const [openValue, setOpenValue] = useState(false)

    useEffect(() => {
        if (initialFilter) {
            setCurrentField(initialFilter.field)
            setCurrentOperator(initialFilter.operator)
            setCurrentValue(initialFilter.value)
        }
    }, [initialFilter])

    const handleSave = () => {
        if (currentField && currentValue) {
            onSave({
                field: currentField,
                operator: currentOperator,
                value: currentValue,
            })
        }
    }

    return (
        <Card className="w-full max-w-md border-0 shadow-none">
            <CardHeader>
                <CardTitle>
                    {initialFilter ? 'Edit Filter' : 'Add Filter'}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Field Selector */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Field</label>
                    <Popover open={openField} onOpenChange={setOpenField}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                            >
                                {currentField ? (
                                    <>
                                        {currentField.name}
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            {currentField.type}
                                        </span>
                                    </>
                                ) : (
                                    'Select field...'
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0">
                            <Command>
                                <CommandInput placeholder="Search field..." />
                                <CommandEmpty>No field found.</CommandEmpty>
                                <CommandGroup>
                                    {availableFields.map((field) => (
                                        <CommandItem
                                            key={field.name}
                                            onSelect={() => {
                                                setCurrentField(field)
                                                setOpenField(false)
                                            }}
                                        >
                                            <Check
                                                className={`mr-2 h-4 w-4 ${
                                                    currentField?.name === field.name
                                                        ? 'opacity-100'
                                                        : 'opacity-0'
                                                }`}
                                            />
                                            {field.name}
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                {field.type}
                                            </span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Operator Selector */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Operator</label>
                    <Select
                        value={currentOperator}
                        onValueChange={(value) => setCurrentOperator(value as Operator)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select operator" />
                        </SelectTrigger>
                        <SelectContent>
                            {ALL_OPERATORS.map((op) => (
                                <SelectItem key={op} value={op}>
                                    {op}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Value Selector */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Value</label>
                    <Popover open={openValue} onOpenChange={setOpenValue}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                            >
                                {currentValue || 'Enter value...'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0">
                            <Command>
                                <CommandInput
                                    placeholder="Enter value"
                                    value={currentValue}
                                    onValueChange={setCurrentValue}
                                />
                                <CommandEmpty>No suggestion found.</CommandEmpty>
                                <CommandGroup className="max-h-[300px] overflow-y-auto">
                                    {currentField?.name === 'event_type'
                                        ? eventTypes.map((type) => (
                                            <CommandItem
                                                key={type}
                                                onSelect={() => {
                                                    setCurrentValue(type)
                                                    setOpenValue(false)
                                                }}
                                            >
                                                <Check
                                                    className={`mr-2 h-4 w-4 ${
                                                        currentValue === type
                                                            ? 'opacity-100'
                                                            : 'opacity-0'
                                                    }`}
                                                />
                                                {type}
                                            </CommandItem>
                                        ))
                                        : propertyValues[currentField?.name ?? '']?.map(
                                            (val) => (
                                                <CommandItem
                                                    key={val}
                                                    onSelect={() => {
                                                        setCurrentValue(val)
                                                        setOpenValue(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={`mr-2 h-4 w-4 ${
                                                            currentValue === val
                                                                ? 'opacity-100'
                                                                : 'opacity-0'
                                                        }`}
                                                    />
                                                    {val}
                                                </CommandItem>
                                            )
                                        )}
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
                <Button variant="outline" onClick={onDiscard}>
                    {initialFilter ? 'Cancel' : 'Discard'}
                </Button>
                <Button onClick={handleSave}>
                    {initialFilter ? 'Update' : 'Create'}
                </Button>
            </CardFooter>
        </Card>
    )
}
