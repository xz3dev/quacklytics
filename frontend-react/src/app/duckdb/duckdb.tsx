import {DuckDbManager} from "../../services/duck-db-manager.js";
import {create} from "zustand/index";
import {ParquetManager} from "@lib/parquet-manager.ts";
import {useEffect} from "react";


interface DuckDBState {
    isLoading: boolean
    db: DuckDbManager
    parquetManager: ParquetManager,
}

const useDuckDBStore = create<DuckDBState>(() => ({
    isLoading: true,
    db: new DuckDbManager(),
    parquetManager: new ParquetManager(),
}))

export const useDB = () => useDuckDBStore(state => state.db)

export function DuckDB(props: { children: React.ReactNode }) {
    const dbStore = useDuckDBStore()

    useEffect(() => {
        void dbStore.parquetManager.downloadLast12Weeks()
    })
    return (
        <>
            {props.children}
        </>
    )
}
