import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { gateway, isBackendPath } from "./server/gateway";

// API and OAuth discovery requests go straight to the backend gateway, as in production (see
// server.ts). Routing them through Start would log every request the browser
// cancels, such as fetches cut off by a reload, as an AbortError.
export default createServerEntry({
  fetch(request) {
    if (isBackendPath(new URL(request.url).pathname)) return gateway(request);
    return handler.fetch(request);
  },
});
