import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import type { ResultRow } from "@quacklytics/contracts";
export function SqlQueryResults({ data }: { data: ResultRow[] | undefined }) {
  const columns = useMemo<ColumnDef<ResultRow>[]>(
    () =>
      Object.keys(data?.[0] ?? {}).map((key) => ({
        id: key,
        accessorFn: (row) => row[key],
        header: key,
        cell: (info) => {
          const value = info.getValue();
          return value === null || value === undefined
            ? "NULL"
            : value instanceof Date
              ? value.toISOString()
              : String(value);
        },
      })),
    [data],
  );
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  if (!data) return <p>Run a query to see results.</p>;
  if (!data.length) return <p>Empty result set.</p>;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/70">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th className="p-2 text-left" key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="even:bg-muted/40">
              {row.getVisibleCells().map((cell) => (
                <td className="px-3 py-3" key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
