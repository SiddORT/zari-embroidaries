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
  useVendorList, useToggleVendorStatus, useDeleteVendor,
  type VendorRecord, type StatusFilter,
} from "@/hooks/useVendors";

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asVendor = (r: TableRow) => r as unknown as VendorRecord;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function VendorMaster() {
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

  const { data, isLoading } = useVendorList({ search, status, page, limit });
  const toggleStatus = useToggleVendorStatus();
  const deleteMutation = useDeleteVendor();

  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast({ title: "Vendor deleted" });
  }

  const rows: TableRow[] = ((data?.data ?? []) as VendorRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "vendorCode", label: "Vendor Code", render: (r) => asVendor(r).vendorCode },
    { key: "brandName", label: "Brand / Vendor Name", render: (r) => asVendor(r).brandName },
    { key: "contactName", label: "Contact", render: (r) => asVendor(r).contactName },
    { key: "contactNo", label: "Contact No", render: (r) => asVendor(r).contactNo || "—" },
    { key: "country", label: "Country", render: (r) => asVendor(r).country || "—" },
    { key: "hasGst", label: "GST", render: (r) => asVendor(r).hasGst ? "Yes" : "No" },
    {
      key: "addresses", label: "Addresses", render: (r) => {
        const v = asVendor(r);
        const count = v.addresses?.length ?? 0;
        return count > 0 ? <span className="text-xs text-gray-500">{count} address{count !== 1 ? "es" : ""}</span> : <span className="text-xs text-gray-300">—</span>;
      }
    },
    { key: "isActive", label: "Status", render: (r) => <StatusToggle isActive={asVendor(r).isActive} onToggle={() => toggleStatus.mutate(asVendor(r).id)} /> },
    { key: "createdBy", label: "Created By", render: (r) => asVendor(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDate(asVendor(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: (r) => asVendor(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: (r) => formatDate(asVendor(r).updatedAt) },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asVendor(r);
        return (
          <div className="flex gap-2">
            <button onClick={() => setLocation(`/masters/vendors/${rec.id}`)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
            <button onClick={() => setDeleteId(rec.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
          </div>
        );
      },
    },
  ];

  const exportColumns: ExportColumn[] = [
    { key: "vendorCode", label: "Vendor Code" },
    { key: "brandName", label: "Brand / Vendor Name" },
    { key: "contactName", label: "Contact Name" },
    { key: "email", label: "Email" },
    { key: "contactNo", label: "Contact No" },
    { key: "country", label: "Country" },
    { key: "hasGst", label: "GST" },
    { key: "gstNo", label: "GST No" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Vendor Master" onAdd={() => setLocation("/masters/vendors/new")} addLabel="Add Vendor" />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search vendors…" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ExportExcelButton data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={exportColumns} filename="vendors" />
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Vendor" message="Are you sure you want to delete this vendor? This action cannot be undone." />
      </div>
    </AppLayout>
  );
}
