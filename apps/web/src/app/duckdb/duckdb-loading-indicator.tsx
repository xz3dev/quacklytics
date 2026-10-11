import { useEffect, useState } from "react";
import { Spinner } from "@/components/spinner.tsx";
import { useDuckDb } from "@app/duckdb/duckdb-provider.tsx";

export function DuckDBLoadingIndicator(props: { children: React.ReactNode }) {
  const db = useDuckDb();
  const state = db.loadState();
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!state.isLoading()) setInitialized(true);
  }, [state]);
  const error = state.error && (
    <div role="alert" className="p-6">
      {initialized ? "Data refresh failed" : "Unable to load analytics"}:{" "}
      {state.error}{" "}
      <button
        onClick={() => {
          void db.retry().catch(() => undefined);
        }}
      >
        Retry
      </button>
    </div>
  );
  if (initialized || !state.isLoading())
    return (
      <>
        {error}
        {props.children}
      </>
    );
  if (error) return error;
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <Spinner />
      <div className="font-medium text-sm">
        {!state.initialized
          ? "Initializing DuckDB"
          : !state.catalogReady
            ? "Loading catalog"
            : "Connecting event data"}
      </div>
    </div>
  );
}
