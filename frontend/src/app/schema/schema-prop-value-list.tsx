import {useEffect, useRef, useState} from "react"
import {Input} from "@/components/ui/input"
import {Dialog, DialogContent, DialogHeader, DialogTitle,} from "@/components/ui/dialog"
import {usePropValues} from "@/services/schemas.ts"
import {useProjectId} from "@/hooks/use-project-id.tsx"
import {useVirtualizer} from '@tanstack/react-virtual'
import {cn} from "@lib/utils/tailwind.ts"

export function SchemaPropValueList({propId, isOpen, onClose, fieldName}: {
    propId: number
    isOpen: boolean
    onClose: () => void
    fieldName: string
}) {
    const [search, setSearch] = useState("")
    const projectId = useProjectId()
    const parentRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        setSearch("")
    }, [propId, isOpen])
    const propQuery = usePropValues(projectId, propId, isOpen)
    const values = propQuery.data ?? []

    // Filter values based on search
    const filteredValues = values.filter(value =>
        value.toLowerCase().includes(search.toLowerCase())
    )

    console.log(search, values, filteredValues)

    const virtualizer = useVirtualizer({
        count: filteredValues.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 36,
        overscan: 5,
    })

    useEffect(() => {
        virtualizer.measure() // hack to force virtualizer to update
    }, [propId, isOpen]);


    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            key={propId}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Values for {fieldName}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    <Input
                        placeholder="Search values..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full"
                        autoFocus
                    />
                    <div className="rounded-md border border-input">
                        {filteredValues.length === 0 ? (
                            <p
                                className="p-4 text-sm text-muted-foreground text-center h-[400px]"
                            >
                                No results found.
                            </p>
                        ) : (
                            <div
                                ref={parentRef}
                                className="h-[400px] overflow-auto"
                            >
                                <div
                                    style={{
                                        height: `${virtualizer.getTotalSize()}px`,
                                        width: '100%',
                                        position: 'relative',
                                    }}
                                >
                                    {virtualizer.getVirtualItems().map((virtualRow) => (
                                        <div
                                            key={virtualRow.index}
                                            className={cn(
                                                "absolute top-0 left-0 w-full",
                                                "px-2 py-1.5 text-sm",
                                            )}
                                            style={{
                                                height: `${virtualRow.size}px`,
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                        >
                                            {filteredValues[virtualRow.index]}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
