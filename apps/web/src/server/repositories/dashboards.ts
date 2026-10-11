import type { Database } from "bun:sqlite";
import { z } from "zod";
import {
  dashboardMetadata,
  dashboardMembership,
  parseJson,
} from "@quacklytics/contracts";
const row = z.object({ id: z.number(), json: z.string() });
const memberRow = z.object({
  insight_id: z.number(),
  position: z.number(),
  layout: z.string().nullable(),
});
export type DashboardRecord = z.infer<typeof dashboardMetadata> & {
  id: number;
  members: z.infer<typeof dashboardMembership>[];
};
function decode(db: Database, value: z.infer<typeof row>): DashboardRecord {
  const metadata = dashboardMetadata.parse(parseJson(value.json));
  const members = memberRow
    .array()
    .parse(
      db
        .query(
          "SELECT insight_id,position,layout FROM dashboard_insights WHERE dashboard_id=? ORDER BY position",
        )
        .all(value.id),
    )
    .map((member) =>
      dashboardMembership.parse({
        insightId: member.insight_id,
        position: member.position,
        ...(member.layout === null ? {} : { layout: parseJson(member.layout) }),
      }),
    );
  return { ...metadata, id: value.id, members };
}
export function listDashboardRecords(db: Database) {
  return row
    .array()
    .parse(db.query("SELECT id,json FROM dashboards ORDER BY id").all())
    .map((value) => decode(db, value));
}
export function findDashboardRecord(db: Database, id: number) {
  const value = row
    .nullable()
    .parse(db.query("SELECT id,json FROM dashboards WHERE id=?").get(id));
  return value ? decode(db, value) : undefined;
}
export function writeDashboard(
  db: Database,
  metadata: z.infer<typeof dashboardMetadata>,
  members: z.infer<typeof dashboardMembership>[],
  id?: number,
) {
  if (id !== undefined)
    db.query("UPDATE dashboards SET json=? WHERE id=?").run(
      JSON.stringify(metadata),
      id,
    );
  else
    id = Number(
      db
        .query("INSERT INTO dashboards(json) VALUES(?)")
        .run(JSON.stringify(metadata)).lastInsertRowid,
    );
  db.query("DELETE FROM dashboard_insights WHERE dashboard_id=?").run(id);
  const insert = db.query(
    "INSERT INTO dashboard_insights(dashboard_id,insight_id,position,layout) VALUES(?,?,?,?)",
  );
  for (const member of members)
    insert.run(
      id,
      member.insightId,
      member.position,
      member.layout ? JSON.stringify(member.layout) : null,
    );
  return id;
}
export function clearHomeDashboards(db: Database) {
  db.query(
    "UPDATE dashboards SET json=json_set(json,'$.home',json('false')) WHERE json_extract(json,'$.home')=1",
  ).run();
}
export function deleteDashboard(db: Database, id: number) {
  db.query("DELETE FROM dashboards WHERE id=?").run(id);
}
