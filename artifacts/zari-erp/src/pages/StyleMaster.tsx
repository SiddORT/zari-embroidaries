import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pencil, Trash2, Plus, FileSpreadsheet, FileDown, FileUp, ChevronDown, Loader2,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

import AppLayout from "@/components/layout/AppLayout";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import StatusToggle from "@/components/master/StatusToggle";
import ConfirmModal from "@/components/ui/ConfirmModal";

import {
  useStyleList, useToggleStyleStatus, useDeleteStyle,
  useImportStyles, fetchAllStylesForExport,
  type StyleRecord, type StatusFilter, type StyleImportResult,
} from "@/hooks/useStyles";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";

// ─── Constants ──────────────────────────────────────────────────────────────────
const PLACE_OPTIONS = ["In-house", "Out-house"];
const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];
const SELECT_CLS = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900";

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asStyle = (r: TableRow) => r as unknown as StyleRecord;

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function StyleMaster() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  useEffect(() => { if (!token || (!loadingUser && !user)) setLocation("/login"); }, [token, user, loadingUser, setLocation]);
  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync({}); } finally {
      localStorage.removeItem("zarierp_token");
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [filterClient, setFilterClient] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // ── Modals ──
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ id: number; isActive: boolean } | null>(null);

  // ── Import/Export ──
  const importRef = useRef<HTMLInputElement>(null);
  const [importDropOpen, setImportDropOpen] = useState(false);
  const [exportDropOpen, setExportDropOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<StyleImportResult | null>(null);

  // ── Data ──
  const { data, isLoading } = useStyleList({ search, status, client: filterClient, location: filterLocation, page, limit });
  const { data: clientsData } = useAllClients();

  const toggleStatus = useToggleStyleStatus();
  const deleteMutation = useDeleteStyle();
  const importMutation = useImportStyles();

  const clientOptions = ((clientsData ?? []) as ClientRecord[]).map(c => c.brandName);
  const hasFilters = !!(search || status !== "all" || filterClient || filterLocation);

  // ── Handlers ──
  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast({ title: "Style deleted" });
  }

  async function confirmStatusChange() {
    if (!statusConfirm) return;
    await toggleStatus.mutateAsync(statusConfirm.id);
    setStatusConfirm(null);
    toast({ title: "Style status updated successfully." });
  }

  function clearFilters() {
    setSearch(""); setStatus("all"); setFilterClient(""); setFilterLocation(""); setPage(1);
  }

  // ── Import ──
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
      if (!rows.length) { toast({ title: "No data found in file", variant: "destructive" }); return; }
      const result = await importMutation.mutateAsync(rows) as StyleImportResult;
      setImportResult(result);
      toast({ title: `Import done: ${result.succeeded} added, ${result.failed} failed${result.failed > 0 ? " — see details below" : ""}` });
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setImportDropOpen(false);
  }

  function downloadSample() {
    const sample = [{
      "Client": "Acme Corp",
      "Style Category": "Bridal",
      "Description": "Sample Style Name",
      "Place of Issue": "In-house",
      "Invoice No": "INV-001",
      "Vendor PO No": "PO-001",
      "Shipping Date": "2025-12-31",
      "Attach Link": "https://example.com/style",
      "Is Active": "Active",
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Styles");
    XLSX.writeFile(wb, "style_import_sample.xlsx");
    setImportDropOpen(false);
  }

  async function handleExportAll() {
    setExporting(true); setExportDropOpen(false);
    try {
      const rows = await fetchAllStylesForExport({ search, status, client: filterClient });
      const sheet = rows.map(r => ({
        "Style No": r.styleNo,
        "Client": r.client,
        "Style Category": r.styleCategory,
        "Description": r.description ?? "",
        "Place of Issue": r.placeOfIssue ?? "",
        "Invoice No": r.invoiceNo ?? "",
        "Vendor PO No": r.vendorPoNo ?? "",
        "Shipping Date": r.shippingDate ?? "",
        "Attach Link": r.attachLink ?? "",
        "Linked Swatch": r.referenceSwatchId ?? "",
        "Status": (r.isActive === true || (r.isActive as unknown) === "true") ? "Active" : "Inactive",
        "Created By": r.createdBy,
        "Created At": formatDate(r.createdAt),
        "Updated By": r.updatedBy ?? "—",
        "Updated At": r.updatedAt ? formatDate(r.updatedAt) : "—",
      }));
      const ws = XLSX.utils.json_to_sheet(sheet);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Styles");
      XLSX.writeFile(wb, `styles_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  // ── Table ──
  const rows: TableRow[] = ((data?.data ?? []) as StyleRecord[]).map((r, i) => ({ ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1 }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "client", label: "Client", render: r => asStyle(r).client },
    { key: "styleNo", label: "Style No", render: r => <span className="font-mono text-xs font-semibold text-gray-700">{asStyle(r).styleNo}</span> },
    { key: "styleCategory", label: "Category", render: r => asStyle(r).styleCategory || "—" },
    { key: "description", label: "Description", render: r => asStyle(r).description || "—" },
    { key: "referenceSwatchId", label: "Linked Swatch", render: r => asStyle(r).referenceSwatchId
      ? <span className="font-mono text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{asStyle(r).referenceSwatchId}</span>
      : "—" },
    { key: "placeOfIssue", label: "Location", render: r => asStyle(r).placeOfIssue || "—" },
    { key: "shippingDate", label: "Shipping Date", render: r => {
      const d = asStyle(r).shippingDate;
      if (!d) return "—";
      try {
        return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      } catch { return d; }
    }},
    { key: "isActive", label: "Status", render: r => (
      <StatusToggle isActive={asStyle(r).isActive} onToggle={() => setStatusConfirm({ id: asStyle(r).id, isActive: asStyle(r).isActive })} />
    )},
    { key: "createdBy", label: "Created By", render: r => asStyle(r).createdBy },
    { key: "createdAt", label: "Created At", render: r => formatDate(asStyle(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: r => asStyle(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: r => formatDate(asStyle(r).updatedAt) },
    {
      key: "actions", label: "Actions", render: r => {
        const rec = asStyle(r);
        return (
          <div className="flex gap-2">
            <button onClick={() => setLocation(`/masters/styles/${rec.id}/edit`)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
            <button onClick={() => setDeleteId(rec.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
          </div>
        );
      },
    },
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Style Master</h1>
            <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} styles</p>
          </div>
          <div className="flex items-center gap-2">

            {/* Import Dropdown */}
            <div className="relative">
              <button onClick={() => { setImportDropOpen(o => !o); setExportDropOpen(false); }}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-[#C9B45C]/50 bg-white text-gray-700 hover:border-[#C9B45C] hover:bg-amber-50/40 transition">
                <FileSpreadsheet size={15} className="text-[#C9B45C]" /> Import <ChevronDown size={13} className="text-gray-400" />
              </button>
              {importDropOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 z-30 overflow-hidden">
                  <button onClick={downloadSample}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <FileDown size={14} className="text-gray-400" /> Download Sample
                  </button>
                  <label className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                    <FileUp size={14} className="text-gray-400" /> Upload Excel
                    <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                  </label>
                </div>
              )}
            </div>

            {/* Export Dropdown */}
            <div className="relative">
              <button onClick={() => { setExportDropOpen(o => !o); setImportDropOpen(false); }} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-[#C9B45C]/50 bg-white text-gray-700 hover:border-[#C9B45C] hover:bg-amber-50/40 transition disabled:opacity-50">
                {exporting ? <Loader2 size={15} className="animate-spin text-[#C9B45C]" /> : <FileDown size={15} className="text-[#C9B45C]" />}
                Export <ChevronDown size={13} className="text-gray-400" />
              </button>
              {exportDropOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-30 overflow-hidden">
                  <button onClick={handleExportAll}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <FileDown size={14} className="text-gray-400" /> Export as Excel
                  </button>
                </div>
              )}
            </div>

            {/* Add Style */}
            <button onClick={() => setLocation("/masters/styles/new")}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 transition">
              <Plus size={15} /> Add Style
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search styles…" className="flex-1 min-w-[200px]" />
          <select value={filterClient} onChange={e => { setFilterClient(e.target.value); setPage(1); }} className={SELECT_CLS}>
            <option value="">All Clients</option>
            {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterLocation} onChange={e => { setFilterLocation(e.target.value); setPage(1); }} className={SELECT_CLS}>
            <option value="">All Locations</option>
            {PLACE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={status} onChange={e => { setStatus(e.target.value as StatusFilter); setPage(1); }} className={SELECT_CLS}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition whitespace-nowrap">
              Clear Filters
            </button>
          )}
        </div>

        {/* ── Import Results Banner ── */}
        {importResult && importResult.failed > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-amber-800">
                Import completed: {importResult.succeeded} added, {importResult.failed} failed
              </p>
              <button onClick={() => setImportResult(null)} className="text-amber-500 hover:text-amber-700 text-xs">Dismiss</button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {importResult.results.filter(r => r.status === "error").map(r => (
                <p key={r.row} className="text-xs text-amber-700">
                  Row {r.row}: {r.errors?.join("; ")}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={row => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: l => { setLimit(l); setPage(1); } }} />

        {/* ── Modals ── */}
        <ConfirmModal
          open={deleteId !== null}
          onCancel={() => setDeleteId(null)}
          onConfirm={() => { void handleDelete(); }}
          title="Delete Style"
          message="Are you sure you want to delete this style? This action cannot be undone."
        />

        <ConfirmModal
          open={statusConfirm !== null}
          onCancel={() => setStatusConfirm(null)}
          onConfirm={() => { void confirmStatusChange(); }}
          title={statusConfirm?.isActive ? "Deactivate Style" : "Activate Style"}
          message={statusConfirm?.isActive
            ? "Are you sure you want to deactivate this style?"
            : "Are you sure you want to activate this style?"}
        />

        {/* Close dropdowns on outside click */}
        {(importDropOpen || exportDropOpen) && (
          <div className="fixed inset-0 z-20" onClick={() => { setImportDropOpen(false); setExportDropOpen(false); }} />
        )}
      </div>
    </AppLayout>
  );
}
