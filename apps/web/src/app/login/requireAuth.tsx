import type { ReactNode } from "react";
import { useAuth } from "@/services/auth";
import { Navigate } from "@/lib/navigation";
import { Spinner } from "@/components/spinner";
import { BrandStatus } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ProxyCheckGate } from "@/app/proxy-check/proxy-check-gate";
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, error, retry } = useAuth();
  if (error)
    return (
      <BrandStatus
        alert
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void retry();
            }}
          >
            Retry session
          </Button>
        }
      >
        Unable to verify your session. Check your connection and try again.
      </BrandStatus>
    );
  if (loading)
    return (
      <BrandStatus>
        <span className="flex items-center gap-2">
          <Spinner size="small" />
          Loading session…
        </span>
      </BrandStatus>
    );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      {children}
      <ProxyCheckGate />
    </>
  );
}
