import { createFileRoute, redirect } from "@tanstack/react-router";

// Old URL for the event schema page; kept so existing bookmarks still work.
export const Route = createFileRoute("/app/$projectid/data")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/$projectid/schema",
      params,
      replace: true,
    });
  },
});
