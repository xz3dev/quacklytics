import { z } from "zod";
import { workerRequest } from "../../apps/web/src/server/worker-protocol";
const input = z.union([
  workerRequest,
  z.object({ type: z.literal("release") }),
]);
const held: (() => void)[] = [];
self.onmessage = async (event: MessageEvent<unknown>) => {
  const message = input.parse(event.data);
  if (message.type === "release") {
    for (const resolve of held.splice(0)) resolve();
    return;
  }
  if (message.type === "shutdown") {
    self.postMessage({ type: "shutdown" });
    return;
  }
  const path = new URL(message.url).pathname;
  if (path === "/hold")
    await new Promise<void>((resolve) => held.push(resolve));
  self.postMessage({
    type: "response",
    id: message.id,
    status: 200,
    headers: [],
    body: "completed",
  });
};
