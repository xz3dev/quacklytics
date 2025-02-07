import {create} from "zustand/index";
import {ParquetManager} from "@lib/parquet-manager.ts";
import {createContext, useEffect} from "react";
import {DuckDBLoadingIndicator} from "@app/duckdb/duckdb-loading-indicator.tsx";
import {DuckDbManager} from "@/services/duck-db-manager.ts";


interface DuckDBState {
    isLoading: boolean
    db: DuckDbManager
    parquetManager: ParquetManager,
}

export const useDuckDBStore = create<DuckDBState>(() => ({
    isLoading: true,
    db: new DuckDbManager(),
    parquetManager: new ParquetManager(),
}))

export const useDB = () => useDuckDBStore(state => state.db)

export function DuckDB(props: { children: React.ReactNode }) {
    const pqManager = useDuckDBStore(state => state.parquetManager)
    const db = useDB()

    useEffect(() => {
        pqManager
            .downloadLast12Weeks()
            .then((files) => db.importParquetFiles(files))
            .then(() => {
                useDuckDBStore.setState({isLoading: false})
            })
    })
    return (
        <>
            <DuckDBLoadingIndicator>
                {props.children}
            </DuckDBLoadingIndicator>
        </>
    )
}

export const DuckDBContext = createContext<Context>({
    status: 'loading',
    dataManager: {},
    dataDownloader: {},
    dataImporter: {},
    database: {},
    dataStore: {},
})

interface Context {
    status: 'loading' | 'ready'
    dataManager: unknown
    dataDownloader: unknown
    dataImporter: unknown
    dataStore: unknown
    database: unknown
}
