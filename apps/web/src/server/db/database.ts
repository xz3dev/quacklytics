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
  if (readdirSync(dataRoot).length)
    throw new Error(
      "DATA_DIR must be empty or contain the SQLite format marker. Use a new directory for this migration.",
    );
  writeFileSync(marker, "quacklytics-sqlite-v1\n");
}
export function openDatabase(file: string) {
  const db = new Database(file, { create: true, strict: true });
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA wal_autocheckpoint=1000; PRAGMA cache_size=-16000;",
  );
  const journal = z
    .object({ journal_mode: z.literal("wal") })
    .parse(db.query("PRAGMA journal_mode").get());
  const sync = z
    .object({ synchronous: z.literal(2) })
    .parse(db.query("PRAGMA synchronous").get());
  if (!journal || !sync)
    throw new Error("SQLite durability configuration failed");
  return db;
}
export function migrate(db: Database, sql: string) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS migration(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL)",
  );
  const checksum = new Bun.CryptoHasher("sha256").update(sql).digest("hex");
  const applied = z
    .object({ checksum: z.string() })
    .nullable()
    .parse(db.query("SELECT checksum FROM migration WHERE version=1").get());
  if (applied) {
    if (applied.checksum !== checksum)
      throw new Error("Migration checksum changed");
    return;
  }
  db.transaction(() => {
    db.exec(sql);
    db.query("INSERT INTO migration VALUES(1,?)").run(checksum);
  })();
}
export const appDb = openDatabase(join(dataRoot, "app.sqlite"));
migrate(
  appDb,
  `
 CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'ready');
 CREATE TABLE api_keys(id INTEGER PRIMARY KEY AUTOINCREMENT,project TEXT NOT NULL REFERENCES projects(id),digest TEXT NOT NULL UNIQUE,prefix TEXT NOT NULL,created_at INTEGER NOT NULL);
`,
);
const projectDbs = new Map<string, Database>();
export function projectDatabase(id: string) {
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
  migrate(
    db,
    `
 CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 INSERT INTO settings VALUES('cors_origins','[]'),('revision','0');
 CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,timestamp INTEGER NOT NULL,event_type TEXT NOT NULL,session_id TEXT,person_id TEXT,properties TEXT NOT NULL CHECK(json_valid(properties)),person_properties TEXT NOT NULL CHECK(json_valid(person_properties)),fingerprint TEXT NOT NULL);
 CREATE INDEX events_timestamp ON events(timestamp,id); CREATE INDEX events_session ON events(session_id);
 CREATE TABLE persons(id TEXT PRIMARY KEY,first_seen INTEGER NOT NULL,properties TEXT NOT NULL,property_timestamps TEXT NOT NULL);
 CREATE TABLE sessions(id TEXT PRIMARY KEY,person_id TEXT,first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL);
 CREATE TABLE schemas(id INTEGER PRIMARY KEY,event_type TEXT NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL,UNIQUE(event_type,name));
 CREATE TABLE schema_values(property_id INTEGER NOT NULL REFERENCES schemas(id),value TEXT NOT NULL,UNIQUE(property_id,value));
 CREATE TABLE insights(id INTEGER PRIMARY KEY AUTOINCREMENT,json TEXT NOT NULL CHECK(json_valid(json)));
 CREATE TABLE dashboards(id INTEGER PRIMARY KEY AUTOINCREMENT,json TEXT NOT NULL CHECK(json_valid(json)));
 CREATE TABLE requests(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,result TEXT NOT NULL);
 CREATE TABLE catalog(name TEXT PRIMARY KEY,json TEXT NOT NULL CHECK(json_valid(json)));
 CREATE TABLE dirty_partitions(partition TEXT PRIMARY KEY,revision INTEGER NOT NULL);
 CREATE TABLE export_manifest(partition TEXT PRIMARY KEY,json TEXT NOT NULL CHECK(json_valid(json)));
 CREATE TABLE jobs(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,error TEXT);
 `,
  );
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
