import { createFileRoute } from "@tanstack/react-router";
import { InsightsList } from "@/app/insights/insight-list";
export const Route = createFileRoute("/app/$projectid/insights")({
  ssr: false,
  component: InsightsList,
});
