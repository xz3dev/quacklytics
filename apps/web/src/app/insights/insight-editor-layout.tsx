import { useContext, type ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { Insight } from "@/model/insights/insight";
import { BaseInsightContext } from "./insight-context";

export function InsightSettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function InsightEditorLayout({
  insight,
  settings,
  children,
}: {
  insight: Insight | undefined;
  settings: ReactNode;
  children: ReactNode;
}) {
  const { readOnly, chartControls } = useContext(BaseInsightContext);
  if (readOnly || !insight)
    return (
      <div data-chart-layout className="min-w-0 space-y-4">
        {chartControls}
        {children}
      </div>
    );
  const sectionTitle =
    insight.type === "Trend"
      ? "Series"
      : insight.type === "Value"
        ? "Metric & filters"
        : insight.type === "Funnel"
          ? "Funnel steps"
          : undefined;
  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)]">
      <Card
        role="complementary"
        aria-label="Insight settings"
        className="min-w-0 rounded-xl border border-border/50"
      >
        <CardHeader className="p-5 pb-4">
          <CardTitle className="text-base">Insight settings</CardTitle>
          <CardDescription>
            Configure your {insight.type.toLowerCase()} insight.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-5 pt-0">
          {sectionTitle ? (
            <InsightSettingsSection title={sectionTitle}>
              {settings}
            </InsightSettingsSection>
          ) : (
            settings
          )}
        </CardContent>
      </Card>
      <section
        data-chart-layout
        aria-label="Insight results"
        className="min-w-0 space-y-4"
      >
        {chartControls}
        <div className="min-w-0 overflow-hidden rounded-xl border border-border/50 [&>div]:rounded-xl">
          {children}
        </div>
      </section>
    </div>
  );
}
