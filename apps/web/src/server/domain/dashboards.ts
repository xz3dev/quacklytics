import type { Database } from "bun:sqlite";
import {
  dashboardCreate,
  dashboardUpdate,
  dashboardMetadata,
  type Insight,
  type DashboardGridItem,
} from "@quacklytics/contracts";
import * as repository from "../repositories/dashboards";
import { listInsights } from "../repositories/insights";
import { RequestError } from "../errors";
function expand(
  record: repository.DashboardRecord,
  insights: Map<number, Insight>,
) {
  const { members, ...metadata } = record;
  const layout = members.flatMap((member) =>
    member.layout ? [member.layout] : [],
  );
  return {
    ...metadata,
    insights: members.map((member) => {
      const value = insights.get(member.insightId);
      if (!value)
        throw new Error("Dashboard membership references a missing insight");
      return value;
    }),
    ...(layout.length ? { layout } : {}),
  };
}
const insightMap = (db: Database) =>
  new Map(listInsights(db).map((item) => [item.id, item]));
export function listDashboards(db: Database) {
  const insights = insightMap(db);
  return repository
    .listDashboardRecords(db)
    .map((record) => expand(record, insights));
}
export function getDashboard(db: Database, id: number) {
  const record = repository.findDashboardRecord(db, id);
  if (!record) throw new RequestError(404, "Dashboard not found");
  return expand(record, insightMap(db));
}
export function saveDashboard(db: Database, input: unknown, id?: number) {
  const value = (id === undefined ? dashboardCreate : dashboardUpdate).parse(
    input,
  );
  return db.transaction(() => {
    if (id !== undefined) getDashboard(db, id);
    const insights = insightMap(db);
    const ids = new Set(value.insights.map((item) => item.id));
    if (ids.size !== value.insights.length)
      throw new RequestError(400, "Duplicate insight");
    if (value.insights.some((item) => !insights.has(item.id)))
      throw new RequestError(400, "Unknown insight");
    if (value.layout?.some((item) => !ids.has(item.insightId)))
      throw new RequestError(
        409,
        "Layout references an unknown dashboard insight",
      );
    if (value.home) repository.clearHomeDashboards(db);
    const savedId = repository.writeDashboard(
      db,
      dashboardMetadata.parse(value),
      value.insights.map((item, position) => ({
        insightId: item.id,
        position,
        layout: value.layout?.find((grid) => grid.insightId === item.id),
      })),
      id,
    );
    return getDashboard(db, savedId);
  })();
}
export function setDashboardInsights(
  db: Database,
  id: number,
  insightIds: number[],
) {
  return db.transaction(() => {
    const existing = getDashboard(db, id);
    return saveDashboard(
      db,
      {
        ...existing,
        insights: insightIds.map((id) => ({ id })),
        layout: existing.layout?.filter((item) =>
          insightIds.includes(item.insightId),
        ),
      },
      id,
    );
  })();
}
export function setDashboardLayout(
  db: Database,
  id: number,
  layout: DashboardGridItem[],
) {
  return db.transaction(() => {
    const existing = getDashboard(db, id);
    if (
      layout.length !== existing.insights.length ||
      layout.some(
        (item) =>
          !existing.insights.some((insight) => insight.id === item.insightId),
      )
    )
      throw new RequestError(
        409,
        "Dashboard insights changed. Reload before adjusting the layout.",
      );
    return saveDashboard(db, { ...existing, layout }, id);
  })();
}
export function setHomeDashboard(db: Database, id: number) {
  return db.transaction(() =>
    saveDashboard(db, { ...getDashboard(db, id), home: true }, id),
  )();
}
export function deleteDashboard(db: Database, id: number) {
  getDashboard(db, id);
  repository.deleteDashboard(db, id);
}
