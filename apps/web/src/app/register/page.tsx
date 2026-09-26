import { RegisterForm } from "@/components/register-form.tsx";

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4 md:p-6">
      <div className="w-full max-w-sm md:max-w-3xl">
        <RegisterForm />
      </div>
    </div>
  );
}
