// Verifies the publishable @quacklytics/client artifact: the reported SDK version
// matches package.json, and the packed tarball installs from scratch and every
// exported entrypoint imports in Node.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { SDK_VERSION } from "../packages/tracker/src/protocol.js";

const packageDir = resolve("packages/tracker");
const manifest = z
  .object({
    name: z.literal("@quacklytics/client"),
    version: z.string().min(1),
    exports: z.record(z.string(), z.object({ import: z.string() })),
  })
  .parse(JSON.parse(await readFile(join(packageDir, "package.json"), "utf8")));

if (SDK_VERSION !== manifest.version) {
  throw new Error(
    `SDK_VERSION in packages/tracker/src/protocol.ts is ${SDK_VERSION}, but package.json is ${manifest.version}`,
  );
}

async function run(
  [command, ...args]: [string, ...string[]],
  cwd: string,
): Promise<string> {
  const { stdout } = await promisify(execFile)(command, args, { cwd });
  return stdout;
}

const work = await mkdtemp(join(tmpdir(), "quacklytics-client-"));
try {
  const [packed] = z
    .tuple([z.object({ filename: z.string() })])
    .parse(
      JSON.parse(
        await run(
          ["npm", "pack", "--json", "--pack-destination", work],
          packageDir,
        ),
      ),
    );
  const tarball = join(work, packed.filename);
  const consumer = join(work, "consumer");
  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }),
  );
  await run(["npm", "install", "--no-audit", "--no-fund", tarball], consumer);

  const specifiers = Object.keys(manifest.exports).map(
    (key) => manifest.name + key.slice(1),
  );
  const script = specifiers
    .map((specifier) => `await import(${JSON.stringify(specifier)});`)
    .join("\n");
  await run(["node", "--input-type=module", "-e", script], consumer);
  console.log(
    `${manifest.name}@${manifest.version}: imported ${specifiers.join(", ")}`,
  );
} finally {
  await rm(work, { recursive: true, force: true });
}
