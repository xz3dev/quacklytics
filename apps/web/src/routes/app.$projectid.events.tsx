import { createFileRoute } from "@tanstack/react-router";
import { EventsList } from "@/app/events/events-list";
export const Route = createFileRoute("/app/$projectid/events")({
  ssr: false,
  component: EventsList,
});
