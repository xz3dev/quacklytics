import { createFileRoute } from "@tanstack/react-router";
import RegisterPage from "@/app/register/page";
export const Route = createFileRoute("/register")({
  ssr: false,
  component: RegisterPage,
});
