import { useContext } from "react";
import { BreakdownInsightContext } from "@app/insights/insight-context.ts";
import { InsightSettingsSection } from "../insight-editor-layout";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { FieldSelector } from "@app/insights/common/field-selector.tsx";
import { QueryFilterOptions } from "@app/insights/common/query-filter-options.tsx";
import { TrendInsightSeriesAggregationSelection } from "@app/insights/trend/trend-insight-series-aggregation-selection.tsx";
import { AggregationFunction } from "@lib/aggregations.ts";
import { Field, FieldFilter } from "@/model/filters.ts";

export function BreakdownInsightOptions() {
  const { data, updateFn } = useContext(BreakdownInsightContext);
  if (!data) return null;

  const config = data.config.breakdown;
  const setDimension = (field: Field) =>
    updateFn?.((insight) => {
      insight.config.breakdown.dimension = field;
    });
  const setLimit = (value: string) =>
    updateFn?.((insight) => {
      insight.config.breakdown.limit = clampInt(value, 1, 100, 10);
    });
  const setAggregation = (
    func: AggregationFunction,
    field?: Field,
    distinct?: boolean,
  ) =>
    updateFn?.((insight) => {
      insight.config.breakdown.aggregation = {
        function: func,
        alias: "result_value",
        field: field ?? { name: "id", type: "string" },
        distinct,
      };
    });
  const addFilter = (filter: FieldFilter) =>
    updateFn?.((insight) => {
      insight.config.breakdown.filters = [
        ...(insight.config.breakdown.filters ?? []),
        filter,
      ];
    });
  const updateFilter = (index: number, filter: FieldFilter) =>
    updateFn?.((insight) => {
      const filters = [...(insight.config.breakdown.filters ?? [])];
      filters[index] = filter;
      insight.config.breakdown.filters = filters;
    });
  const removeFilter = (index: number) =>
    updateFn?.((insight) => {
      insight.config.breakdown.filters = (
        insight.config.breakdown.filters ?? []
      ).filter((_, i) => i !== index);
    });

  return (
    <InsightSettingsSection title="Breakdown Settings">
      <div className="grid gap-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Dimension</Label>
            <FieldSelector value={config.dimension} onChange={setDimension} />
          </div>
          <div className="space-y-2">
            <Label>Aggregation</Label>
            <TrendInsightSeriesAggregationSelection
              currentFunction={config.aggregation.function}
              selectedField={
                config.aggregation.field ?? { name: "id", type: "string" }
              }
              onSelect={setAggregation}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="breakdown-limit">Limit</Label>
            <Input
              id="breakdown-limit"
              type="number"
              min={1}
              max={100}
              value={config.limit ?? 10}
              onChange={(event) => setLimit(event.target.value)}
            />
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <QueryFilterOptions
            filters={config.filters ?? []}
            onAdd={addFilter}
            onUpdate={updateFilter}
            onRemove={removeFilter}
          />
        </div>
      </div>
    </InsightSettingsSection>
  );
}

function clampInt(value: string, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
