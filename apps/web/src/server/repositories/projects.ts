import type { Database } from "bun:sqlite";
import { z } from "zod";
const projectRow = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
});
export function listProjectRecords(
  db: Database,
  state: "ready" | "provisioning",
) {
  return projectRow
    .array()
    .parse(
      db
        .query("SELECT id,name,emoji FROM projects WHERE state=? ORDER BY id")
        .all(state),
    );
}
export function insertProject(
  db: Database,
  id: string,
  name: string,
  emoji: string,
) {
  db.query(
    "INSERT INTO projects(id,name,emoji,state) VALUES(?,?,?,'provisioning')",
  ).run(id, name, emoji);
}
export function markProjectReady(db: Database, id: string) {
  db.query("UPDATE projects SET state='ready' WHERE id=?").run(id);
}
export function projectExists(db: Database, id: string) {
  return !!db
    .query("SELECT id FROM projects WHERE id=? AND state='ready'")
    .get(id);
}
export function renameProject(db: Database, id: string, name: string) {
  db.query("UPDATE projects SET name=? WHERE id=?").run(name, id);
}

export function updateProjectEmoji(db: Database, id: string, emoji: string) {
  db.query("UPDATE projects SET emoji=? WHERE id=?").run(emoji, id);
}
