import { useContext } from "react";
import { MapInsightContext } from "@app/insights/insight-context.ts";
import { InsightSettingsSection } from "../insight-editor-layout";
import { Label } from "@/components/ui/label.tsx";
import { QueryFilterOptions } from "@app/insights/common/query-filter-options.tsx";
import { TrendInsightSeriesAggregationSelection } from "@app/insights/trend/trend-insight-series-aggregation-selection.tsx";
import { AggregationFunction } from "@lib/aggregations.ts";
import { Field, FieldFilter } from "@/model/filters.ts";

export function MapInsightOptions() {
  const { data, updateFn } = useContext(MapInsightContext);
  if (!data) return null;

  const config = data.config.map;
  const setAggregation = (
    func: AggregationFunction,
    field?: Field,
    distinct?: boolean,
  ) =>
    updateFn?.((insight) => {
      insight.config.map.aggregation = {
        function: func,
        alias: "result_value",
        field: field ?? { name: "id", type: "string" },
        distinct,
      };
    });
  const addFilter = (filter: FieldFilter) =>
    updateFn?.((insight) => {
      insight.config.map.filters = [
        ...(insight.config.map.filters ?? []),
        filter,
      ];
    });
  const updateFilter = (index: number, filter: FieldFilter) =>
    updateFn?.((insight) => {
      const filters = [...(insight.config.map.filters ?? [])];
      filters[index] = filter;
      insight.config.map.filters = filters;
    });
  const removeFilter = (index: number) =>
    updateFn?.((insight) => {
      insight.config.map.filters = (insight.config.map.filters ?? []).filter(
        (_, i) => i !== index,
      );
    });

  return (
    <InsightSettingsSection title="Map Settings">
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Countries come from the visitor's IP address, which the server
          resolves for events sent by the browser SDK.
        </p>
        <div className="space-y-2">
          <Label>Aggregation</Label>
          <TrendInsightSeriesAggregationSelection
            currentFunction={config.aggregation.function}
            selectedField={config.aggregation.field}
            onSelect={setAggregation}
          />
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
