import {useState} from "react"
import {Command, CommandInput, CommandList, CommandEmpty, CommandItem} from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

// Add this new component
export function SchemaPropValueList({values, isOpen, onClose, fieldName}: {
    values: string[]
    isOpen: boolean
    onClose: () => void
    fieldName: string
}) {
    const [search, setSearch] = useState("")

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Values for {fieldName}</DialogTitle>
                </DialogHeader>
                <Command>
                    <CommandInput
                        placeholder="Search values..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        {values.map((value) => (
                            <CommandItem
                                key={value}
                                className="py-2 text-sm"
                            >
                                {value}
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    )
}
