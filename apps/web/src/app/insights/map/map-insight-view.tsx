import { InsightEditorLayout } from "../insight-editor-layout";
import { useContext } from "react";
import { MapInsightContext } from "@app/insights/insight-context.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { MapInsightChart } from "@app/insights/map/map-insight-chart.tsx";
import { MapInsightOptions } from "@app/insights/map/map-insight-options.tsx";

export function MapInsightView() {
  const { data } = useContext(MapInsightContext);

  return (
    <InsightEditorLayout insight={data} settings={<MapInsightOptions />}>
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>{data.name || "Untitled insight"}</CardTitle>
          </CardHeader>
          <CardContent>
            <MapInsightChart insight={data} showTable={true} />
          </CardContent>
        </Card>
      )}
    </InsightEditorLayout>
  );
}
