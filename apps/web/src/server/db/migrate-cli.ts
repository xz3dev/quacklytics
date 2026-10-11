import { resolve } from "node:path";
import { z } from "zod";
import { openDatabase } from "./connection";
import { loadMigrations, migrate } from "./migrations";

try {
  const [command, database, file, target, ...extra] = process.argv.slice(2);
  if (!command || !database || !file || extra.length)
    throw new Error(
      "Usage: db:migrate <up|down|status> <app|project> <sqlite-file> [target-version]",
    );
  const direction = z.enum(["up", "down", "status"]).parse(command);
  const scope = z.enum(["app", "project"]).parse(database);
  if (direction === "status" && target !== undefined)
    throw new Error("status does not accept a target");
  const version =
    target === undefined
      ? undefined
      : z.coerce.number().int().nonnegative().safe().parse(target);
  const migrations = loadMigrations(scope);
  // The CLI operates on an explicit existing file: it must not accidentally initialize the wrong DATA_DIR.
  if (!(await Bun.file(resolve(file)).exists()))
    throw new Error(`Database file does not exist: ${file}`);
  const db = openDatabase(resolve(file));
  try {
    console.log(
      JSON.stringify(
        await migrate(db, migrations, direction, version),
        null,
        2,
      ),
    );
  } finally {
    db.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
