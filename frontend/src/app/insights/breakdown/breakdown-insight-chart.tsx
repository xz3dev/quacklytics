import {BreakdownInsight} from "@/model/insights/breakdown-insight.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useMemo} from "react";
import {buildBreakdownQuery} from "@lib/insight-queries.ts";
import {simpleHash} from "@lib/checksums.ts";
import {useDuckDBQuery} from "@/services/duck-db-queries.ts";
import {Spinner} from "@/components/spinner.tsx";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table.tsx";

interface Props {
    insight: BreakdownInsight
}

interface BreakdownRow {
    dimension_value: string
    result_value: bigint | number | string
}

export function BreakdownInsightChart({insight}: Props) {
    const projectId = useProjectId()
    const query = useMemo(() => ({
        query: buildBreakdownQuery(insight.config.breakdown),
        hash: simpleHash(JSON.stringify(insight.config.breakdown)),
    }), [insight])
    const result = useDuckDBQuery(projectId, `breakdown-${query.hash}`, query.query)

    if (result.isPending || result.isLoading) return <Spinner/>
    if (result.error) return <div className="text-sm text-red-600">Error: {result.error.message}</div>

    const rows = (result.data ?? []) as BreakdownRow[]
    if (rows.length === 0) {
        return <div className="py-6 text-sm text-muted-foreground">No matching events.</div>
    }

    const maxValue = Math.max(...rows.map(row => Number(row.result_value)))

    return (
        <div className="space-y-3">
            {rows.map((row) => {
                const value = Number(row.result_value)
                const width = maxValue > 0 ? (value / maxValue) * 100 : 0
                return (
                    <div key={row.dimension_value} className="grid grid-cols-[minmax(120px,1fr)_2fr_72px] items-center gap-3 text-sm">
                        <div className="truncate font-medium" title={row.dimension_value}>{row.dimension_value}</div>
                        <div className="h-2 rounded-sm bg-muted">
                            <div
                                className="h-2 rounded-sm bg-chart-1"
                                style={{width: `${width}%`}}
                            />
                        </div>
                        <div className="text-right tabular-nums">{value}</div>
                    </div>
                )
            })}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Value</TableHead>
                        <TableHead className="text-right">Events</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={`table-${row.dimension_value}`}>
                            <TableCell className="max-w-[240px] truncate" title={row.dimension_value}>{row.dimension_value}</TableCell>
                            <TableCell className="text-right tabular-nums">{Number(row.result_value)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
