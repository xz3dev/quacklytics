import {useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu.tsx';
import {Dialog} from "@/components/ui/dialog.tsx"
import {Button} from "@/components/ui/button.tsx"
import {CustomDateRangeSelection} from "@/components/date-ranges/custom-date-range-selection.tsx";
import {IncrementalDurationSelection} from "@/components/date-ranges/incremental-duration-selection.tsx";

const predefinedRanges = [
    {label: 'Today', value: 'today'},
    {label: 'Yesterday', value: 'yesterday'},
    {label: 'Last 24 hours', value: 'P24H'},
    {label: 'Last 7 days', value: 'P7D'},
    {label: 'Last 14 days', value: 'P14D'},
    {label: 'Last 30 days', value: 'P30D'},
    {label: 'Last 90 days', value: 'P90D'},
    {label: 'Last 180 days', value: 'P180D'},
    {label: 'This month', value: 'thisMonth'},
    {label: 'Year to date', value: 'yearToDate'},
    {label: 'All time', value: 'allTime'},
];

export type SelectedDateRange = {
    label: string
    value: string
}

type Props = {
    onChange: (range: SelectedDateRange) => void
}

const DateRangePicker = ({onChange}: Props) => {
    const [selectedRange, setSelectedRange] = useState<SelectedDateRange | undefined>(undefined);
    const [isIncrementalModalOpen, setIsIncrementalModalOpen] = useState(false);
    const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

    const handlePredefinedSelection = (range: SelectedDateRange) => {
        setSelectedRange(range)
        onChange(range)
    };

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
                            onSelect={() => handlePredefinedSelection(range)}
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
                        setSelectedRange(r)
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
                        setSelectedRange(r)
                        setIsIncrementalModalOpen(false)
                    }}
                    onCancel={() => {
                        setIsIncrementalModalOpen(false)
                    }}
                />
            </Dialog>
        </>
    );
};

export default DateRangePicker;
