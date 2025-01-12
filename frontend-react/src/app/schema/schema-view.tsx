import {useSchema} from "@/services/schemas.ts"
import {useProjectId} from "@/hooks/use-project-id.tsx"
import {Spinner} from "@/components/spinner.tsx"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import {Badge} from "@/components/ui/badge"
import {ScrollArea} from "@/components/ui/scroll-area"

export function SchemaView() {
    const projectId = useProjectId()
    const schemaQuery = useSchema(projectId)

    if(schemaQuery.isLoading || schemaQuery.isPending) return <Spinner/>
    if(schemaQuery.error) return <div>Error: {schemaQuery.error.message}</div>

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
                                <Accordion type="single" collapsible>
                                    <AccordionItem value="properties">
                                        <AccordionTrigger>
                                            {schema.events[eventType].length} Properties
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <ScrollArea className="h-[500px] w-full rounded-md border p-4">
                                                <div className="space-y-4">
                                                    {schema.events[eventType]
                                                        .sort((a, b) => a.name.localeCompare(b.name))
                                                        .map((field) => (
                                                            <div key={field.name} className="space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium">
                                                                        {field.name}
                                                                    </span>
                                                                    <Badge variant="outline">
                                                                        {field.type}
                                                                    </Badge>
                                                                </div>
                                                                {schema.propertyValues[field.name] && (
                                                                    <div className="pl-4 text-sm text-muted-foreground">
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {schema.propertyValues[field.name]
                                                                                .slice(0, 5) // Limit to first 5 values
                                                                                .map((value) => (
                                                                                    <Badge
                                                                                        key={value}
                                                                                        variant="secondary"
                                                                                        className="text-xs"
                                                                                    >
                                                                                        {value}
                                                                                    </Badge>
                                                                                ))}
                                                                            {schema.propertyValues[field.name].length > 5 && (
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className="text-xs"
                                                                                >
                                                                                    +{schema.propertyValues[field.name].length - 5} more
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                </div>
                                            </ScrollArea>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
