import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface SqlQueryResultsProps {
    data?: any
}

export function SqlQueryResults({ data }: SqlQueryResultsProps) {
    // Handle empty data case
    if (!data) {
        return (
            <Alert variant="default" className="bg-muted">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No data available</AlertTitle>
                <AlertDescription>
                    Run a query to see results.
                </AlertDescription>
            </Alert>
        )
    }

    // Handle error case
    if (data.error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Query Error</AlertTitle>
                <AlertDescription>
                    {data.error}
                </AlertDescription>
            </Alert>
        )
    }

    // Handle empty results case
    if (!Array.isArray(data) || data.length === 0) {
        return (
            <Alert variant="default" className="bg-muted">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Empty result set</AlertTitle>
                <AlertDescription>
                    The query executed successfully but returned no data.
                </AlertDescription>
            </Alert>
        )
    }

    // Extract headers from first result object
    const headers = Object.keys(data[0])

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        {headers.map((header) => (
                            <TableHead key={header}>{header}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                            {headers.map((header) => (
                                <TableCell key={`${rowIndex}-${header}`}>
                                    {formatCellValue(row[header])}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

// Helper function to format cell values appropriately
function formatCellValue(value: any): string {
    if (value === null || value === undefined) {
        return 'NULL'
    }

    if (typeof value === 'object') {
        // Handle dates
        if (value instanceof Date) {
            return value.toLocaleString()
        }

        // Handle arrays and objects by converting to JSON
        return JSON.stringify(value)
    }

    // Return primitives as strings
    return String(value)
}
