import { ReactNode, useEffect } from "react";
import { useAuthStore } from "@/services/auth.ts";
import { Navigate, useLocation } from "@/lib/navigation";
import { Spinner } from "@/components/spinner.tsx";

export function RequireAuth(props: { children: ReactNode }) {
  const { user, loading } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    void useAuthStore.getState().checkAuth();
  }, []);

  if (user === null && !loading) {
    return <Navigate to="/login" replace />;
  }
  if (loading) {
    return (
      <>
        <div className="w-full h-screen flex place-content-center items-center">
          {loading && <div className="text-2xl font-medium">Loading...</div>}
          <Spinner />
        </div>
      </>
    );
  }
  return <>{props.children}</>;
}
