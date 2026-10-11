import { Database } from "bun:sqlite";
import { z } from "zod";
export function openDatabase(file: string) {
  const db = new Database(file, { create: true, strict: true });
  db.exec(
    "PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA wal_autocheckpoint=1000; PRAGMA cache_size=-16000;",
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
