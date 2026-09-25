import { createFileRoute } from "@tanstack/react-router";
import Settings from "@/settings/settings";
export const Route = createFileRoute("/app/$projectid/settings")({
  ssr: false,
  component: Settings,
});
