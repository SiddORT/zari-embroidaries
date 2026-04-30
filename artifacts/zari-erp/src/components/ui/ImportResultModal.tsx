import * as XLSX from "xlsx";

export interface NormalizedImportError {
  row: number;
  name?: string;
  error: string;
}

export interface NormalizedImportResult {
  imported: number;
  skipped: number;
  errors: NormalizedImportError[];
}

/**
 * Normalizes two different server import result shapes into a single format.
 *
 * Format A (Vendors, Fabrics, HSN, StyleCategories, SwatchCategories, Clients):
 *   { imported, skipped, errors: [{ row, name, error }] }
 *
 * Format B (Materials, Items, ItemTypes, Styles, Swatches):
 *   { succeeded, failed, results: [{ row, status, name?, errors? }] }
 */
export function normalizeImportResult(raw: unknown): NormalizedImportResult {
  const r = raw as Record<string, unknown>;

  if (typeof r.succeeded === "number") {
    const results = (
      r.results as Array<{
        row: number;
        status: string;
        name?: string;
        errors?: string[];
      }>
    ) ?? [];

    const errors = results
      .filter((x) => x.status === "error")
      .map((x) => ({
        row: x.row,
        name: x.name,
        error: (x.errors ?? []).join("; "),
      }));

    return {
      imported: r.succeeded as number,
      skipped: 0,
      errors,
    };
  }

  return {
    imported: (r.imported as number) ?? 0,
    skipped: (r.skipped as number) ?? 0,
    errors: (r.errors as NormalizedImportError[]) ?? [],
  };
}

interface ImportResultModalProps {
  open: boolean;
  result: NormalizedImportResult | null;
  entityName: string;
  onClose: () => void;
}

export default function ImportResultModal({
  open,
  result,
  entityName,
  onClose,
}: ImportResultModalProps) {
  if (!open || !result) return null;

  function downloadErrorReport() {
    if (!result) return;
    const rows = result.errors.map((e) => ({
      "Row #": e.row,
      "Record Name / Identifier": e.name ?? "—",
      "Error Details": e.error,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 8 }, { wch: 35 }, { wch: 70 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Errors");
    XLSX.writeFile(wb, `${entityName.replace(/\s+/g, "_")}_Import_Errors.xlsx`);
  }

  const showSkipped = result.skipped > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Import Complete</h2>

        <div className={`grid gap-3 ${showSkipped ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{result.imported}</p>
            <p className="text-xs text-emerald-700 mt-0.5 font-medium">Imported</p>
          </div>
          {showSkipped && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
              <p className="text-xs text-amber-700 mt-0.5 font-medium">Skipped (Duplicate)</p>
            </div>
          )}
          <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
            <p className="text-xs text-red-700 mt-0.5 font-medium">Errors</p>
          </div>
        </div>

        {result.errors.length === 0 && (
          <p className="text-sm text-center text-emerald-700 py-1 font-medium">
            All records were imported successfully!
          </p>
        )}

        {result.errors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Row Errors ({result.errors.length})
              </p>
              <button
                onClick={downloadErrorReport}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#C6AF4B] hover:text-[#a89030] transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Download Error Report (.xlsx)
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
              {result.errors.map((e, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-red-50 border border-red-100 px-3 py-2"
                >
                  <p className="text-xs font-semibold text-red-700">
                    Row {e.row}
                    {e.name ? ` — "${e.name}"` : ""}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
                    {e.error}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
