import type { ReactNode } from "react";
import { cn } from "@/lib/utils/tailwind";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/birb-smol.svg"
      alt=""
      aria-hidden
      className={cn("size-6 shrink-0", className)}
    />
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-sm font-semibold tracking-tight",
        className,
      )}
    >
      <BrandMark />
      Quacklytics
    </span>
  );
}

// Faint dot grid that fades out toward the edges; shared by the standalone
// (non-app) pages so they read as one surface.
export function BrandBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(hsl(var(--foreground)/0.08)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]"
    />
  );
}

// Full-screen status used while the app resolves the session or fails to.
export function BrandStatus({
  children,
  action,
  alert = false,
}: {
  children: ReactNode;
  action?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <BrandBackdrop />
      <BrandMark className="size-10" />
      <div
        role={alert ? "alert" : "status"}
        className="flex max-w-sm flex-col items-center gap-4 text-sm text-muted-foreground"
      >
        {children}
        {action}
      </div>
    </div>
  );
}
