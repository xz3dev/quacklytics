// In schema-view.tsx
import {useSchema} from "@/services/schemas.ts"
import {useProjectId} from "@/hooks/use-project-id.tsx"
import {Spinner} from "@/components/spinner.tsx"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table"
import {Badge} from "@/components/ui/badge"
import {SchemaPropValueList} from "@app/schema/schema-prop-value-list.tsx"
import {useEffect, useMemo, useState} from "react"
import {Input} from "@/components/ui/input"

export function SchemaView() {
    const projectId = useProjectId()
    const schemaQuery = useSchema(projectId)
    const [selectedProp, setSelectedProp] = useState<{ id: number, name: string } | null>(null)
    const [filter, setFilter] = useState("")

    if (schemaQuery.isLoading || schemaQuery.isPending) return <Spinner/>
    if (schemaQuery.error) return <div>Error: {schemaQuery.error.message}</div>

    const schema = schemaQuery.data

    const filteredEvents = useMemo(() => {
        const searchTerm = filter.toLowerCase()
        return Object.entries(schema.events)
            .filter(([eventType]) =>
                eventType.toLowerCase().includes(searchTerm)
            )
            .sort(([a], [b]) => a.localeCompare(b))
    }, [schema.events, filter])

    useEffect(() => {
        console.log(`prop: ${selectedProp}`)
    }, [selectedProp])

    return (
        <div>
            <div className="flex items-center justify-between mt-4 mb-8">
                <h1 className="text-2xl font-bold">Event Schema</h1>
                <Input
                    placeholder="Filter events..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="max-w-sm"
                />
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Event Type</TableHead>
                            <TableHead>Properties</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEvents.length > 0 ? (
                            filteredEvents.map(([eventType, properties]) => (
                                <TableRow
                                    key={eventType}
                                    className="hover:bg-transparent"
                                >
                                    <TableCell className="font-medium">
                                        {eventType}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-2">
                                            {properties
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((field) => (
                                                    <Badge
                                                        key={field.id}
                                                        variant="secondary"
                                                        className="cursor-pointer hover:bg-secondary/80"
                                                        onClick={() => setSelectedProp({ id: field.id, name: field.name })}
                                                    >
                                                        {field.name}
                                                    </Badge>
                                                ))}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={2}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {selectedProp && (
                <SchemaPropValueList
                    key={selectedProp.id}
                    propId={selectedProp.id}
                    isOpen={true}
                    onClose={() => setSelectedProp(null)}
                    fieldName={selectedProp.name}
                />
            )}
        </div>
    )
}
