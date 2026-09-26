import { InsightEditorLayout } from "../insight-editor-layout";
import { useContext } from "react";
import { PathInsightContext } from "@app/insights/insight-context.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { PathInsightChart } from "@app/insights/path/path-insight-chart.tsx";
import { PathInsightOptions } from "@app/insights/path/path-insight-options.tsx";

export function PathInsightView() {
  const { data } = useContext(PathInsightContext);

  return (
    <InsightEditorLayout insight={data} settings={<PathInsightOptions />}>
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>{data.name || "Untitled insight"}</CardTitle>
          </CardHeader>
          <CardContent>
            <PathInsightChart insight={data} />
          </CardContent>
        </Card>
      )}
    </InsightEditorLayout>
  );
}
