import { Download } from "lucide-react";
import * as XLSX from "xlsx";

export interface ExportColumn {
  key: string;
  label: string;
}

interface ExportExcelButtonProps {
  data: Record<string, unknown>[];
  filename?: string;
  columns: ExportColumn[];
  disabled?: boolean;
}

export default function ExportExcelButton({
  data,
  filename = "export",
  columns,
  disabled = false,
}: ExportExcelButtonProps) {
  const handleExport = () => {
    const rows = data.map((row) =>
      Object.fromEntries(columns.map(({ key, label }) => [label, row[key] ?? ""]))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || data.length === 0}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="h-4 w-4" />
      Export to Excel
    </button>
  );
}
