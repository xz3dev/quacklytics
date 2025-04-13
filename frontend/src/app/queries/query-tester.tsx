import {useDuckDBQuery} from "@/services/duck-db-queries.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {simpleHash} from "@lib/checksums.ts";
import {useState} from "react";
import {SqlQueryResults} from "@app/queries/sql-query-results.tsx";
import {SqlQueryForm} from "@app/queries/sql-query-form.tsx";


export function QueryTester() {
    const projectId = useProjectId()
    const [qData, setQData] = useState<{
        sql: string,
        params: any[],
    }>({
        sql: '',
        params: [],
    })
    const q = useDuckDBQuery(
        projectId,
        `q-${simpleHash(JSON.stringify(qData))}`,
        qData,
        {
            enabled: !!qData.sql,
        }
    )

    function handleSumbit(query: string, args: string[]) {
        setQData({sql: query, params: args})
    }

    return (
        <>
            <SqlQueryForm
                onSubmit={handleSumbit}
            />
            {(q.isLoading || q.isPending) && !qData && <div>Loading...</div>}
            {q.isError && <div>Error: {q.error.message}</div>}

            <SqlQueryResults
                data={q.data}
            ></SqlQueryResults>
        </>
    )
}

