import { createFileRoute } from "@tanstack/react-router";
import { gateway as handleApi } from "../server/gateway";
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleApi(request),
      POST: ({ request }) => handleApi(request),
      PUT: ({ request }) => handleApi(request),
      PATCH: ({ request }) => handleApi(request),
      DELETE: ({ request }) => handleApi(request),
      OPTIONS: ({ request }) => handleApi(request),
    },
  },
});
