import { AnalyticsChart } from "@/components/analytics-chart";
import { numericResult } from "@quacklytics/contracts";
import { z } from "zod";
import type { FunnelInsight } from "@/model/insights/funnel-insights";
import { determineDateRange } from "@/model/insights/insight-date-range";
import { buildFunnelQuery } from "@/lib/funnel-queries";
import { useDuckDBQuery } from "@/services/duck-db-queries";
import { useProjectId } from "@/hooks/use-project-id";
import { simpleHash } from "@/lib/checksums";
import { Spinner } from "@/components/spinner";
interface Props {
  insight: FunnelInsight;
  layoutDirection: "horizontal" | "vertical";
  detailedResults?: boolean;
}
export function FunnelInsightResults(props: Props) {
  if (!props.insight.config.funnel.steps?.length)
    return <p>Funnel requires at least one step defined.</p>;
  return <ConfiguredFunnel {...props} />;
}
function ConfiguredFunnel({ insight, detailedResults }: Props) {
  const conf = insight.config.funnel;
  const steps = conf.steps ?? [];
  const range = determineDateRange(conf.duration);
  const result = useDuckDBQuery(
    useProjectId(),
    `funnel-${simpleHash(JSON.stringify(conf))}`,
    buildFunnelQuery(steps, "events", range.start, range.end),
  );
  if (result.isPending) return <Spinner />;
  if (result.error)
    return <div role="alert">Error: {result.error.message}</div>;
  const values = Object.values(
    z.record(z.string(), numericResult).parse(result.data?.[0] ?? {}),
  );
  const points = steps.map((step, index) => ({
    label: step.name,
    value: values[index] ?? 0,
  }));
  const initial = points[0]?.value ?? 0;
  return (
    <div className="space-y-4">
      <AnalyticsChart points={points} label={insight.name ?? "Funnel"} />
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">Step</th>
            <th>Users</th>
            <th>Conversion</th>
            {detailedResults && <th>Drop-off</th>}
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={steps[index]?.id}>
              <td>{point.label}</td>
              <td className="text-center">{point.value}</td>
              <td className="text-center">
                {(initial ? (point.value / initial) * 100 : 0).toFixed(1)}%
              </td>
              {detailedResults && (
                <td className="text-center">
                  {Math.max(
                    0,
                    (points[index - 1]?.value ?? point.value) - point.value,
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
