import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, FileInput, FileDown, FileUp, FileSpreadsheet, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import StatusToggle from "@/components/master/StatusToggle";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ImportResultModal, { normalizeImportResult, type NormalizedImportResult } from "@/components/ui/ImportResultModal";

import {
  useClientList, useToggleClientStatus, useDeleteClient, useImportClients,
  fetchAllClientsForExport,
  type ClientRecord, type ClientImportResult, type StatusFilter,
} from "@/hooks/useClients";

function formatDateExport(val: string | null | undefined) {
  if (!val) return "";
  try {
    const d = new Date(val);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;
  } catch { return String(val); }
}

function formatDateTable(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asClient = (r: TableRow) => r as unknown as ClientRecord;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function ClientMaster() {
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

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusTarget, setStatusTarget] = useState<ClientRecord | null>(null);

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<NormalizedImportResult | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) setImportMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const { data, isLoading } = useClientList({ search, status, page, limit });
  const toggleStatus = useToggleClientStatus();
  const deleteMutation = useDeleteClient();
  const importMutation = useImportClients();

  async function handleStatusConfirm() {
    if (!statusTarget) return;
    try {
      await toggleStatus.mutateAsync(statusTarget.id);
      toast({ description: "Client status updated successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
      setStatusTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast({ title: "Client deleted" });
  }

  async function handleExportAll() {
    setExportLoading(true);
    try {
      const allRows = await fetchAllClientsForExport(search, status);
      const exportData = allRows.map((c) => ({
        "Client Code": c.clientCode,
        "Brand / Client Name": c.brandName,
        "Contact Name": c.contactName,
        "Email": c.email ?? "",
        "Alternate Email": c.altEmail ?? "",
        "Contact No": c.contactNo ?? "",
        "Alternate Contact No": c.altContactNo ?? "",
        "Country": c.country ?? "",
        "Invoice Currency": c.invoiceCurrency ?? "",
        "Status": c.isActive ? "Active" : "Inactive",
        "Created By": c.createdBy,
        "Created At": formatDateExport(c.createdAt),
        "Updated By": c.updatedBy ?? "",
        "Updated At": formatDateExport(c.updatedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 28 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 10 },
        { wch: 25 }, { wch: 22 }, { wch: 25 }, { wch: 22 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clients");
      XLSX.writeFile(wb, "Clients.xlsx");
      toast({ title: "Export Complete", description: `${allRows.length} record(s) exported.` });
    } catch {
      toast({ title: "Export Failed", description: "Could not fetch records for export.", variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  }

  function downloadSample() {
    setImportMenuOpen(false);
    const sampleData = [
      {
        "Brand / Client Name": "Fusion Garments",
        "Contact Name": "Priya Sharma",
        "Email": "priya@fusiongarments.com",
        "Alternate Email": "",
        "Contact No": "9876543210",
        "Alternate Contact No": "",
        "Country": "India",
        "Invoice Currency": "INR",
        "Address Type": "Billing Address",
        "Address Line 1": "12 MG Road",
        "Address Line 2": "Bandra West",
        "Pincode": "400050",
        "City": "Mumbai",
        "State": "Maharashtra",
        "Address Country": "India",
      },
      {
        "Brand / Client Name": "Global Threads",
        "Contact Name": "John Smith",
        "Email": "john@globalthreads.com",
        "Alternate Email": "support@globalthreads.com",
        "Contact No": "9123456780",
        "Alternate Contact No": "",
        "Country": "United States",
        "Invoice Currency": "USD",
        "Address Type": "Billing Address",
        "Address Line 1": "500 Fashion Ave",
        "Address Line 2": "Suite 12",
        "Pincode": "10018",
        "City": "New York",
        "State": "New York",
        "Address Country": "United States",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [
      { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 30 },
      { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 16 },
      { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 10 },
      { wch: 16 }, { wch: 16 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clients_Sample");
    XLSX.writeFile(wb, "Clients_Import_Sample.xlsx");
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportLoading(true);
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      const mapped = rows.map((row) => {
        const contactName = String(row["Contact Name"] ?? row["contactName"] ?? "").trim();
        const contactNo = String(row["Contact No"] ?? row["contactNo"] ?? "").trim();
        const country = String(row["Country"] ?? row["country"] ?? "").trim() || undefined;

        const addrType = String(row["Address Type"] ?? "").trim();
        const addr1 = String(row["Address Line 1"] ?? "").trim();
        const addr2 = String(row["Address Line 2"] ?? "").trim();
        const pincode = String(row["Pincode"] ?? "").trim();
        const city = String(row["City"] ?? "").trim();
        const state = String(row["State"] ?? "").trim();
        const addrCountry = String(row["Address Country"] ?? "").trim() || country || "";

        const hasAddr = !!(addr1 || addr2 || city || state || pincode);
        const validTypes = ["Billing Address", "Delivery Address", "Other"];
        const addresses = hasAddr ? [{
          id: Math.random().toString(36).slice(2, 10),
          type: validTypes.includes(addrType) ? addrType : "Billing Address",
          name: contactName,
          contactNo,
          address1: addr1,
          address2: addr2,
          city,
          state,
          pincode,
          country: addrCountry,
          isBillingDefault: true,
        }] : undefined;

        return {
          brandName: String(row["Brand / Client Name"] ?? row["brandName"] ?? "").trim(),
          contactName,
          email: String(row["Email"] ?? row["email"] ?? "").trim(),
          altEmail: String(row["Alternate Email"] ?? row["altEmail"] ?? "").trim() || undefined,
          contactNo,
          altContactNo: String(row["Alternate Contact No"] ?? row["altContactNo"] ?? "").trim() || undefined,
          country,
          invoiceCurrency: String(row["Invoice Currency"] ?? row["invoiceCurrency"] ?? "").trim() || undefined,
          addresses,
        };
      });

      const importRaw = await importMutation.mutateAsync(mapped);
      setImportResult(normalizeImportResult(importRaw));
      setImportResultOpen(true);
    } catch (err) {
      toast({ title: "Import Failed", description: err instanceof Error ? err.message : "Could not import file.", variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  }

  const rows: TableRow[] = ((data?.data ?? []) as ClientRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "clientCode", label: "Client Code", render: (r) => asClient(r).clientCode },
    { key: "brandName", label: "Brand / Client Name", render: (r) => asClient(r).brandName },
    { key: "contactName", label: "Contact Name", render: (r) => asClient(r).contactName },
    { key: "email", label: "Email", render: (r) => asClient(r).email },
    { key: "contactNo", label: "Contact No", render: (r) => asClient(r).contactNo },
    { key: "country", label: "Country", render: (r) => asClient(r).country ?? asClient(r).countryOfOrigin ?? "—" },
    {
      key: "invoiceCurrency", label: "Invoice Currency", render: (r) => {
        const cur = asClient(r).invoiceCurrency;
        return cur ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{cur}</span> : <span className="text-gray-300">—</span>;
      }
    },
    {
      key: "addresses", label: "Addresses", render: (r) => {
        const count = asClient(r).addresses?.length ?? 0;
        return count > 0 ? <span className="text-xs text-gray-500">{count} address{count !== 1 ? "es" : ""}</span> : <span className="text-xs text-gray-300">—</span>;
      }
    },
    {
      key: "isActive", label: "Status", render: (r) => (
        <StatusToggle isActive={asClient(r).isActive} onToggle={() => setStatusTarget(asClient(r))} />
      )
    },
    { key: "createdBy", label: "Created By", render: (r) => asClient(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDateTable(asClient(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: (r) => asClient(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: (r) => formatDateTable(asClient(r).updatedAt) },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asClient(r);
        return (
          <div className="flex gap-2">
            <button onClick={() => setLocation(`/masters/clients/${rec.id}`)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
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
        <MasterHeader title="Client Master" onAdd={() => setLocation("/masters/clients/new")} addLabel="Add Client" />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search clients…" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <button onClick={handleExportAll} disabled={exportLoading || isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <FileDown className="h-4 w-4" />
            {exportLoading ? "Exporting…" : "Export to Excel"}
          </button>

          <div className="relative" ref={importMenuRef}>
            <button onClick={() => setImportMenuOpen(v => !v)} disabled={importLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C9B45C]/50 bg-white text-sm font-medium text-gray-700 shadow-sm hover:border-[#C9B45C] hover:bg-amber-50/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <FileInput className="h-4 w-4 text-[#C6AF4B]" />
              {importLoading ? "Importing…" : "Import Data"}
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${importMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {importMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                <button onClick={downloadSample} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div><p className="font-medium">Download Sample</p><p className="text-xs text-gray-400">Get the Excel template</p></div>
                </button>
                <div className="border-t border-gray-100" />
                <button onClick={() => { setImportMenuOpen(false); importFileRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                  <FileUp className="h-4 w-4 text-blue-600 shrink-0" />
                  <div><p className="font-medium">Upload Excel File</p><p className="text-xs text-gray-400">Import records from file</p></div>
                </button>
              </div>
            )}
            <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          </div>
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        {/* Status change confirmation */}
        <ConfirmModal
          open={statusTarget !== null}
          onCancel={() => setStatusTarget(null)}
          onConfirm={() => { void handleStatusConfirm(); }}
          title="Change Client Status"
          message="Are you sure you want to change the status?"
          confirmLabel="Yes"
          cancelLabel="No"
          loading={toggleStatus.isPending}
          danger={false}
        />

        <ImportResultModal
          open={importResultOpen}
          result={importResult}
          entityName="Clients"
          onClose={() => setImportResultOpen(false)}
        />

        {/* Delete confirmation */}
        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Client" message="Are you sure you want to delete this client? This action cannot be undone."
          loading={deleteMutation.isPending} />
      </div>
    </AppLayout>
  );
}
