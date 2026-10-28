import { useMemo } from "react";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ResultRow } from "@quacklytics/contracts";
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ResultRow>();
const noRows: ResultRow[] = [];
export function SqlQueryResults({ data }: { data: ResultRow[] | undefined }) {
  const columns = useMemo(
    () =>
      helper.columns(
        Object.keys(data?.[0] ?? {}).map((key) =>
          helper.accessor((row) => row[key], {
            id: key,
            header: key,
            cell: (info) => {
              const value = info.getValue();
              return value === null || value === undefined
                ? "NULL"
                : value instanceof Date
                  ? value.toISOString()
                  : String(value);
            },
          }),
        ),
      ),
    [data],
  );
  const table = useTable({ features, data: data ?? noRows, columns });
  if (!data)
    return (
      <p className="rounded-xl border border-dashed border-primary/20 bg-primary/3 px-6 py-10 text-center text-sm text-muted-foreground">
        Run a query to see results.
      </p>
    );
  if (!data.length)
    return (
      <p
        role="status"
        className="rounded-xl border border-dashed border-primary/20 bg-primary/3 px-6 py-10 text-center text-sm text-muted-foreground"
      >
        Empty result set.
      </p>
    );
  return (
    <div className="overflow-auto rounded-xl border border-border/50 bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/70">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  className="h-11 px-4 text-left font-medium text-muted-foreground"
                  key={header.id}
                >
                  <table.FlexRender header={header} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="even:bg-muted/40">
              {row.getAllCells().map((cell) => (
                <td className="px-4 py-3" key={cell.id}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
