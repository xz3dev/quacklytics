import type { ReactNode } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Link } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RequireAuth } from "@/app/login/requireAuth";
import { useAuth } from "@/services/auth";
import { cn } from "@/lib/utils/tailwind";
import { Brand, BrandBackdrop } from "@/components/brand";

export function ProjectsShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="relative isolate min-h-dvh bg-background">
        <BrandBackdrop />
        <ShellHeader />
        <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
          {children}
        </main>
      </div>
    </RequireAuth>
  );
}

function ShellHeader() {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/projects"
          aria-label="Quacklytics projects"
          className="flex items-center"
        >
          <Brand />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto min-w-0 gap-3 px-2 py-1.5 text-left"
            >
              <span className="grid min-w-0 leading-tight">
                <span className="text-[11px] font-normal text-muted-foreground">
                  Logged in as
                </span>
                <span className="max-w-48 truncate text-sm font-medium">
                  {user?.email}
                </span>
              </span>
              <ChevronDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onSelect={() => {
                void logout();
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function ProjectAvatar({
  name,
  emoji,
  className,
}: {
  name: string;
  emoji: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted text-base font-semibold",
        className,
      )}
    >
      {emoji || name.trim()[0]?.toUpperCase() || "?"}
    </span>
  );
}
