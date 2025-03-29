import {createContext, useContext, useMemo} from "react";
import {DuckDbManager} from "@/services/duck-db-manager.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";

const DuckDbContext = createContext<DuckDbManager | null>(null);

export const DuckDbProvider = (props: { children: React.ReactNode }) => {
    const projectId = useProjectId()
    const db = useMemo(() => {
        console.log(`creating db`)
        return new DuckDbManager();
    }, [projectId])

    return (
        <DuckDbContext.Provider value={db}>
            {props.children}
        </DuckDbContext.Provider>
    );
};

export const useDuckDb = () => {
    const context = useContext(DuckDbContext);
    if (!context) {
        throw new Error("useDuckDb must be used within a DuckDbProvider");
    }
    return context;
};
