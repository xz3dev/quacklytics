import { createFileRoute } from "@tanstack/react-router";
import { QueryTester } from "@/app/queries/query-tester";
export const Route = createFileRoute("/app/$projectid/queries")({
  ssr: false,
  component: QueryTester,
});
