import { InsightEditorLayout } from "../insight-editor-layout";
import { TrendInsightSeriesOptions } from "@app/insights/trend/trend-insight-series-options.tsx";
import { TrendInsightContext } from "@app/insights/insight-context.ts";
import { useContext } from "react";
import { TrendInsightChart } from "@app/insights/trend/trend-insight-chart.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";

export function TrendInsightView() {
  const { data } = useContext(TrendInsightContext);

  return (
    <InsightEditorLayout
      insight={data}
      settings={<TrendInsightSeriesOptions />}
    >
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>{data.name || "Untitled insight"}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendInsightChart insight={data} />
          </CardContent>
        </Card>
      )}
    </InsightEditorLayout>
  );
}
