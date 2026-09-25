import {PathInsight} from "@/model/insights/path-insight.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useMemo} from "react";
import {buildPathQuery} from "@lib/insight-queries.ts";
import {simpleHash} from "@lib/checksums.ts";
import {useDuckDBQuery} from "@/services/duck-db-queries.ts";
import {Spinner} from "@/components/spinner.tsx";
import {MoveRight} from "lucide-react";

interface Props {
    insight: PathInsight
}

interface PathRow {
    source_step: string
    target_step: string
    step_distance: bigint | number | string
    result_value: bigint | number | string
}

export function PathInsightChart({insight}: Props) {
    const projectId = useProjectId()
    const query = useMemo(() => ({
        query: buildPathQuery(insight.config.path),
        hash: simpleHash(JSON.stringify(insight.config.path)),
    }), [insight])
    const result = useDuckDBQuery(projectId, `path-${query.hash}`, query.query)

    if (result.isPending || result.isLoading) return <Spinner/>
    if (result.error) return <div className="text-sm text-red-600">Error: {result.error.message}</div>

    const rows = (result.data ?? []) as PathRow[]
    if (rows.length === 0) {
        return <div className="py-6 text-sm text-muted-foreground">No paths found for actors in this range.</div>
    }

    const maxValue = Math.max(...rows.map(row => Number(row.result_value)))
    return (
        <div className="space-y-3">
            {rows.map((row) => {
                const value = Number(row.result_value)
                const distance = Number(row.step_distance)
                const width = maxValue > 0 ? (value / maxValue) * 100 : 0
                return (
                    <div key={JSON.stringify([row.source_step, row.target_step, distance])} className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="max-w-[45%] truncate font-medium" title={row.source_step}>{row.source_step}</span>
                            <MoveRight className="h-4 w-4 shrink-0 text-muted-foreground"/>
                            <span className="max-w-[45%] truncate font-medium" title={row.target_step}>{row.target_step}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                                {distance} {distance === 1 ? 'step' : 'steps'} {insight.config.path.direction === 'backward' ? 'before' : 'after'}
                            </span>
                            <span className="ml-auto tabular-nums text-muted-foreground">{value}</span>
                        </div>
                        <div className="h-2 rounded-sm bg-muted">
                            <div className="h-2 rounded-sm bg-chart-2" style={{width: `${width}%`}}/>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
