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
import MasterFormModal from "@/components/master/MasterFormModal";
import StatusToggle from "@/components/master/StatusToggle";
import ExportExcelButton, { type ExportColumn } from "@/components/master/ExportExcelButton";
import InputField from "@/components/ui/InputField";
import ConfirmModal from "@/components/ui/ConfirmModal";

import {
  useItemTypeMasterList, useCreateItemType, useUpdateItemType,
  useToggleItemTypeStatus, useDeleteItemType,
  type ItemTypeMasterRecord, type ItemTypeMasterFormData, type StatusFilter,
} from "@/hooks/useItemTypeMaster";

const EMPTY_FORM: ItemTypeMasterFormData = { name: "", isActive: true };
type FormErrors = Partial<Record<keyof ItemTypeMasterFormData, string>>;

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asIT = (r: TableRow) => r as unknown as ItemTypeMasterRecord;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
];

export default function ItemTypeMaster() {
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ItemTypeMasterRecord | null>(null);
  const [form, setForm] = useState<ItemTypeMasterFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useItemTypeMasterList({ search, status, page, limit });
  const createMutation = useCreateItemType();
  const updateMutation = useUpdateItemType();
  const toggleStatus = useToggleItemTypeStatus();
  const deleteMutation = useDeleteItemType();

  function openCreate() { setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); }
  function openEdit(r: ItemTypeMasterRecord) {
    setEditRecord(r); setForm({ name: r.name, isActive: r.isActive }); setErrors({}); setModalOpen(true);
  }
  function validate() {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = "Item Type Name is required";
    setErrors(e); return Object.keys(e).length === 0;
  }
  async function handleSubmit() {
    if (!validate()) return;
    try {
      if (editRecord) { await updateMutation.mutateAsync({ id: editRecord.id, data: form }); toast({ title: "Item type updated" }); }
      else { await createMutation.mutateAsync(form); toast({ title: "Item type created" }); }
      setModalOpen(false);
    } catch (err: unknown) { toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" }); }
  }
  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId); setDeleteId(null); toast({ title: "Item type deleted" });
  }

  const rows: TableRow[] = ((data?.data ?? []) as ItemTypeMasterRecord[]).map((r, i) => ({ ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1 }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "name", label: "Item Type Name", render: (r) => <span className="font-medium text-gray-900">{asIT(r).name}</span> },
    { key: "isActive", label: "Status", render: (r) => <StatusToggle isActive={asIT(r).isActive} onToggle={() => toggleStatus.mutate(asIT(r).id)} /> },
    { key: "createdBy", label: "Created By", render: (r) => asIT(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDate(asIT(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: (r) => asIT(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: (r) => formatDate(asIT(r).updatedAt) },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asIT(r);
        return (
          <div className="flex gap-2">
            <button onClick={() => openEdit(rec)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
            <button onClick={() => setDeleteId(rec.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
          </div>
        );
      },
    },
  ];

  const exportColumns: ExportColumn[] = [
    { key: "name", label: "Item Type Name" },
    { key: "isActive", label: "Status" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Item Type Master" onAdd={openCreate} addLabel="Add Item Type" />

        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search item types…" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ExportExcelButton data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={exportColumns} filename="item-types" />
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        <MasterFormModal open={modalOpen} onClose={() => setModalOpen(false)}
          title={editRecord ? "Edit Item Type" : "Add Item Type"}
          onSubmit={handleSubmit} submitting={createMutation.isPending || updateMutation.isPending}>
          <InputField label="Item Type Name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            error={errors.name} required placeholder="e.g. Box, Tissue, Bag" />
          <div className="flex items-center gap-3 pt-1">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </MasterFormModal>

        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Item Type" message="Are you sure you want to delete this item type?" />
      </div>
    </AppLayout>
  );
}
