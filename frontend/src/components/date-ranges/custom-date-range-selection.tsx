import {DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog.tsx";
import {Alert, AlertDescription} from "@/components/ui/alert.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Input} from "@/components/ui/input.tsx";
import {format} from "date-fns";
import {Button} from "@/components/ui/button.tsx";
import {useState} from "react";

import {InsightDateRange} from "@/model/InsightDateRange.ts";

type Props = {
    onChange: (range: InsightDateRange) => void
    onCancel: () => void
}

export function CustomDateRangeSelection({onChange, onCancel}: Props) {
    const [error, setError] = useState('');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    function handleCustomRange(): void {
        if(customEndDate <= customStartDate) {
            setError('End date must be after start date')
            return
        }
        if(!customStartDate) {
            setError('Start date is required')
            return
        }
        let value = `${customStartDate} -`
        if (customEndDate) {
            value += ` ${customEndDate}`
        }
        const range: InsightDateRange = {
            label: value,
            value,
        }

        onChange(range)
    }

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Custom Date Range</DialogTitle>
            </DialogHeader>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                        id="start-date"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        max={format(new Date(), 'yyyy-MM-dd')}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="end-date">End Date (optional)</Label>
                    <Input
                        id="end-date"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        max={format(new Date(), 'yyyy-MM-dd')}
                    />
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button onClick={handleCustomRange}>
                    Apply
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}
