import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, FileDown, FileUp, FileSpreadsheet } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import MasterFormModal from "@/components/master/MasterFormModal";
import StatusToggle from "@/components/master/StatusToggle";
import InputField from "@/components/ui/InputField";
import ConfirmModal from "@/components/ui/ConfirmModal";

import {
  useItemTypeMasterList, useCreateItemType, useUpdateItemType,
  useToggleItemTypeStatus, useDeleteItemType, useImportItemTypes,
  fetchAllItemTypesForExport,
  type ItemTypeMasterRecord, type ItemTypeMasterFormData,
  type ItemTypeImportResult, type StatusFilter,
} from "@/hooks/useItemTypeMaster";

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;

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
  const [confirmToggleTarget, setConfirmToggleTarget] = useState<ItemTypeMasterRecord | null>(null);

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useItemTypeMasterList({ search, status, page, limit });
  const createMutation = useCreateItemType();
  const updateMutation = useUpdateItemType();
  const toggleMutation = useToggleItemTypeStatus();
  const deleteMutation = useDeleteItemType();
  const importMutation = useImportItemTypes();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) setImportMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openCreate() { setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); }
  function openEdit(r: ItemTypeMasterRecord) {
    setEditRecord(r); setForm({ name: r.name, isActive: r.isActive }); setErrors({}); setModalOpen(true);
  }

  function validate() {
    const e: FormErrors = {};
    const name = form.name.trim();
    if (!name) {
      e.name = "Item Type Name is required";
    } else if (name.length > 100) {
      e.name = "Item Type Name must be at most 100 characters";
    } else if (!NAME_REGEX.test(name)) {
      e.name = "Item Type Name must contain only letters and spaces";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      const payload = { ...form, name: form.name.trim() };
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: payload });
        toast({ title: "Updated", description: "Item type updated successfully." });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Created", description: "Item type created successfully." });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? (err instanceof Error ? err.message : "Error");
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast({ title: "Deleted", description: "Item type deleted." });
    } catch { toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }); }
    finally { setDeleteId(null); }
  }

  async function handleToggleConfirmed() {
    if (!confirmToggleTarget) return;
    try {
      await toggleMutation.mutateAsync(confirmToggleTarget.id);
      toast({ title: "Status Updated", description: `"${confirmToggleTarget.name}" is now ${confirmToggleTarget.isActive ? "Inactive" : "Active"}.` });
    } catch { toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }); }
    finally { setConfirmToggleTarget(null); }
  }

  const handleExportAll = async () => {
    setExportLoading(true);
    try {
      const allRows = await fetchAllItemTypesForExport({ search, status });
      const wsData = allRows.map((r) => ({
        "Item Type Name": r.name,
        "Status": r.isActive ? "Active" : "Inactive",
        "Created By": r.createdBy,
        "Created At": formatDate(r.createdAt),
        "Updated By": r.updatedBy ?? "",
        "Updated At": formatDate(r.updatedAt),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "Item Types");
      XLSX.writeFile(wb, "Item_Types_Export.xlsx");
    } catch { toast({ title: "Export Failed", description: "Could not export item types.", variant: "destructive" }); }
    finally { setExportLoading(false); }
  };

  const handleDownloadSample = () => {
    const sample = [{ "Item Type Name": "Thread", "Status": "Active" }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample), "Template");
    XLSX.writeFile(wb, "Item_Types_Import_Template.xlsx");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        if (!jsonRows.length) { toast({ title: "Empty File", description: "No data rows found.", variant: "destructive" }); return; }
        const importRaw = await importMutation.mutateAsync(jsonRows);
        const result = (importRaw as unknown) as ItemTypeImportResult;
        const hasErrors = result.failed > 0;
        toast({
          title: hasErrors ? "Imported with errors" : "Import Successful",
          description: `${result.succeeded} succeeded${hasErrors ? `, ${result.failed} failed` : ""}.`,
          variant: hasErrors ? "destructive" : "default",
        });
        if (hasErrors) console.warn("Import row errors:", result.results.filter((r) => r.status === "error"));
      } catch (err: unknown) {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Import failed.";
        toast({ title: "Import Error", description: msg, variant: "destructive" });
      } finally {
        setImportLoading(false);
        setImportMenuOpen(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const rows: TableRow[] = ((data?.data ?? []) as ItemTypeMasterRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No", className: "w-14 text-center", render: (r) => <span className="text-gray-400 text-xs font-medium">{(r as unknown as { _srNo: number })._srNo}</span> },
    { key: "name", label: "Item Type Name", render: (r) => <span className="font-medium text-gray-900">{asIT(r).name}</span> },
    {
      key: "isActive", label: "Status",
      render: (r) => <StatusToggle isActive={asIT(r).isActive} onToggle={() => setConfirmToggleTarget(asIT(r))} loading={toggleMutation.isPending} />,
    },
    { key: "createdBy", label: "Created By", render: (r) => <span className="text-gray-500">{asIT(r).createdBy}</span> },
    { key: "createdAt", label: "Created At", render: (r) => <span className="text-gray-500 whitespace-nowrap">{formatDate(asIT(r).createdAt)}</span> },
    { key: "updatedBy", label: "Updated By", render: (r) => <span className="text-gray-500">{asIT(r).updatedBy || "—"}</span> },
    { key: "updatedAt", label: "Updated At", render: (r) => <span className="text-gray-500 whitespace-nowrap">{formatDate(asIT(r).updatedAt)}</span> },
    {
      key: "actions", label: "Actions",
      render: (r) => {
        const rec = asIT(r);
        return (
          <div className="flex gap-2">
            <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => setDeleteId(rec.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Item Type Master" onAdd={openCreate} addLabel="Add Item Type" />

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search item types…" />
            </div>

            {/* Export All */}
            <button
              onClick={handleExportAll}
              disabled={exportLoading || isLoading}
              className="flex items-center gap-2 rounded-lg border border-[#C9B45C]/50 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#C9B45C] hover:bg-amber-50/40 disabled:opacity-50"
              title="Export all matching records to Excel"
            >
              <FileDown className="h-4 w-4 text-[#C9B45C]" />
              {exportLoading ? "Exporting…" : "Export"}
            </button>

            {/* Import dropdown */}
            <div className="relative" ref={importMenuRef}>
              <button
                onClick={() => setImportMenuOpen((v) => !v)}
                disabled={importLoading}
                className="flex items-center gap-2 rounded-lg border border-[#C9B45C]/50 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#C9B45C] hover:bg-amber-50/40 disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#C9B45C]" />
                {importLoading ? "Importing…" : "Import"}
              </button>
              {importMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl border border-gray-100 bg-white shadow-lg py-1">
                  <button
                    onClick={() => { handleDownloadSample(); setImportMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FileDown className="h-4 w-4 text-gray-400" />
                    Download Sample
                  </button>
                  <button
                    onClick={() => { importInputRef.current?.click(); setImportMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FileUp className="h-4 w-4 text-gray-400" />
                    Upload Excel
                  </button>
                </div>
              )}
              <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
            </div>

            {/* Status filter */}
            <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <MasterTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          emptyText="No item types found. Click 'Add Item Type' to create one."
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }}
        />
      </div>

      {/* Add / Edit Modal */}
      <MasterFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRecord ? "Edit Item Type" : "Add Item Type"}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      >
        <div className="flex flex-col gap-1">
          <InputField
            label="Item Type Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={errors.name}
            required
            placeholder="e.g. Thread, Fabric, Button"
          />
          {!errors.name && (
            <p className="text-[10px] text-gray-400 -mt-1">{form.name.length} / 100 characters used</p>
          )}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <label className="text-sm font-medium text-gray-700">Active</label>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <span className={`text-sm ${form.isActive ? "text-emerald-600" : "text-gray-400"}`}>
            {form.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </MasterFormModal>

      {/* Status toggle confirmation */}
      <ConfirmModal
        open={!!confirmToggleTarget}
        title="Change Status"
        message={confirmToggleTarget
          ? `Are you sure you want to set "${confirmToggleTarget.name}" to ${confirmToggleTarget.isActive ? "Inactive" : "Active"}?`
          : ""}
        confirmLabel="Yes, Change"
        cancelLabel="Cancel"
        danger={false}
        onConfirm={handleToggleConfirmed}
        onCancel={() => setConfirmToggleTarget(null)}
        loading={toggleMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={deleteId !== null}
        title="Delete Item Type"
        message="Are you sure you want to delete this item type? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { void handleDelete(); }}
        onCancel={() => setDeleteId(null)}
        loading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
