import { createFileRoute } from "@tanstack/react-router";
import { InsightsList } from "@/app/insights/insight-list";
export const Route = createFileRoute("/app/$projectid/insights")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { favorites?: boolean } =>
    search.favorites === true || search.favorites === "true"
      ? { favorites: true }
      : {},
  component: InsightsPage,
});

function InsightsPage() {
  // The router merges the raw query into validated search, so ?favorites=false
  // arrives as the string "false"; only the validated boolean counts.
  const { favorites } = Route.useSearch();
  return favorites === true ? (
    <InsightsList
      title="Favorite Insights"
      filter={(insight) => insight.favorite}
      createAsFavorite
    />
  ) : (
    <InsightsList />
  );
}
