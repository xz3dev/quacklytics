import { useContext } from "react";
import {
  BaseInsightContext,
  RetentionInsightContext,
} from "@app/insights/insight-context.ts";
import { useUpdateInsight } from "@/services/insights.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { InsightSaveControls } from "@app/insights/insight-save-controls.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { RetentionInsightChart } from "@app/insights/retention/retention-insight-chart.tsx";
import { RetentionInsightOptions } from "@app/insights/retention/retention-insight-options.tsx";

export function RetentionInsightView() {
  const { data, update } = useContext(RetentionInsightContext);
  const { isChanged, original, updateWorkingCopy, readOnly } =
    useContext(BaseInsightContext);
  const updater = useUpdateInsight(useProjectId());

  const handleSave = async () => {
    if (!data) return;
    const newInsight = await updater.mutateAsync(data);
    updateWorkingCopy?.(newInsight);
  };

  const handleDiscard = () => {
    if (!original) return;
    if (original?.type === "Retention") update?.(original);
  };

  return (
    <>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">{data?.name}</h2>
          <div className="flex-1" />
          <div className={isChanged ? "visible" : "invisible"}>
            <InsightSaveControls save={handleSave} discard={handleDiscard} />
          </div>
        </div>
      )}
      {!readOnly && <RetentionInsightOptions />}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>{data.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <RetentionInsightChart insight={data} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
