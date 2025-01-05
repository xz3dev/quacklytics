import { useEffect, useState } from "react"
import { AnalyticsEvent } from "@/model/event"
import { useDB } from "@app/duckdb/duckdb"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatDistance } from "date-fns"

const DEFAULT_QUERY = 'SELECT * FROM events order by timestamp desc LIMIT 100 '

export function EventsViewer() {
    const db = useDB()
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
        <div className="space-y-4 p-4">
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
                                <TableHead>User ID</TableHead>
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
                                        <div className="flex flex-col">
                                            <span>{event.timestamp.toLocaleString()}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistance(event.timestamp, new Date(), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <code className="text-xs">{event.userId}</code>
                                    </TableCell>
                                    <TableCell>
                                        <pre className="text-xs whitespace-pre-wrap max-w-md">
                                            {JSON.stringify(event.properties, null, 2)}
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
