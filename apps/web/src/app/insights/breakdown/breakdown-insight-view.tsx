import { InsightEditorLayout } from "../insight-editor-layout";
import { useContext } from "react";
import { BreakdownInsightContext } from "@app/insights/insight-context.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { BreakdownInsightChart } from "@app/insights/breakdown/breakdown-insight-chart.tsx";
import { BreakdownInsightOptions } from "@app/insights/breakdown/breakdown-insight-options.tsx";

export function BreakdownInsightView() {
  const { data } = useContext(BreakdownInsightContext);

  return (
    <InsightEditorLayout insight={data} settings={<BreakdownInsightOptions />}>
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>{data.name || "Untitled insight"}</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownInsightChart insight={data} showTable={true} />
          </CardContent>
        </Card>
      )}
    </InsightEditorLayout>
  );
}
