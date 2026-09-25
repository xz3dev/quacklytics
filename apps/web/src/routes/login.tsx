import { createFileRoute } from "@tanstack/react-router";
import LoginPage from "@/app/login/page";
export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});
