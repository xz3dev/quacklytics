import { Umzug } from "umzug";
import type { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const hash = (sql: string) =>
  new Bun.CryptoHasher("sha256").update(sql).digest("hex");
export function loadMigrations(
  scope: "app" | "project",
  root = join(import.meta.dir, "migrations"),
) {
  const directory = join(root, scope);
  const pairs = new Map<number, { name: string; up?: string; down?: string }>();
  for (const file of readdirSync(directory)) {
    const match = /^(\d{4,})_([a-z][a-z0-9_]*?)\.(up|down)\.sql$/.exec(file);
    if (!match) throw new Error(`Invalid migration filename: ${file}`);
    const version = z.coerce.number().int().positive().safe().parse(match[1]);
    const name = z.string().parse(match[2]);
    const direction = z.enum(["up", "down"]).parse(match[3]);
    const pair = pairs.get(version) ?? { name };
    if (pair.name !== name || pair[direction] !== undefined)
      throw new Error(`Duplicate migration version: ${version}`);
    pair[direction] = readFileSync(join(directory, file), "utf8");
    pairs.set(version, pair);
  }
  if (!pairs.size) throw new Error(`No migrations in ${directory}`);
  return [...pairs]
    .sort(([a], [b]) => a - b)
    .map(([version, pair]) => {
      if (!pair.up?.trim() || !pair.down?.trim())
        throw new Error(`Migration ${version} requires up and down SQL`);
      return {
        version,
        name: pair.name,
        up: pair.up,
        down: pair.down,
        checksum: hash(pair.up),
        down_checksum: hash(pair.down),
      };
    });
}

type Migration = ReturnType<typeof loadMigrations>[number];
const historySchema = z.array(
  z.object({
    version: z.number().int(),
    name: z.string(),
    checksum: z.string(),
    down_checksum: z.string(),
  }),
);

/** One immediate transaction serializes runners and rolls back the entire requested change on failure. */
export async function migrate(
  db: Database,
  migrations: Migration[],
  direction: "up" | "down" | "status" = "up",
  target?: number,
) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL,
      down_checksum TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const applied = historySchema.parse(
      db
        .query(
          "SELECT version,name,checksum,down_checksum FROM schema_migrations ORDER BY version",
        )
        .all(),
    );
    for (const [index, row] of applied.entries()) {
      const file = migrations[index];
      if (
        !file ||
        row.version !== file.version ||
        row.name !== file.name ||
        row.checksum !== file.checksum ||
        row.down_checksum !== file.down_checksum
      )
        throw new Error(
          `Migration history/checksum mismatch at version ${row.version}`,
        );
    }
    const current = applied.at(-1)?.version ?? 0;
    const destination =
      target ??
      (direction === "down"
        ? (applied.at(-2)?.version ?? 0)
        : (migrations.at(-1)?.version ?? 0));
    if (
      !Number.isSafeInteger(destination) ||
      (destination !== 0 && !migrations.some((m) => m.version === destination))
    )
      throw new Error(`Unknown target version: ${destination}`);
    if (
      (direction === "up" && destination < current) ||
      (direction === "down" && destination > current)
    )
      throw new Error(
        `Target ${destination} is invalid for ${direction} from ${current}`,
      );
    const runner = new Umzug({
      context: db,
      logger: undefined,
      migrations: migrations.map((m) => ({
        name: String(m.version),
        up: async () => {
          db.exec(m.up);
        },
        down: async () => {
          db.exec(m.down);
        },
      })),
      storage: {
        executed: async () =>
          historySchema
            .parse(
              db
                .query(
                  "SELECT version,name,checksum,down_checksum FROM schema_migrations ORDER BY version",
                )
                .all(),
            )
            .map((row) => String(row.version)),
        logMigration: async ({ name }) => {
          const migration = migrations.find((m) => String(m.version) === name);
          if (!migration) throw new Error(`Unknown migration: ${name}`);
          db.query(
            "INSERT INTO schema_migrations(version,name,checksum,down_checksum) VALUES(?,?,?,?)",
          ).run(
            migration.version,
            migration.name,
            migration.checksum,
            migration.down_checksum,
          );
        },
        unlogMigration: async ({ name }) => {
          db.query("DELETE FROM schema_migrations WHERE version=?").run(
            Number(name),
          );
        },
      },
    });
    if (direction === "up" && destination > current)
      await runner.up({ to: String(destination) });
    if (direction === "down" && destination < current) {
      // Umzug's `to` is inclusive; our target denotes the version to retain.
      const firstReverted = applied.find((row) => row.version > destination);
      if (!firstReverted) throw new Error("Missing rollback boundary");
      await runner.down({ to: String(firstReverted.version) });
    }
    if (db.query("PRAGMA foreign_key_check").all().length)
      throw new Error("Migration left foreign key violations");
    db.exec("COMMIT");
    const version = direction === "status" ? current : destination;
    return migrations.map((m) => ({
      version: m.version,
      name: m.name,
      applied: m.version <= version,
    }));
  } catch (error) {
    if (db.inTransaction) db.exec("ROLLBACK");
    throw error;
  }
}
