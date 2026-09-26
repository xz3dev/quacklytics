import { useContext } from "react";
import { TrendInsightContext } from "@app/insights/insight-context.ts";
import { InsightTimeControls } from "@/components/insight-time-controls";

export function TrendInsightChartOptions() {
  const { data, updateFn } = useContext(TrendInsightContext);
  return (
    <InsightTimeControls
      duration={data?.config.trend.duration ?? "P30D"}
      timeBucket={data?.config.trend.timeBucket ?? "Daily"}
      onDurationChange={(duration) =>
        updateFn?.((insight) => {
          insight.config.trend.duration = duration;
        })
      }
      onBucketChange={(bucket) =>
        updateFn?.((insight) => {
          insight.config.trend.timeBucket = bucket;
        })
      }
    />
  );
}
