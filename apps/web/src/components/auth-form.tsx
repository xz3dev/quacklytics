import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { Navigate, useNavigate } from "@/lib/navigation";
import { useAuth } from "@/services/auth";
import { signedAuthorization } from "@/services/oauth";
import { useServerSetup } from "@/services/server-setup";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Brand, BrandBackdrop, BrandMark } from "@/components/brand";

export function AuthForm({
  register = false,
  setupToken,
}: {
  register?: boolean;
  /** Token from the one-time setup link; registration requires it. */
  setupToken?: string | undefined;
}) {
  const setup = useServerSetup();
  // Only a single admin account can be registered; afterwards the
  // registration page is no longer useful.
  if (register && setup.data?.adminRegistered)
    return <Navigate to="/login" replace />;
  const awaitingSetup = setup.data?.adminRegistered === false;

  return (
    <div className="relative isolate flex min-h-dvh flex-col bg-background">
      <BrandBackdrop />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-xs">
              <BrandMark className="size-8" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {register ? "Set up Quacklytics" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {register
                ? "Create the admin account for this instance."
                : signedAuthorization()
                  ? "Sign in to review an agent's request for access."
                  : "Sign in to your Quacklytics instance."}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-xs">
            {register && !setupToken ? (
              <SetupLinkHint />
            ) : (
              <CredentialsForm register={register} setupToken={setupToken} />
            )}
          </div>
          {!register && awaitingSetup && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              First time here? Check the server logs for the one-time setup link
              to create the admin account.
            </p>
          )}
        </div>
      </main>
      <footer className="flex justify-center pb-8 text-muted-foreground">
        <Brand className="text-xs font-medium opacity-70 [&_img]:size-4" />
      </footer>
    </div>
  );
}

function SetupLinkHint() {
  return (
    <div role="status" className="space-y-2 text-sm">
      <p className="font-medium">Open the one-time setup link</p>
      <p className="text-muted-foreground">
        To keep others from claiming this instance, the admin account can only
        be created through a setup link. Check the server logs for the URL with
        the one-time setup link, then open it here.
      </p>
    </div>
  );
}

function CredentialsForm({
  register,
  setupToken,
}: {
  register: boolean;
  setupToken: string | undefined;
}) {
  const navigate = useNavigate();
  const auth = useAuth();
  const [error, setError] = useState("");
  const form = useForm({
    defaultValues: { email: "", password: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      setError("");
      if (register && value.password !== value.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      try {
        const next = await (register
          ? auth.register(value.email, value.password, setupToken ?? "")
          : auth.login(value.email, value.password));
        // Signing in during an agent's authorization continues it instead.
        if (next) window.location.assign(next);
        else await navigate("/projects");
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Authentication failed",
        );
      }
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-5"
    >
      <form.Field name="email">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="you@example.com"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 12 : 1}
              required
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {register && (
              <p className="text-xs text-muted-foreground">
                At least 12 characters.
              </p>
            )}
          </div>
        )}
      </form.Field>
      {register && (
        <form.Field name="confirmPassword">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="auth-confirm-password">Confirm password</Label>
              <Input
                id="auth-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-red-400"
        >
          {error}
        </p>
      )}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <Button type="submit" disabled={pending} className="w-full">
            {register
              ? pending
                ? "Creating account…"
                : "Create account"
              : pending
                ? "Signing in…"
                : "Sign in"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
