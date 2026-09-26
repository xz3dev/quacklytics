import { InsightEditorLayout } from "../insight-editor-layout";
import { ValueInsightContext } from "@app/insights/insight-context.ts";
import { useContext } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { ValueInsightChart } from "@app/insights/value/value-insight-chart.tsx";
import { ValueInsightSeriesOptions } from "@app/insights/value/value-insight-series-options.tsx";

export function ValueInsightView() {
  const { data } = useContext(ValueInsightContext);

  return (
    <InsightEditorLayout
      insight={data}
      settings={<ValueInsightSeriesOptions />}
    >
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>{data.name || "Untitled insight"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ValueInsightChart insight={data} />
          </CardContent>
        </Card>
      )}
    </InsightEditorLayout>
  );
}
