import { PageHeader, PageTitle } from "@/components/page-header";
import type { QueryParamValue } from "@/lib/queries";
import { useDuckDBQuery } from "@/services/duck-db-queries.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { simpleHash } from "@lib/checksums.ts";
import { useState } from "react";
import { SqlQueryResults } from "@app/queries/sql-query-results.tsx";
import { SqlQueryForm } from "@app/queries/sql-query-form.tsx";

export function QueryTester() {
  const projectId = useProjectId();
  const [qData, setQData] = useState<{
    sql: string;
    params: QueryParamValue[];
  }>({
    sql: "",
    params: [],
  });
  const q = useDuckDBQuery(
    projectId,
    `q-${simpleHash(JSON.stringify(qData))}`,
    qData,
    {
      enabled: !!qData.sql,
    },
  );

  function handleSumbit(query: string, args: string[]) {
    setQData({ sql: query, params: args });
  }

  return (
    <div className="min-w-0">
      <PageHeader>
        <PageTitle>Queries</PageTitle>
      </PageHeader>
      <div className="space-y-4">
        <SqlQueryForm onSubmit={handleSumbit} />
        {q.isFetching && (
          <p role="status" className="text-sm text-muted-foreground">
            Running query…
          </p>
        )}
        {q.isError && (
          <p role="alert" className="text-sm text-destructive">
            Error: {q.error.message}
          </p>
        )}

        <SqlQueryResults data={q.data}></SqlQueryResults>
      </div>
    </div>
  );
}
