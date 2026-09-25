import { createFileRoute } from "@tanstack/react-router";
import { AppFrame } from "@/app/appframe";
export const Route = createFileRoute("/app/$projectid")({
  ssr: false,
  component: AppFrame,
});
