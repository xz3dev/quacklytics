// E2E-only clock injection runs in the real Bun backend/export workers, leaving
// SSR and the S3 service on wall time. No production clock hooks are required.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isMainThread } from "node:worker_threads";
import { z } from "zod";
const path = z.string().parse(process.env.ANALYTICS_TEST_CLOCK);
const now = () =>
  Date.parse(z.iso.datetime().parse(readFileSync(path, "utf8").trim()));
if (!isMainThread) {
  globalThis.Date = new Proxy(Date, {
    construct(target, args: unknown[], newTarget) {
      return Reflect.construct(target, args.length ? args : [now()], newTarget);
    },
  });
  Date.now = now;
}
// Bun workers do not inherit CLI preloads. Wrap their entry points so both the
// backend and its export worker receive the deterministic test clock.
globalThis.Worker = class extends Worker {
  constructor(...args: ConstructorParameters<typeof Worker>) {
    const [entry, options] = args;
    const url =
      entry instanceof URL ? entry.href : pathToFileURL(resolve(entry)).href;
    const wrapper = URL.createObjectURL(
      new Blob(
        [
          `import ${JSON.stringify(import.meta.url)}; await import(${JSON.stringify(url)});`,
        ],
        { type: "application/javascript" },
      ),
    );
    super(wrapper, options);
    // Keep the blob alive until this test process exits; Bun loads it asynchronously.
  }
};
