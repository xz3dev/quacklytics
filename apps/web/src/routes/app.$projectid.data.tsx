import { createFileRoute } from "@tanstack/react-router";
import { SchemaView } from "@/app/schema/schema-view";
export const Route = createFileRoute("/app/$projectid/data")({
  ssr: false,
  component: SchemaView,
});
