import { z } from "zod";
import {
  appDb,
  closeDatabases,
  evictIdleDatabases,
  projectDatabase,
} from "./database";

try {
  const projects = z
    .array(z.object({ id: z.string() }))
    .parse(appDb.query("SELECT id FROM projects ORDER BY id").all());
  for (const { id } of projects) {
    await projectDatabase(id);
    evictIdleDatabases();
  }
  console.log(
    `Migrations complete: app database and ${projects.length} project database(s).`,
  );
} finally {
  closeDatabases();
}
