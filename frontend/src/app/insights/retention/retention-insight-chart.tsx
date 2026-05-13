import {RetentionInsight} from "@/model/insights/retention-insight.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useMemo} from "react";
import {buildRetentionQuery} from "@lib/insight-queries.ts";
import {simpleHash} from "@lib/checksums.ts";
import {useDuckDBQuery} from "@/services/duck-db-queries.ts";
import {Spinner} from "@/components/spinner.tsx";
import {format} from "date-fns";

interface Props {
    insight: RetentionInsight
}

interface RetentionRow {
    cohort_start: string
    period_index: number
    retained_count: bigint | number | string
}

interface CohortRow {
    cohortStart: string
    cohortSize: number
    periods: Map<number, number>
}

export function RetentionInsightChart({insight}: Props) {
    const projectId = useProjectId()
    const query = useMemo(() => ({
        query: buildRetentionQuery(insight.config.retention),
        hash: simpleHash(JSON.stringify(insight.config.retention)),
    }), [insight])
    const result = useDuckDBQuery(projectId, `retention-${query.hash}`, query.query)

    if (result.isPending || result.isLoading) return <Spinner/>
    if (result.error) return <div className="text-sm text-red-600">Error: {result.error.message}</div>

    const rows = (result.data ?? []) as RetentionRow[]
    const cohorts = buildCohorts(rows)
    if (cohorts.length === 0) {
        return <div className="py-6 text-sm text-muted-foreground">No actors with retention data.</div>
    }

    const maxPeriods = Math.max(0, insight.config.retention.maxPeriods ?? 14)
    const periods = Array.from({length: maxPeriods + 1}, (_, index) => index)

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
                <thead>
                <tr>
                    <th className="sticky left-0 bg-card px-2 py-2 text-left font-medium">Cohort</th>
                    <th className="px-2 py-2 text-right font-medium">Users</th>
                    {periods.map(period => (
                        <th key={period} className="min-w-20 px-2 py-2 text-right font-medium">P{period}</th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {cohorts.map(cohort => (
                    <tr key={cohort.cohortStart} className="border-t">
                        <td className="sticky left-0 bg-card px-2 py-2 font-medium">
                            {format(new Date(cohort.cohortStart), 'yyyy-MM-dd')}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{cohort.cohortSize}</td>
                        {periods.map(period => {
                            const count = cohort.periods.get(period) ?? 0
                            const percentage = cohort.cohortSize > 0 ? (count / cohort.cohortSize) * 100 : 0
                            return (
                                <td key={period} className="px-1 py-1">
                                    <div
                                        className="rounded-sm px-2 py-2 text-right tabular-nums"
                                        style={{backgroundColor: `hsl(var(--chart-1) / ${Math.max(0.08, percentage / 100)})`}}
                                        title={`${count} retained users`}
                                    >
                                        {percentage.toFixed(0)}%
                                    </div>
                                </td>
                            )
                        })}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    )
}

function buildCohorts(rows: RetentionRow[]): CohortRow[] {
    const cohorts = new Map<string, CohortRow>()
    for (const row of rows) {
        const cohortStart = new Date(row.cohort_start).toISOString()
        const period = Number(row.period_index)
        const count = Number(row.retained_count)
        const cohort = cohorts.get(cohortStart) ?? {
            cohortStart,
            cohortSize: 0,
            periods: new Map<number, number>(),
        }
        cohort.periods.set(period, count)
        if (period === 0) cohort.cohortSize = count
        cohorts.set(cohortStart, cohort)
    }
    return Array.from(cohorts.values()).sort((a, b) => a.cohortStart.localeCompare(b.cohortStart))
}
