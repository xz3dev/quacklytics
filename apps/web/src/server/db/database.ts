import { openDatabase } from "./connection";
import { loadMigrations, migrate } from "./migrations";
export { openDatabase } from "./connection";
import { Database } from "bun:sqlite";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { z } from "zod";

export const dataRoot = resolve(process.env.DATA_DIR ?? "./data");
mkdirSync(dataRoot, { recursive: true });
const marker = join(dataRoot, "format");
if (
  existsSync(marker) &&
  readFileSync(marker, "utf8") !== "quacklytics-sqlite-v1\n"
)
  throw new Error("Unsupported data format");
if (!existsSync(marker)) {
  // GeoIP can populate its disposable cache before the first backend request.
  // It does not indicate an existing analytics database or storage format.
  if (
    readdirSync(dataRoot, { withFileTypes: true }).some(
      (entry) => entry.name !== "geoip" || !entry.isDirectory(),
    )
  )
    throw new Error(
      "DATA_DIR must be empty or contain the SQLite format marker.",
    );
  writeFileSync(marker, "quacklytics-sqlite-v1\n");
}
export const appDb = openDatabase(join(dataRoot, "app.sqlite"));
await migrate(appDb, loadMigrations("app"));
const projectDbs = new Map<string, Database>();
const opening = new Map<string, Promise<Database>>();
export async function projectDatabase(id: string) {
  const pending = opening.get(id);
  if (pending) return pending;
  const promise = openProjectDatabase(id);
  opening.set(id, promise);
  try {
    return await promise;
  } finally {
    opening.delete(id);
  }
}
async function openProjectDatabase(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error("Invalid project ID");
  const found = projectDbs.get(id);
  if (found) {
    projectDbs.delete(id);
    projectDbs.set(id, found);
    return found;
  }
  const dir = join(dataRoot, "projects", id);
  mkdirSync(dir, { recursive: true });
  const db = openDatabase(join(dir, "project.sqlite"));
  try {
    await migrate(db, loadMigrations("project"));
  } catch (error) {
    db.close();
    throw error;
  }
  projectDbs.set(id, db);
  return db;
}
export function closeDatabases() {
  for (const db of projectDbs.values()) db.close();
  projectDbs.clear();
  appDb.close();
}
export function setting(db: Database, key: string) {
  return z
    .object({ value: z.string() })
    .parse(db.query("SELECT value FROM settings WHERE key=?").get(key)).value;
}
export function setSetting(db: Database, key: string, value: string) {
  db.query(
    "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(key, value);
}

// Only evict at worker idle boundaries: asynchronous exports may still hold a handle.
export function evictIdleDatabases() {
  while (projectDbs.size > 16) {
    const oldest = projectDbs.entries().next().value;
    if (!oldest) break;
    oldest[1].close();
    projectDbs.delete(oldest[0]);
  }
}
