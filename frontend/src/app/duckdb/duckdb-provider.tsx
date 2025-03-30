import {createContext, useContext, useMemo} from "react";
import {DuckDbManager} from "@/services/duck-db-manager.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {QueryClient, useQueryClient} from "@tanstack/react-query";
import {create} from 'zustand';

const DuckDbContext = createContext<DuckDbManager | null>(null);

export const DuckDbProvider = (props: { children: React.ReactNode }) => {
    const projectId = useProjectId()
    const qc = useQueryClient()

    const factory = useDuckDbManagerFactory()

    const db = useMemo(() => factory.getInstance(projectId, qc), [projectId, qc])

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



interface DuckDbManagerFactoryState {
    instances: Map<string, DuckDbManager>;
    getInstance: (projectId: string, queryClient: QueryClient) => DuckDbManager;
}

export const useDuckDbManagerFactory = create<DuckDbManagerFactoryState>((_, get) => ({
    instances: new Map(),

    getInstance: (projectId: string, queryClient: QueryClient) => {
        const {instances} = get();
        if (!instances.has(projectId)) {
            console.log(`Creating DuckDbManager instance for project ${projectId}`);
            instances.set(projectId, new DuckDbManager(projectId, queryClient));
        }
        for (const key of instances.keys()) {
            if (key !== projectId) {
                instances.delete(key);
            }
        }
        return instances.get(projectId)!;
    },
}));

