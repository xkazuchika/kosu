import type { ReactNode } from "react";

type DataTableProps = {
  columns: string[];
  emptyMessage: string;
  rows: ReactNode[][];
};

export function DataTable({ columns, emptyMessage, rows }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-950/[0.03]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              {columns.map((column) => (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500" key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr className="hover:bg-slate-50/70" key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td className="px-4 py-3.5 text-slate-700" key={cellIndex}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-slate-500" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
