import { createContext, useContext, useEffect, useState } from "react";
import { DuckDbManager } from "@/client/analytics/manager";
import { useProjectId } from "@/hooks/use-project-id";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/spinner";
const DuckDbContext = createContext<DuckDbManager | null>(null);
export function DuckDbProvider({ children }: { children: React.ReactNode }) {
  const projectId = useProjectId();
  return (
    <ProjectDatabase key={projectId} projectId={projectId}>
      {children}
    </ProjectDatabase>
  );
}
function ProjectDatabase({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const client = useQueryClient();
  const [db, setDb] = useState<DuckDbManager | null>(null);
  useEffect(() => {
    const manager = new DuckDbManager(projectId, client);
    setDb(manager);
    void manager.start().catch(() => undefined);
    return () => {
      void client.cancelQueries({ queryKey: ["duckdb", projectId] });
      client.removeQueries({ queryKey: ["duckdb", projectId] });
      void manager
        .close()
        .catch((error) => console.warn("Database cleanup failed", error));
    };
  }, [projectId, client]);
  if (!db)
    return (
      <div className="p-6">
        <Spinner />
      </div>
    );
  return <DuckDbContext.Provider value={db}>{children}</DuckDbContext.Provider>;
}
export function useDuckDb() {
  const db = useContext(DuckDbContext);
  if (!db) throw new Error("useDuckDb must be used within a DuckDbProvider");
  return db;
}
