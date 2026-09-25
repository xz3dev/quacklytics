import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
// Purpose: prevent secrets/native dependencies leaking into browser artifacts.
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? files(join(dir, entry.name))
        : Promise.resolve([join(dir, entry.name)]),
    ),
  );
  return nested.flat();
}
for (const path of await files("apps/web/dist/client")) {
  if (!path.endsWith(".js")) continue;
  const text = await readFile(path, "utf8");
  if (/bun:sqlite|S3_SECRET_ACCESS_KEY|S3_ACCESS_KEY_ID|AUTH_SECRET|single_admin/.test(text))
    throw new Error(`Server implementation leaked into ${path}`);
}
console.log("Browser/server boundaries verified");
