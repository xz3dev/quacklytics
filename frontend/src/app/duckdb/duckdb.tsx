import {DuckDBLoadingIndicator} from "@app/duckdb/duckdb-loading-indicator.tsx";

export function DuckDB(props: { children: React.ReactNode }) {
    return (
        <>
            <DuckDBLoadingIndicator>
                {props.children}
            </DuckDBLoadingIndicator>
        </>
    )
}
