import { createFileRoute } from "@tanstack/react-router";
import { ConsentPage } from "@/app/oauth/consent-page";
export const Route = createFileRoute("/oauth/consent")({
  ssr: false,
  component: ConsentPage,
});
