import type { Database } from "bun:sqlite";
import { z } from "zod";
import { insight, parseJson, type InsightInput } from "@quacklytics/contracts";
const row = z.object({ id: z.number(), json: z.string() });
function decode(value: z.infer<typeof row>) {
  return insight.parse({
    ...z.record(z.string(), z.unknown()).parse(parseJson(value.json)),
    id: value.id,
  });
}
export function listInsights(db: Database) {
  return row
    .array()
    .parse(db.query("SELECT id,json FROM insights ORDER BY id").all())
    .map(decode);
}
export function findInsight(db: Database, id: number) {
  const result = row
    .nullable()
    .parse(db.query("SELECT id,json FROM insights WHERE id=?").get(id));
  return result ? decode(result) : undefined;
}
export function writeInsight(db: Database, value: InsightInput, id?: number) {
  if (id !== undefined)
    db.query("UPDATE insights SET json=? WHERE id=?").run(
      JSON.stringify(value),
      id,
    );
  else
    id = Number(
      db
        .query("INSERT INTO insights(json) VALUES(?)")
        .run(JSON.stringify(value)).lastInsertRowid,
    );
  return insight.parse({ ...value, id });
}
export function deleteInsight(db: Database, id: number) {
  db.query("DELETE FROM insights WHERE id=?").run(id);
}
