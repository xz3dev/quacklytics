import {DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog.tsx"
import {Label} from "@/components/ui/label.tsx"
import {Button} from "@/components/ui/button.tsx"
import {Minus, Plus} from "lucide-react"
import {Input} from "@/components/ui/input.tsx"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx"
import {useState} from "react"
import {Duration} from "date-fns"
import {determineLabel, InsightDateRange} from "@/model/InsightDateRange.ts"

const units = ['days', 'months', 'years'] as const
type Unit = typeof units[number]

type Props = {
    onChange: (range: InsightDateRange) => void
    onCancel: () => void
}

export function IncrementalDurationSelection({onChange, onCancel}: Props) {
    const [incrementValue, setIncrementValue] = useState(1)
    const [incrementUnit, setIncrementUnit] = useState<Unit>('days')


    const unitMap: Record<Unit, string> = {
        'days': 'D',
        'months': 'M',
        'years': 'Y',
    }

    function handleApply() {
        const value = 'P' + incrementValue + unitMap[incrementUnit]
        const duration: Duration = {}
        duration[incrementUnit] = incrementValue
        const label = determineLabel(value)
        onChange({label, value})
    }

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Incremental Date Selection</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Increment Value</Label>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIncrementValue((prev) => Math.max(prev - 1, 1))}
                        >
                            <Minus className="h-4 w-4"/>
                        </Button>

                        <Input
                            type="number"
                            value={incrementValue}
                            onChange={(e) => setIncrementValue(Number(e.target.value))}
                            min={1}
                            className="w-20"
                        />

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIncrementValue((prev) => prev + 1)}
                        >
                            <Plus className="h-4 w-4"/>
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={incrementUnit} onValueChange={(v) => setIncrementUnit(v as Unit)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select unit"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="days">Days</SelectItem>
                            <SelectItem value="months">Months</SelectItem>
                            <SelectItem value="years">Years</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button onClick={handleApply}>
                    Apply
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}
