import type { ReactNode } from "react";
import { cn } from "@/lib/utils/tailwind";

export function PageHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-8 flex min-w-0 flex-wrap items-center justify-between gap-4",
        className,
      )}
    >
      {children}
    </header>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="min-w-0 wrap-break-word text-2xl font-bold leading-9">
      {children}
    </h1>
  );
}
