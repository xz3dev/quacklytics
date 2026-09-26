import { InsightEditorLayout } from "../insight-editor-layout";
import { useContext } from "react";
import { RetentionInsightContext } from "@app/insights/insight-context.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { RetentionInsightChart } from "@app/insights/retention/retention-insight-chart.tsx";
import { RetentionInsightOptions } from "@app/insights/retention/retention-insight-options.tsx";

export function RetentionInsightView() {
  const { data } = useContext(RetentionInsightContext);

  return (
    <InsightEditorLayout insight={data} settings={<RetentionInsightOptions />}>
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>{data.name || "Untitled insight"}</CardTitle>
          </CardHeader>
          <CardContent>
            <RetentionInsightChart insight={data} />
          </CardContent>
        </Card>
      )}
    </InsightEditorLayout>
  );
}
