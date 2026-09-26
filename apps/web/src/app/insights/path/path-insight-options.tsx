import { useContext } from "react";
import { PathInsightContext } from "@app/insights/insight-context.ts";
import { InsightSettingsSection } from "../insight-editor-layout";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { FieldSelector } from "@app/insights/common/field-selector.tsx";
import { QueryFilterOptions } from "@app/insights/common/query-filter-options.tsx";
import { Field, FieldFilter } from "@/model/filters.ts";
import { PathDirection } from "@/model/insights/path-insight.ts";

export function PathInsightOptions() {
  const { data, updateFn } = useContext(PathInsightContext);
  if (!data) return null;

  const config = data.config.path;
  const updateAnchorFilters = (fn: (filters: FieldFilter[]) => FieldFilter[]) =>
    updateFn?.((insight) => {
      insight.config.path.anchorQuery.filters = fn(
        insight.config.path.anchorQuery.filters ?? [],
      );
    });

  return (
    <InsightSettingsSection title="Path Settings">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Step Field</Label>
            <FieldSelector
              value={config.stepField}
              onChange={(field: Field) =>
                updateFn?.((insight) => {
                  insight.config.path.stepField = field;
                })
              }
              allowedTypes={["string"]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="path-direction">Direction</Label>
            <Select
              value={config.direction}
              onValueChange={(direction: PathDirection) =>
                updateFn?.((insight) => {
                  insight.config.path.direction = direction;
                })
              }
            >
              <SelectTrigger id="path-direction">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="forward">Forward</SelectItem>
                <SelectItem value="backward">Backward</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="path-steps">Steps</Label>
            <Input
              id="path-steps"
              type="number"
              min={1}
              max={10}
              value={config.maxSteps ?? 1}
              onChange={(event) =>
                updateFn?.((insight) => {
                  insight.config.path.maxSteps = clampInt(
                    event.target.value,
                    1,
                    10,
                    1,
                  );
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="path-limit">Limit</Label>
            <Input
              id="path-limit"
              type="number"
              min={1}
              max={100}
              value={config.limit ?? 10}
              onChange={(event) =>
                updateFn?.((insight) => {
                  insight.config.path.limit = clampInt(
                    event.target.value,
                    1,
                    100,
                    10,
                  );
                })
              }
            />
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Anchor Event</div>
          <QueryFilterOptions
            filters={config.anchorQuery.filters ?? []}
            onAdd={(filter) =>
              updateAnchorFilters((filters) => [...filters, filter])
            }
            onUpdate={(index, filter) =>
              updateAnchorFilters((filters) =>
                replaceAt(filters, index, filter),
              )
            }
            onRemove={(index) =>
              updateAnchorFilters((filters) =>
                filters.filter((_, i) => i !== index),
              )
            }
            addLabel="Add Anchor Filter"
          />
        </div>
      </div>
    </InsightSettingsSection>
  );
}

function replaceAt<T>(items: T[], index: number, item: T) {
  const copy = [...items];
  copy[index] = item;
  return copy;
}

function clampInt(value: string, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
