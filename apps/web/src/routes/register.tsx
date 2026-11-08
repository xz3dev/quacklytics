import { createFileRoute, useLocation } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-form";
export const Route = createFileRoute("/register")({
  ssr: false,
  component: RegisterPage,
});

function RegisterPage() {
  // The one-time setup link from the server log carries the token. Read it
  // raw: search parsing would turn a numeric-looking token into a number.
  const token = useLocation({
    select: (location) => new URLSearchParams(location.searchStr).get("token"),
  });
  return <AuthForm register setupToken={token ?? undefined} />;
}
