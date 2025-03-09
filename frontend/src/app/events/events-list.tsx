import {useEffect, useState} from "react"
import {AnalyticsEvent} from "@/model/event"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table"
import {Card, CardContent, CardHeader, CardTitle,} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {Textarea} from "@/components/ui/textarea"
import {formatDistance} from "date-fns"
import {db} from "@app/duckdb/duckdb.tsx";
import {JsonViewerThemed} from "@/components/json-viewer-themed.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const DEFAULT_QUERY = 'SELECT * FROM events order by timestamp desc LIMIT 100 '

export function EventsList() {
    const [events, setEvents] = useState<AnalyticsEvent[]>([])
    const [query, setQuery] = useState(DEFAULT_QUERY)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const runQuery = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const results = await db.runEventsQuery(query)
            if (results) {
                setEvents(results)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to run query')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        runQuery()
    }, [db])

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter your SQL query"
                    className="font-mono min-h-[100px]"
                />
                <div className="flex justify-between items-center">
                    <Button
                        onClick={runQuery}
                        disabled={isLoading}
                    >
                        {isLoading ? "Running..." : "Run Query"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setQuery(DEFAULT_QUERY)}
                    >
                        Reset Query
                    </Button>
                </div>
                {error && (
                    <div className="text-red-500 text-sm">{error}</div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Events</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event Type</TableHead>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Person ID</TableHead>
                                <TableHead>Properties</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.map(event => (
                                <TableRow key={event.id}>
                                    <TableCell className="font-medium">
                                        {event.eventType}
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip>
                                            <TooltipTrigger>
                                              <span className="text-xs text-muted-foreground">
                                                {formatDistance(event.timestamp, new Date(), {addSuffix: true})}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <span>{event.timestamp.toLocaleString()}</span>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>
                                        <code className="text-xs text-muted-foreground">{event.personId}</code>
                                    </TableCell>
                                    <TableCell>
                                        <pre className="max-w-md text-xs min-w-[200px]">
                                            {/*{JSON.stringify(event.properties, null, 2)}*/}
                                            <JsonViewerThemed json={event.properties} rootName="props"/>
                                        </pre>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
