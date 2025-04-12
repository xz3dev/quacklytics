import {useEffect, useState} from 'react'
import {ChevronDown} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu.tsx'
import {Dialog} from "@/components/ui/dialog.tsx"
import {Button} from "@/components/ui/button.tsx"
import {CustomDateRangeSelection} from "@/components/date-ranges/custom-date-range-selection.tsx"
import {IncrementalDurationSelection} from "@/components/date-ranges/incremental-duration-selection.tsx"
import {determineLabel, InsightDateRange, predefinedRanges} from "@/model/insights/insight-date-range.ts"

type Props = {
    onChange: (range: InsightDateRange) => void
    value?: string
}

const DateRangePicker = ({onChange, value}: Props) => {
    const [selectedRange, setSelectedRange] = useState<InsightDateRange | undefined>(undefined)
    const [isIncrementalModalOpen, setIsIncrementalModalOpen] = useState(false)
    const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)

    useEffect(() => {
        if (value) {
            setSelectedRange({
                value,
                label: determineLabel(value)
            })
        } else {
            setSelectedRange({
                value: 'P30D',
                label: determineLabel('P30D')
            })
        }
    }, [value])


    const handleSelection = (range: InsightDateRange) => {
        setSelectedRange(range)
        onChange(range)
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant='outline'>
                        {selectedRange ? selectedRange?.label : 'Select date range'}
                        <ChevronDown/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {predefinedRanges.map((range) => (
                        <DropdownMenuItem
                            key={range.value}
                            onSelect={() => handleSelection(range)}
                        >
                            {range.label}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem onSelect={() => setIsCustomModalOpen(true)}>
                        Custom Date Range
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsIncrementalModalOpen(true)}>
                        Incremental Selection
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Custom Date Range Modal */}
            <Dialog open={isCustomModalOpen} onOpenChange={(open) => {
                setIsCustomModalOpen(open)
            }}>
                <CustomDateRangeSelection
                    onChange={(r) => {
                        handleSelection(r)
                        setIsCustomModalOpen(false)
                    }}
                    onCancel={() => {
                        setIsCustomModalOpen(false)
                    }}
                />
            </Dialog>

            {/* Incremental Selection Modal */}
            <Dialog open={isIncrementalModalOpen} onOpenChange={setIsIncrementalModalOpen}>
                <IncrementalDurationSelection
                    onChange={(r) => {
                        handleSelection(r)
                        setIsIncrementalModalOpen(false)
                    }}
                    onCancel={() => {
                        setIsIncrementalModalOpen(false)
                    }}
                />
            </Dialog>
        </>
    )
}

export default DateRangePicker
