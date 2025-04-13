import {FunnelInsight} from "@/model/insights/funnel-insights.ts";
import {determineDateRange} from "@/model/insights/insight-date-range.ts";
import {buildFunnelQuery} from "@lib/funnel-queries.ts";
import {useDuckDBQuery} from "@/services/duck-db-queries.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {simpleHash} from "@lib/checksums.ts";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table"

interface FunnelInsightResultsProps {
    insight: FunnelInsight
}

export function FunnelInsightResults({insight}: FunnelInsightResultsProps) {
    const projId = useProjectId()
    const conf = insight.config.funnel

    const timeFrame = determineDateRange(conf.duration ?? 'P30D')

    const q = buildFunnelQuery(conf.steps ?? [], 'events', timeFrame.start, timeFrame.end)

    const results = useDuckDBQuery(
        projId,
        `funnel-${simpleHash(JSON.stringify(conf))}`,
        q,
    )

    const stepData = results.data?.[0] ? Object.entries(results.data[0]).map(([k, v], index) => ({
        step: conf.steps?.[index],
        name: k,
        value: v.toString(),
    })) : undefined
    return <>
        <div className="flex flex-col w-full white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(stepData?.length ?? 0) > 0 ? (
                        stepData?.map((step, index) => (
                            <TableRow key={index} className="hover:bg-transparent">
                                <TableCell>{step.name}</TableCell>
                                <TableCell>{step.value}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center">
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>

        <div className="flex flex-col gap-6 mt-20">
            <pre className="border rounded-md p-4 text-xs">
                {q.sql && q.sql}
            </pre>
            <div className="border rounded-md p-4 space-y-2">
                {q.params.map((param, index) => (
                    <div key={index}>{param?.toString()}</div>
                ))}
            </div>
        </div>
    </>
}
