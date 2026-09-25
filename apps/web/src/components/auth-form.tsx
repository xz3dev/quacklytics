import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { useNavigate } from "@/lib/navigation";
import { useAuthStore } from "@/services/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function AuthForm({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const auth = useAuthStore();
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
        await (register
          ? auth.register(value.email, value.password)
          : auth.login(value.email, value.password));
        await navigate("/projects");
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Authentication failed",
        );
      }
    },
  });
  return (
    <section className="mx-auto w-full max-w-md rounded-xl bg-card p-8">
      <h1 className="text-2xl font-bold mb-6">
        {register ? "Create an account" : "Welcome back"}
      </h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-5"
      >
        <form.Field name="email">
          {(field) => (
            <label className="block">
              Email
              <Input
                name="email"
                type="email"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <label className="block">
              Password
              <Input
                name="password"
                type="password"
                minLength={register ? 12 : 1}
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        {register && (
          <form.Field name="confirmPassword">
            {(field) => (
              <label className="block">
                Confirm Password
                <Input
                  name="confirmPassword"
                  type="password"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </label>
            )}
          </form.Field>
        )}
        {error && (
          <p role="alert" className="text-red-500">
            {error}
          </p>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(pending) => (
            <Button type="submit" disabled={pending}>
              {register ? "Register" : "Login"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </section>
  );
}
