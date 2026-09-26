import { Plus } from "lucide-react";
import type { Dashboard } from "@/model/dashboard";
import { InsightGlyph } from "@/app/insights/insight-glyph";

export function DashboardMosaic({ insights }: Pick<Dashboard, "insights">) {
  return (
    <div
      role="group"
      aria-label="Included insights"
      className="grid h-20 w-20 shrink-0 grid-cols-2 grid-rows-2 gap-1 self-center sm:h-24 sm:w-24"
    >
      {[0, 1, 2, 3].map((index) => {
        const insight = insights[index];
        if (index === 3 && insights.length > 4) {
          const remaining = insights.length - 3;
          return (
            <div
              key={index}
              role="img"
              aria-label={`${remaining} more insights`}
              title={`${remaining} more insights`}
              className="flex items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground"
            >
              <Plus aria-hidden="true" className="h-3 w-3" />
              <span aria-hidden="true">{remaining}</span>
            </div>
          );
        }
        return insight ? (
          <div
            key={index}
            role="img"
            aria-label={`${insight.name} (${insight.type})`}
            title={`${insight.name} (${insight.type})`}
          >
            <InsightGlyph type={insight.type} compact />
          </div>
        ) : (
          <div
            key={index}
            role="img"
            aria-label="Empty insight slot"
            className="rounded-md border border-dashed border-border/60 bg-muted/30"
          />
        );
      })}
    </div>
  );
}
