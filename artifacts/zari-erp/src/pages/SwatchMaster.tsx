import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pencil, Trash2, FileDown, FileSpreadsheet, FileUp, ChevronDown, Loader2,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

import AppLayout from "@/components/layout/AppLayout";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ImportResultModal, { normalizeImportResult, type NormalizedImportResult } from "@/components/ui/ImportResultModal";

import {
  useSwatchList, useToggleSwatchStatus, useDeleteSwatch,
  useImportSwatches, fetchAllSwatchesForExport,
  type SwatchRecord, type StatusFilter,
} from "@/hooks/useSwatches";
import { useSwatchCategories } from "@/hooks/useLookups";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";

// ─── Constants ──────────────────────────────────────────────────────────────────
const LOCATION_OPTIONS = ["Inhouse", "Client"];
const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asSwatch = (r: TableRow) => r as unknown as SwatchRecord;

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function SwatchMaster() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ query: { enabled: !!token } as any });
  useEffect(() => { if (!token || (!loadingUser && !user)) setLocation("/login"); }, [token, user, loadingUser, setLocation]);
  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync(); } finally {
      localStorage.removeItem("zarierp_token");
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [clientFilter, setClientFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [swatchCategoryFilter, setSwatchCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // ── Modals ──
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ id: number; isActive: boolean } | null>(null);

  // ── Import/Export ──
  const importRef = useRef<HTMLInputElement>(null);
  const [importDropOpen, setImportDropOpen] = useState(false);
  const [exportDropOpen, setExportDropOpen] = useState(false);
  const [importResult, setImportResult] = useState<NormalizedImportResult | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Data ──
  const { data, isLoading } = useSwatchList({ search, status, client: clientFilter, location: locationFilter, swatchCategory: swatchCategoryFilter, page, limit });
  const { data: clientsData } = useAllClients();
  const { data: swatchCatsData } = useSwatchCategories();

  const toggleStatus = useToggleSwatchStatus();
  const deleteMutation = useDeleteSwatch();
  const importMutation = useImportSwatches();

  const clientOptions = ((clientsData ?? []) as ClientRecord[]).map(c => c.brandName);
  const swatchCatOptions = (swatchCatsData ?? []).filter(c => c.isActive).map(c => ({ value: c.name, label: c.name }));

  // ── Handlers ──
  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast({ title: "Swatch deleted" });
  }

  async function confirmStatusChange() {
    if (!statusConfirm) return;
    await toggleStatus.mutateAsync(statusConfirm.id);
    setStatusConfirm(null);
    toast({ title: "Swatch status updated successfully." });
  }

  function clearFilters() {
    setSearch(""); setStatus("all"); setClientFilter(""); setLocationFilter(""); setSwatchCategoryFilter(""); setPage(1);
  }
  const hasFilters = search || status !== "all" || clientFilter || locationFilter || swatchCategoryFilter;

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
      const importRaw = await importMutation.mutateAsync(rows);
      setImportResult(normalizeImportResult(importRaw));
      setImportResultOpen(true);
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setImportDropOpen(false);
  }

  function downloadSample() {
    const sample = [{ "Swatch Name": "Silk Brocade", Client: "", Category: "Thread", "Base Fabric": "", Location: "Inhouse", Date: "2024-01-15", Length: "120", Width: "60", "Unit Type": "Meters", Hours: "4.5" }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Swatches");
    XLSX.writeFile(wb, "swatch_import_sample.xlsx");
    setImportDropOpen(false);
  }

  async function handleExportAll() {
    setExporting(true); setExportDropOpen(false);
    try {
      const rows = await fetchAllSwatchesForExport({ search, status, client: clientFilter, location: locationFilter, swatchCategory: swatchCategoryFilter });
      const sheet = rows.map(r => ({
        "Swatch No": r.swatchCode, "Swatch Name": r.swatchName,
        "Client": r.client ?? "", "Category": r.swatchCategory ?? "",
        "Base Fabric": r.fabric ?? "", "Location": r.location ?? "",
        "Date": r.swatchDate ?? "", "Length": r.length ?? "",
        "Width": r.width ?? "", "Unit Type": r.unitType ?? "",
        "Hours": r.hours ?? "", "Status": r.isActive ? "Active" : "Inactive",
        "Created By": r.createdBy, "Created At": formatDate(r.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(sheet);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Swatches");
      XLSX.writeFile(wb, "swatches_export.xlsx");
      toast({ title: `Exported ${rows.length} records` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally { setExporting(false); }
  }

  // ── Table ──
  const rows: TableRow[] = ((data?.data ?? []) as SwatchRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "swatchCode", label: "Swatch No", render: r => asSwatch(r).swatchCode },
    { key: "swatchName", label: "Swatch Name", render: r => asSwatch(r).swatchName },
    { key: "client", label: "Client", render: r => asSwatch(r).client || "—" },
    { key: "swatchCategory", label: "Category", render: r => asSwatch(r).swatchCategory || "—" },
    { key: "fabric", label: "Base Fabric", render: r => asSwatch(r).fabric || "—" },
    { key: "location", label: "Location", render: r => {
      const loc = asSwatch(r).location;
      if (!loc) return "—";
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${loc === "Inhouse" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>{loc}</span>;
    }},
    { key: "swatchDate", label: "Date", render: r => formatDate(asSwatch(r).swatchDate) },
    { key: "length", label: "Length", render: r => asSwatch(r).length || "—" },
    { key: "unitType", label: "Unit", render: r => asSwatch(r).unitType || "—" },
    { key: "width", label: "Width", render: r => asSwatch(r).width || "—" },
    { key: "isActive", label: "Status", render: r => {
      const rec = asSwatch(r);
      return (
        <button type="button" onClick={() => setStatusConfirm({ id: rec.id, isActive: rec.isActive })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rec.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${rec.isActive ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </button>
      );
    }},
    { key: "createdBy", label: "Created By", render: r => asSwatch(r).createdBy },
    { key: "actions", label: "Actions", render: r => {
      const rec = asSwatch(r);
      return (
        <div className="flex gap-2">
          <button onClick={() => setLocation(`/masters/swatches/${rec.id}/edit`)}
            className="p-1 rounded hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
          <button onClick={() => setDeleteId(rec.id)}
            className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
        </div>
      );
    }},
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Swatch Master</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage swatch master records</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Import */}
            <div className="relative">
              <button onClick={() => { setImportDropOpen(o => !o); setExportDropOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[#C9B45C]/50 bg-white text-gray-700 hover:border-[#C9B45C] hover:bg-amber-50/40 transition">
                <FileSpreadsheet size={15} className="text-[#C9B45C]" /> Import <ChevronDown size={13} className="text-gray-400" />
              </button>
              {importDropOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-48">
                  <button onClick={downloadSample} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                    <FileDown size={14} className="text-[#C9B45C]" /> Download Sample
                  </button>
                  <label className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                    <FileUp size={14} className="text-[#C9B45C]" /> Upload Excel
                    <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                  </label>
                </div>
              )}
            </div>
            {/* Export */}
            <div className="relative">
              <button onClick={() => { setExportDropOpen(o => !o); setImportDropOpen(false); }} disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[#C9B45C]/50 bg-white text-gray-700 hover:border-[#C9B45C] hover:bg-amber-50/40 transition disabled:opacity-60">
                {exporting ? <Loader2 size={15} className="animate-spin text-[#C9B45C]" /> : <FileDown size={15} className="text-[#C9B45C]" />}
                Export <ChevronDown size={13} className="text-gray-400" />
              </button>
              {exportDropOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                  <button onClick={handleExportAll} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                    <FileDown size={14} className="text-[#C9B45C]" /> Export All
                  </button>
                </div>
              )}
            </div>
            {/* Add Swatch */}
            <button onClick={() => setLocation("/masters/swatches/new")}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 font-medium transition">
              + Add Swatch
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search swatches…" />
          </div>
          <select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
            <option value="">All Clients</option>
            {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={locationFilter} onChange={e => { setLocationFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
            <option value="">All Locations</option>
            {LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={swatchCategoryFilter} onChange={e => { setSwatchCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
            <option value="">All Categories</option>
            {swatchCatOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={status} onChange={e => { setStatus(e.target.value as StatusFilter); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition whitespace-nowrap">
              Clear Filters
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={row => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: l => { setLimit(l); setPage(1); } }} />

        {/* ── Modals ── */}
        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Swatch" message="Are you sure you want to delete this swatch?" />

        <ImportResultModal
          open={importResultOpen}
          result={importResult}
          entityName="Swatches"
          onClose={() => setImportResultOpen(false)}
        />

        <ConfirmModal open={statusConfirm !== null} onCancel={() => setStatusConfirm(null)} onConfirm={() => { void confirmStatusChange(); }}
          title="Change Status"
          message={`Are you sure you want to ${statusConfirm?.isActive ? "deactivate" : "activate"} this swatch?`} />

        {(importDropOpen || exportDropOpen) && (
          <div className="fixed inset-0 z-20" onClick={() => { setImportDropOpen(false); setExportDropOpen(false); }} />
        )}
      </div>
    </AppLayout>
  );
}
