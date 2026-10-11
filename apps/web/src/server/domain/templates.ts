import { websiteInsights } from "@quacklytics/contracts/website";
import type { Database } from "bun:sqlite";
import { orbitInsights } from "@quacklytics/contracts/orbit";
import {
  defaultInsights,
  type Insight,
  type InsightInput,
} from "@quacklytics/contracts";
import { RequestError } from "../errors";
import { listDashboards, getDashboard, saveDashboard } from "./dashboards";
import { saveInsight } from "./insights";
export function createTemplate(
  db: Database,
  template: string,
  home = false,
  name?: string,
  target?: number,
) {
  // Read at runtime: Bun build can inline process.env.NODE_ENV as development.
  if (template === "chart_playground" && Bun.env.NODE_ENV !== "development")
    throw new RequestError(404, "Template not available");
  if (
    ![
      "web_analytics",
      "product_analytics",
      "chart_playground",
      "website_traffic",
    ].includes(template)
  )
    throw new RequestError(400, "Unknown template");
  return db.transaction(() => {
    const existing = target ? getDashboard(db, target) : undefined;
    if (existing?.insights.length)
      throw new RequestError(409, "Template requires an empty dashboard");
    // `website_traffic` predates the web analytics default and now matches it.
    const web =
      template === "web_analytics" || template === "website_traffic"
        ? websiteInsights()
        : undefined;
    const seeds: InsightInput[] =
      template === "chart_playground"
        ? orbitInsights(365)
        : web
          ? web.map((seed) => seed.insight)
          : [
              { ...defaultInsights.Trend, name: "Events over time" },
              { ...defaultInsights.Value, name: "Total events" },
              { ...defaultInsights.Breakdown, name: "Event breakdown" },
              { ...defaultInsights.Retention, name: "Retention" },
              { ...defaultInsights.Path, name: "User paths" },
            ];
    const insights: Insight[] = seeds.map((seed) => saveInsight(db, seed));
    const layout = web?.map((seed, index) => ({
      ...seed.slot,
      insightId: insights[index]?.id,
    }));
    return saveDashboard(
      db,
      {
        name:
          name ??
          existing?.name ??
          (template === "chart_playground"
            ? "Chart playground (dev)"
            : template === "website_traffic"
              ? "Website traffic"
              : template === "web_analytics"
                ? "Web Analytics Overview"
                : "Product Analytics Overview"),
        home: home || (existing?.home ?? false),
        favorite: home,
        insights,
        ...(layout ? { layout } : {}),
      },
      target,
    );
  })();
}
export function restoreDefaultDashboard(db: Database) {
  return db.transaction(() => {
    if (listDashboards(db).length)
      throw new RequestError(409, "Dashboards already exist");
    return createTemplate(db, "web_analytics", true);
  })();
}
