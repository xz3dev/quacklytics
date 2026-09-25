import { useContext } from "react";
import { RetentionInsightContext } from "@app/insights/insight-context.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { DateRangeSummary } from "@app/insights/common/date-range-summary.tsx";
import { QueryFilterOptions } from "@app/insights/common/query-filter-options.tsx";
import { FieldFilter } from "@/model/filters.ts";
import { TimeBucket, timeBucketData } from "@/model/insights/trend-insight.ts";

export function RetentionInsightOptions() {
  const { data, updateFn } = useContext(RetentionInsightContext);
  if (!data) return null;

  const config = data.config.retention;

  const updateActivationFilters = (
    fn: (filters: FieldFilter[]) => FieldFilter[],
  ) =>
    updateFn?.((insight) => {
      insight.config.retention.activationQuery.filters = fn(
        insight.config.retention.activationQuery.filters ?? [],
      );
    });
  const updateReturnFilters = (fn: (filters: FieldFilter[]) => FieldFilter[]) =>
    updateFn?.((insight) => {
      insight.config.retention.returnQuery.filters = fn(
        insight.config.retention.returnQuery.filters ?? [],
      );
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention Settings</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <DateRangeSummary
            value={config.duration}
            onChange={(duration) =>
              updateFn?.((insight) => {
                insight.config.retention.duration = duration;
              })
            }
          />
          <div className="space-y-2">
            <Label>Cohort Bucket</Label>
            <Select
              value={config.cohortBucket}
              onValueChange={(bucket: TimeBucket) =>
                updateFn?.((insight) => {
                  insight.config.retention.cohortBucket = bucket;
                })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Bucket" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(timeBucketData).map(([bucket, bucketData]) => (
                  <SelectItem key={bucket} value={bucket}>
                    {bucketData.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Periods</Label>
            <Input
              className="w-28"
              type="number"
              min={1}
              max={52}
              value={config.maxPeriods ?? 14}
              onChange={(event) =>
                updateFn?.((insight) => {
                  insight.config.retention.maxPeriods = clampInt(
                    event.target.value,
                    1,
                    52,
                    14,
                  );
                })
              }
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-muted p-3">
            <div className="mb-2 text-sm font-medium">Activation Event</div>
            <QueryFilterOptions
              filters={config.activationQuery.filters ?? []}
              onAdd={(filter) =>
                updateActivationFilters((filters) => [...filters, filter])
              }
              onUpdate={(index, filter) =>
                updateActivationFilters((filters) =>
                  replaceAt(filters, index, filter),
                )
              }
              onRemove={(index) =>
                updateActivationFilters((filters) =>
                  filters.filter((_, i) => i !== index),
                )
              }
              addLabel="Add Activation Filter"
            />
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="mb-2 text-sm font-medium">Return Event</div>
            <QueryFilterOptions
              filters={config.returnQuery.filters ?? []}
              onAdd={(filter) =>
                updateReturnFilters((filters) => [...filters, filter])
              }
              onUpdate={(index, filter) =>
                updateReturnFilters((filters) =>
                  replaceAt(filters, index, filter),
                )
              }
              onRemove={(index) =>
                updateReturnFilters((filters) =>
                  filters.filter((_, i) => i !== index),
                )
              }
              addLabel="Add Return Filter"
            />
          </div>
        </div>
      </CardContent>
    </Card>
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
