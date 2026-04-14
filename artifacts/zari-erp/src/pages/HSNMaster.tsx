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
import TextareaField from "@/components/ui/TextareaField";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SearchableSelect from "@/components/ui/SearchableSelect";

import {
  useHSNList,
  useCreateHSN,
  useUpdateHSN,
  useToggleHSNStatus,
  useDeleteHSN,
  type HsnRecord,
  type HsnFormData,
  type StatusFilter,
} from "@/hooks/useHSN";

const GST_OPTIONS = [
  { value: "0", label: "0%" },
  { value: "5", label: "5%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const EMPTY_FORM: HsnFormData = {
  hsnCode: "",
  gstPercentage: "",
  govtDescription: "",
  remarks: "",
  isActive: true,
};

type FormErrors = Partial<Record<keyof HsnFormData, string>>;

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

export default function HSNMaster() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });

  useEffect(() => {
    if (!token || (!loadingUser && !user)) {
      setLocation("/login");
    }
  }, [token, user, loadingUser, setLocation]);

  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync({});
    } finally {
      localStorage.removeItem("zarierp_token");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useHSNList({
    search: debouncedSearch,
    status: statusFilter,
    page,
    limit,
  });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const createMutation = useCreateHSN();
  const updateMutation = useUpdateHSN();
  const toggleMutation = useToggleHSNStatus();
  const deleteMutation = useDeleteHSN();

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<HsnRecord | null>(null);
  const [form, setForm] = useState<HsnFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const [deleteTarget, setDeleteTarget] = useState<HsnRecord | null>(null);

  const openAdd = () => {
    setEditRecord(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (record: HsnRecord) => {
    setEditRecord(record);
    setForm({
      hsnCode: record.hsnCode,
      gstPercentage: record.gstPercentage,
      govtDescription: record.govtDescription,
      remarks: record.remarks ?? "",
      isActive: record.isActive,
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.hsnCode.trim()) e.hsnCode = "HSN Code is required";
    if (!form.gstPercentage) e.gstPercentage = "GST Percentage is required";
    if (!form.govtDescription.trim()) e.govtDescription = "Government Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: form });
        toast({ title: "Updated", description: `HSN ${form.hsnCode} updated successfully.` });
      } else {
        await createMutation.mutateAsync(form);
        toast({ title: "Created", description: `HSN ${form.hsnCode} created successfully.` });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { error?: string } })?.data?.error ?? "An error occurred. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleToggle = async (record: HsnRecord) => {
    try {
      await toggleMutation.mutateAsync(record.id);
      toast({
        title: "Status Updated",
        description: `HSN ${record.hsnCode} is now ${record.isActive ? "Inactive" : "Active"}.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: "Deleted", description: `HSN ${deleteTarget.hsnCode} has been deleted.` });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete record.", variant: "destructive" });
    }
  };

  const asHsn = (r: TableRow) => r as unknown as HsnRecord;

  const columns: Column[] = [
    {
      key: "srNo",
      label: "Sr No",
      className: "w-16 text-center",
      render: (r) => {
        const idx = rows.findIndex((row) => row.id === asHsn(r).id);
        const srNo = (page - 1) * limit + (idx === -1 ? 0 : idx) + 1;
        return <span className="text-gray-400 text-xs font-medium">{srNo}</span>;
      },
    },
    {
      key: "hsnCode",
      label: "HSN Code",
      render: (r) => (
        <span className="font-mono font-semibold text-gray-900">{asHsn(r).hsnCode}</span>
      ),
    },
    {
      key: "gstPercentage",
      label: "GST %",
      render: (r) => <span className="font-medium">{asHsn(r).gstPercentage}%</span>,
    },
    {
      key: "govtDescription",
      label: "Government Description",
      render: (r) => (
        <span className="max-w-xs block truncate" title={asHsn(r).govtDescription}>
          {asHsn(r).govtDescription}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (r) => (
        <StatusToggle
          isActive={asHsn(r).isActive}
          onToggle={() => handleToggle(asHsn(r))}
          loading={toggleMutation.isPending}
        />
      ),
    },
    {
      key: "createdBy",
      label: "Created By",
      render: (r) => <span className="text-gray-500">{asHsn(r).createdBy}</span>,
    },
    {
      key: "createdAt",
      label: "Created At",
      render: (r) => (
        <span className="text-gray-500 whitespace-nowrap">{formatDate(asHsn(r).createdAt)}</span>
      ),
    },
    {
      key: "updatedBy",
      label: "Updated By",
      render: (r) => <span className="text-gray-500">{asHsn(r).updatedBy ?? "—"}</span>,
    },
    {
      key: "updatedAt",
      label: "Updated At",
      render: (r) => (
        <span className="text-gray-500 whitespace-nowrap">{formatDate(asHsn(r).updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(asHsn(r))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(asHsn(r))}
            disabled={deleteMutation.isPending}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const exportColumns: ExportColumn[] = [
    { key: "hsnCode", label: "HSN Code" },
    { key: "gstPercentage", label: "GST %" },
    { key: "govtDescription", label: "Government Description" },
    { key: "remarks", label: "Remarks" },
    { key: "isActive", label: "Status" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
    { key: "updatedBy", label: "Updated By" },
    { key: "updatedAt", label: "Updated At" },
  ];

  const submitting = createMutation.isPending || updateMutation.isPending;

  if (!user) return null;

  return (
    <AppLayout
      username={user.username}
      role={user.role}
      onLogout={handleLogout}
      isLoggingOut={logoutMutation.isPending}
    >
      <div className="max-w-screen-xl mx-auto space-y-5">
        {/* Page header */}
        <MasterHeader title="HSN Master" onAdd={openAdd} addLabel="Add HSN" />

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search by HSN code or description..."
            />
          </div>

          {/* Status filter */}
          <div className="sm:w-44">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Export */}
          <ExportExcelButton
            data={rows as Record<string, unknown>[]}
            filename="HSN_Master"
            columns={exportColumns}
            disabled={isLoading}
          />
        </div>

        {/* Data table */}
        <MasterTable
          columns={columns}
          rows={rows as unknown as TableRow[]}
          loading={isLoading}
          rowKey={(r) => asHsn(r).id}
          emptyText="No HSN records found. Click 'Add HSN' to create one."
          pagination={{
            page,
            limit,
            total,
            onPageChange: setPage,
            onLimitChange: (l) => { setLimit(l); setPage(1); },
          }}
        />
      </div>

      {/* Add / Edit Modal */}
      <MasterFormModal
        open={modalOpen}
        title={editRecord ? `Edit HSN — ${editRecord.hsnCode}` : "Add HSN Code"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editRecord ? "Update" : "Create"}
      >
        <InputField
          label="HSN Code"
          required
          placeholder="e.g. 63019090"
          value={form.hsnCode}
          onChange={(e) => setForm((f) => ({ ...f, hsnCode: e.target.value }))}
          error={errors.hsnCode}
          disabled={!!editRecord}
        />

        <SearchableSelect
          label="GST Percentage"
          required
          options={GST_OPTIONS.map((o) => o.label)}
          placeholder="Select GST %"
          value={GST_OPTIONS.find((o) => o.value === form.gstPercentage)?.label ?? ""}
          onChange={(label) => {
            const opt = GST_OPTIONS.find((o) => o.label === label);
            setForm((f) => ({ ...f, gstPercentage: opt ? opt.value : "" }));
          }}
          error={errors.gstPercentage}
        />

        <TextareaField
          label="Government Description"
          required
          placeholder="Official government description of the HSN code..."
          value={form.govtDescription}
          onChange={(e) => setForm((f) => ({ ...f, govtDescription: e.target.value }))}
          error={errors.govtDescription}
          rows={3}
        />

        <TextareaField
          label="Remarks"
          placeholder="Optional internal notes..."
          value={form.remarks ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
          rows={2}
        />

        <div className="flex items-center gap-3 pt-1">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900/20 ${
              form.isActive ? "bg-gray-900" : "bg-gray-300"
            }`}
            role="switch"
            aria-checked={form.isActive}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                form.isActive ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm ${form.isActive ? "text-emerald-600 font-medium" : "text-gray-400"}`}
          >
            {form.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </MasterFormModal>

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete HSN Record"
        message={
          deleteTarget
            ? `Are you sure you want to delete HSN code "${deleteTarget.hsnCode}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
