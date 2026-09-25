import { resolve, sep } from "node:path";
import { z } from "zod";
import { gateway, shutdownBackend } from "./src/server/gateway";
const modulePath = resolve("dist/server/server.js");
const rawModule: unknown = await import(modulePath);
const module = z
  .object({
    default: z.object({
      fetch: z.function({
        input: [z.instanceof(Request)],
        output: z.promise(z.instanceof(Response)),
      }),
    }),
  })
  .parse(rawModule);
const publicRoot = resolve("dist/client");
const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: process.env.HOST ?? "0.0.0.0",
  idleTimeout: 120,
  fetch: async (request, runtime) => {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/"))
      return gateway(request, runtime.requestIP(request)?.address);
    const filePath = resolve(publicRoot, "." + decodeURIComponent(path));
    if (filePath.startsWith(publicRoot + sep)) {
      const file = Bun.file(filePath);
      if (await file.exists())
        return new Response(file, {
          headers: {
            "Cache-Control": path.startsWith("/assets/")
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          },
        });
    }
    const response = await module.default.fetch(request);
    // The SSR bundle can return a Node response wrapper. Bun.serve requires
    // a native Response; preserve the streaming body, status and headers.
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  },
});
console.log(`Quacklytics listening on ${server.url}`);
async function shutdown() {
  server.stop();
  await shutdownBackend();
  process.exit(0);
}
process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});
