import {useSchema} from "@/services/schemas.ts"
import {useProjectId} from "@/hooks/use-project-id.tsx"
import {Spinner} from "@/components/spinner.tsx"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table"
import {Badge} from "@/components/ui/badge"
import {SchemaPropValueList} from "@app/schema/schema-prop-value-list.tsx";
import {useState} from "react";

export function SchemaView() {
    const projectId = useProjectId()
    const schemaQuery = useSchema(projectId)
    const [selectedField, setSelectedField] = useState<number | null>(null)

    if (schemaQuery.isLoading || schemaQuery.isPending) return <Spinner/>
    if (schemaQuery.error) return <div>Error: {schemaQuery.error.message}</div>

    const schema = schemaQuery.data
    const eventTypes = Object.keys(schema.events).sort()

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Event Schema</h1>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[200px]">Event Type</TableHead>
                        <TableHead>Properties</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {eventTypes.map((eventType) => (
                        <TableRow key={eventType}>
                            <TableCell className="font-medium">
                                {eventType}
                            </TableCell>

                            <TableCell>
                                <div className="flex flex-wrap gap-2">
                                    {schema.events[eventType]
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map((field) => (
                                            <>
                                                <Badge
                                                    key={field.name}
                                                    variant="secondary"
                                                    className="cursor-pointer hover:bg-secondary/80 flex items-center gap-2"
                                                    onClick={() => setSelectedField(field.id)}
                                                >
                                                    {field.name}
                                                </Badge>
                                                <SchemaPropValueList
                                                    propId={field.id}
                                                    isOpen={selectedField === field.id}
                                                    onClose={() => setSelectedField(null)}
                                                    fieldName={field.name}
                                                />
                                            </>
                                        ))}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
