import { useAuth } from "@/services/auth.ts";
import { useServerSetup } from "@/services/server-setup.ts";
import { useNavigate } from "@/lib/navigation";
import { useEffect } from "react";
import { BrandStatus } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";

export function Landing() {
  const { user, loading, error, retry } = useAuth();
  const setup = useServerSetup();
  const nav = useNavigate();

  useEffect(() => {
    if (error || loading || setup.isLoading || !setup.data) return;

    if (user) {
      nav("/projects");
      return;
    }

    if (!setup.data.adminRegistered) {
      nav("/register");
    } else {
      nav("/login");
    }
  }, [error, loading, user, setup.isLoading, setup.data, nav]);

  if (error || setup.error)
    return (
      <BrandStatus
        alert
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void retry();
              void setup.refetch();
            }}
          >
            Retry connection
          </Button>
        }
      >
        Unable to connect. Please try again.
      </BrandStatus>
    );
  return (
    <BrandStatus>
      <Spinner size="small" />
    </BrandStatus>
  );
}
