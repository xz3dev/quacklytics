import { createFileRoute } from "@tanstack/react-router";
import { InsightView } from "@/app/insights/insight-view";

export const Route = createFileRoute(
  "/app/$projectid/insights_/$insightid_/edit",
)({
  ssr: false,
  component: Page,
});

function Page() {
  return (
    <InsightView insightId={Number(Route.useParams().insightid)} mode="edit" />
  );
}
