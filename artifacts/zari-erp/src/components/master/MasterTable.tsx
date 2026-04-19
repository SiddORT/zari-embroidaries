import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { ReactNode } from "react";

export type TableRow = Record<string, unknown>;

export interface Column {
  key: string;
  label: string;
  render?: (row: TableRow) => ReactNode;
  className?: string;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

interface MasterTableProps {
  columns: Column[];
  rows: TableRow[];
  loading?: boolean;
  emptyText?: string;
  pagination: PaginationState;
  rowKey: (row: TableRow) => string | number;
  showSerial?: boolean;
}

export default function MasterTable({
  columns,
  rows,
  loading = false,
  emptyText = "No records found.",
  pagination,
  rowKey,
  showSerial = false,
}: MasterTableProps) {
  const { page, limit, total, onPageChange, onLimitChange } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const serialStart = (page - 1) * limit + 1;
  const totalCols = columns.length + (showSerial ? 1 : 0);

  return (
    <div className="bg-white rounded-2xl border border-[#C6AF4B]/20 shadow-[0_2px_16px_rgba(198,175,75,0.10),0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#C6AF4B]/10" style={{ background: "linear-gradient(to right, rgba(198,175,75,0.04), rgba(198,175,75,0.02))" }}>
              {showSerial && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap w-12">
                  Sr.
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap ${col.className ?? ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: totalCols }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-4 py-12 text-center text-gray-400">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={rowKey(row)} className="hover:bg-amber-50/40 transition-colors">
                  {showSerial && (
                    <td className="px-4 py-3 text-gray-400 text-xs font-medium w-12">
                      {serialStart + idx}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.className ?? ""}`}>
                      {col.render ? col.render(row) : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#C6AF4B]/10" style={{ background: "linear-gradient(to right, rgba(198,175,75,0.03), rgba(198,175,75,0.01))" }}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => { onLimitChange(Number(e.target.value)); onPageChange(1); }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>
            {total === 0 ? "0 records" : `${start}–${end} of ${total}`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <PageBtn onClick={() => onPageChange(1)} disabled={page === 1} title="First page">
            <ChevronsLeft className="h-4 w-4" />
          </PageBtn>
          <PageBtn onClick={() => onPageChange(page - 1)} disabled={page === 1} title="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </PageBtn>
          <span className="px-3 py-1.5 text-sm font-medium text-gray-700">
            {page} / {totalPages}
          </span>
          <PageBtn onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} title="Next page">
            <ChevronRight className="h-4 w-4" />
          </PageBtn>
          <PageBtn onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} title="Last page">
            <ChevronsRight className="h-4 w-4" />
          </PageBtn>
        </div>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
