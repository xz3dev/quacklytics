import { createFileRoute } from "@tanstack/react-router";
import Ingestion from "@/app/ingestion/ingestion";
export const Route = createFileRoute("/app/$projectid/ingestion")({
  ssr: false,
  component: Ingestion,
});
