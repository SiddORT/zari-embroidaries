import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import StatusToggle from "@/components/master/StatusToggle";
import ExportExcelButton, { type ExportColumn } from "@/components/master/ExportExcelButton";
import ConfirmModal from "@/components/ui/ConfirmModal";

import {
  useClientList, useToggleClientStatus, useDeleteClient,
  type ClientRecord, type StatusFilter,
} from "@/hooks/useClients";

function formatDate(val: string | null | undefined) {
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

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useClientList({ search, status, page, limit });
  const toggleStatus = useToggleClientStatus();
  const deleteMutation = useDeleteClient();

  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast({ title: "Client deleted" });
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
    { key: "isActive", label: "Status", render: (r) => <StatusToggle isActive={asClient(r).isActive} onToggle={() => toggleStatus.mutate(asClient(r).id)} /> },
    { key: "createdBy", label: "Created By", render: (r) => asClient(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDate(asClient(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: (r) => asClient(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: (r) => formatDate(asClient(r).updatedAt) },
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

  const exportColumns: ExportColumn[] = [
    { key: "clientCode", label: "Client Code" },
    { key: "brandName", label: "Brand / Client Name" },
    { key: "contactName", label: "Contact Name" },
    { key: "email", label: "Email" },
    { key: "altEmail", label: "Alternate Email" },
    { key: "contactNo", label: "Contact No" },
    { key: "altContactNo", label: "Alternate Contact No" },
    { key: "country", label: "Country" },
    { key: "invoiceCurrency", label: "Invoice Currency" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
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
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ExportExcelButton data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={exportColumns} filename="clients" />
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Client" message="Are you sure you want to delete this client? This action cannot be undone." />
      </div>
    </AppLayout>
  );
}
