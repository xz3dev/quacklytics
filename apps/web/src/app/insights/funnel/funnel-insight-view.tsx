import { InsightEditorLayout } from "../insight-editor-layout";
import { useContext } from "react";
import { FunnelInsightContext } from "@app/insights/insight-context.ts";
import { FunnelInsightResults } from "@app/insights/funnel/funnel-insight-results.tsx";
import { FunnelInsightSteps } from "@app/insights/funnel/funnel-insight-steps.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectLink } from "@/components/project-link.tsx";

export function FunnelInsightView() {
  const { data } = useContext(FunnelInsightContext);

  return (
    <InsightEditorLayout insight={data} settings={<FunnelInsightSteps />}>
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>
              <ProjectLink to={`/insights/${data.id}`}>
                <h3>{data.name || "Untitled insight"}</h3>
              </ProjectLink>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-6">
            <FunnelInsightResults
              insight={data}
              layoutDirection="horizontal"
              detailedResults={true}
            />
          </CardContent>
        </Card>
      )}
    </InsightEditorLayout>
  );
}
