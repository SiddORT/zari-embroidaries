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
import MasterFormModal from "@/components/master/MasterFormModal";
import StatusToggle from "@/components/master/StatusToggle";
import InputField from "@/components/ui/InputField";
import TextareaField from "@/components/ui/TextareaField";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ImportResultModal, { normalizeImportResult, type NormalizedImportResult } from "@/components/ui/ImportResultModal";
import SearchableSelect from "@/components/ui/SearchableSelect";

import {
  useHSNList,
  useCreateHSN,
  useUpdateHSN,
  useToggleHSNStatus,
  useDeleteHSN,
  useImportHSN,
  fetchAllHSNForExport,
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

const HSN_REGEX = /^[0-9]{4}$|^[0-9]{6}$|^[0-9]{8}$/;
const NUMERIC_ONLY = /^[0-9]*$/;
const GOVT_DESC_MAX = 255;
const REMARKS_MAX = 500;

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
  const { data: user, isLoading: loadingUser } = useGetMe({ query: { enabled: !!token } as any });

  useEffect(() => {
    if (!token || (!loadingUser && !user)) {
      setLocation("/login");
    }
  }, [token, user, loadingUser, setLocation]);

  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
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
  const importMutation = useImportHSN();

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<HsnRecord | null>(null);
  const [form, setForm] = useState<HsnFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const [deleteTarget, setDeleteTarget] = useState<HsnRecord | null>(null);
  const [toggleTarget, setToggleTarget] = useState<HsnRecord | null>(null);

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<NormalizedImportResult | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setImportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
    const code = form.hsnCode.trim();
    if (!code) {
      e.hsnCode = "HSN Code is required.";
    } else if (!HSN_REGEX.test(code)) {
      e.hsnCode = "HSN Code must contain only 4, 6, or 8 numeric digits.";
    }
    if (!form.gstPercentage) e.gstPercentage = "GST Percentage is required.";
    const desc = form.govtDescription.trim();
    if (!desc) {
      e.govtDescription = "Government Description is required.";
    } else if (desc.length > GOVT_DESC_MAX) {
      e.govtDescription = `Government Description must be ${GOVT_DESC_MAX} characters or fewer.`;
    }
    if ((form.remarks ?? "").length > REMARKS_MAX) {
      e.remarks = `Remarks must be ${REMARKS_MAX} characters or fewer.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isFormValid = (): boolean => {
    const code = form.hsnCode.trim();
    if (!code || !HSN_REGEX.test(code)) return false;
    if (!form.gstPercentage) return false;
    if (!form.govtDescription.trim() || form.govtDescription.length > GOVT_DESC_MAX) return false;
    if ((form.remarks ?? "").length > REMARKS_MAX) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      const payload: HsnFormData = {
        ...form,
        hsnCode: form.hsnCode.trim(),
        govtDescription: form.govtDescription.trim(),
        remarks: form.remarks?.trim() ?? "",
      };
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: payload });
        toast({ title: "Updated", description: `HSN ${payload.hsnCode} updated successfully.` });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Created", description: `HSN ${payload.hsnCode} created successfully.` });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { error?: string } })?.data?.error ?? "An error occurred. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleToggleConfirm = async () => {
    if (!toggleTarget) return;
    try {
      await toggleMutation.mutateAsync(toggleTarget.id);
      toast({
        title: "Status Updated",
        description: `HSN ${toggleTarget.hsnCode} is now ${toggleTarget.isActive ? "Inactive" : "Active"}.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
      setToggleTarget(null);
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

  function downloadSample() {
    setImportMenuOpen(false);
    const sampleData = [
      {
        "HSN Code": "1001",
        "GST Percentage": "18",
        "Government Description": "Durum wheat",
        "Remarks": "Sample remark",
      },
      {
        "HSN Code": "100110",
        "GST Percentage": "5",
        "Government Description": "Durum wheat for sowing",
        "Remarks": "",
      },
      {
        "HSN Code": "10011000",
        "GST Percentage": "0",
        "Government Description": "Durum wheat for sowing (8-digit)",
        "Remarks": "",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 50 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HSN Import Template");
    XLSX.writeFile(wb, "HSN_Import_Sample.xlsx");
    toast({ title: "Sample Downloaded", description: "Fill in the template and upload it to import records." });
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportMenuOpen(false);
    setImportLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      if (jsonRows.length === 0) {
        toast({ title: "Empty File", description: "The uploaded file has no data rows.", variant: "destructive" });
        return;
      }

      const records = jsonRows.map((row) => ({
        hsnCode: String(row["HSN Code"] ?? "").trim(),
        gstPercentage: String(row["GST Percentage"] ?? "").trim(),
        govtDescription: String(row["Government Description"] ?? "").trim(),
        remarks: String(row["Remarks"] ?? "").trim() || undefined,
        isActive: true as const,
      }));

      const importRaw = await importMutation.mutateAsync(records);
      setImportResult(normalizeImportResult(importRaw));
      setImportResultOpen(true);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { error?: string } })?.data?.error ?? "Failed to parse or upload the Excel file.";
      toast({ title: "Import Failed", description: msg, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  }

  async function handleExportAll() {
    setExportLoading(true);
    try {
      const allRows = await fetchAllHSNForExport(debouncedSearch, statusFilter);
      const exportData = allRows.map((r) => ({
        "HSN Code": r.hsnCode,
        "GST %": `${r.gstPercentage}%`,
        "Government Description": r.govtDescription,
        "Remarks": r.remarks ?? "",
        "Status": r.isActive ? "Active" : "Inactive",
        "Created By": r.createdBy,
        "Created At": formatDate(r.createdAt),
        "Updated By": r.updatedBy ?? "—",
        "Updated At": formatDate(r.updatedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 14 }, { wch: 8 }, { wch: 50 }, { wch: 30 },
        { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HSN Master");
      XLSX.writeFile(wb, "HSN_Master.xlsx");
      toast({ title: "Export Complete", description: `${allRows.length} record(s) exported.` });
    } catch {
      toast({ title: "Export Failed", description: "Could not fetch records for export.", variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  }

  function handleHsnCodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = [
      "Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End",
    ];
    if (allowed.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  }

  function handleHsnCodePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!NUMERIC_ONLY.test(text)) {
      e.preventDefault();
      setErrors((prev) => ({ ...prev, hsnCode: "HSN Code must contain only 4, 6, or 8 numeric digits." }));
    }
  }

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
          onToggle={() => setToggleTarget(asHsn(r))}
          loading={toggleMutation.isPending && toggleTarget?.id === asHsn(r).id}
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

  const submitting = createMutation.isPending || updateMutation.isPending;
  const formValid = isFormValid();

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
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search by HSN code or description..."
            />
          </div>

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

          {/* Export — fetches all filtered records */}
          <button
            onClick={handleExportAll}
            disabled={exportLoading || isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="h-4 w-4" />
            {exportLoading ? "Exporting…" : "Export to Excel"}
          </button>

          {/* Import button with dropdown */}
          <div className="relative" ref={importMenuRef}>
            <button
              onClick={() => setImportMenuOpen((v) => !v)}
              disabled={importLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C9B45C]/50 bg-white text-sm font-medium text-gray-700 shadow-sm hover:border-[#C9B45C] hover:bg-amber-50/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileInput className="h-4 w-4 text-[#C6AF4B]" />
              {importLoading ? "Importing…" : "Import Data"}
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${importMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {importMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                <button
                  onClick={downloadSample}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-medium">Download Sample</p>
                    <p className="text-xs text-gray-400">Get the Excel template</p>
                  </div>
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => { setImportMenuOpen(false); importFileRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <FileUp className="h-4 w-4 text-blue-600 shrink-0" />
                  <div>
                    <p className="font-medium">Upload Excel File</p>
                    <p className="text-xs text-gray-400">Import records from file</p>
                  </div>
                </button>
              </div>
            )}
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
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
        submitDisabled={!formValid}
      >
        {/* HSN Code */}
        <InputField
          label="HSN Code"
          required
          placeholder="e.g. 6301, 630190, 63019090"
          value={form.hsnCode}
          maxLength={8}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9]/g, "");
            setForm((f) => ({ ...f, hsnCode: val }));
            if (val && !HSN_REGEX.test(val)) {
              setErrors((prev) => ({ ...prev, hsnCode: "HSN Code must contain only 4, 6, or 8 numeric digits." }));
            } else {
              setErrors((prev) => ({ ...prev, hsnCode: undefined }));
            }
          }}
          onKeyDown={handleHsnCodeKeyDown}
          onPaste={handleHsnCodePaste}
          error={errors.hsnCode}
          disabled={!!editRecord}
          inputMode="numeric"
          pattern="[0-9]*"
        />
        {!!editRecord && (
          <p className="text-xs text-amber-600 -mt-1 flex items-center gap-1">
            HSN Code cannot be changed in edit mode.
          </p>
        )}

        {/* GST Percentage */}
        <SearchableSelect
          label="GST Percentage"
          required
          options={GST_OPTIONS.map((o) => o.label)}
          placeholder="Select GST %"
          value={GST_OPTIONS.find((o) => o.value === form.gstPercentage)?.label ?? ""}
          onChange={(label) => {
            const opt = GST_OPTIONS.find((o) => o.label === label);
            setForm((f) => ({ ...f, gstPercentage: opt ? opt.value : "" }));
            setErrors((prev) => ({ ...prev, gstPercentage: undefined }));
          }}
          error={errors.gstPercentage}
        />

        {/* Government Description */}
        <div className="flex flex-col gap-1.5">
          <TextareaField
            label="Government Description"
            required
            placeholder="Official government description of the HSN code..."
            value={form.govtDescription}
            maxLength={GOVT_DESC_MAX}
            onChange={(e) => {
              const val = e.target.value;
              setForm((f) => ({ ...f, govtDescription: val }));
              if (val.length > GOVT_DESC_MAX) {
                setErrors((prev) => ({ ...prev, govtDescription: `Max ${GOVT_DESC_MAX} characters.` }));
              } else if (!val.trim()) {
                setErrors((prev) => ({ ...prev, govtDescription: "Government Description is required." }));
              } else {
                setErrors((prev) => ({ ...prev, govtDescription: undefined }));
              }
            }}
            error={errors.govtDescription}
            rows={3}
          />
          <p className={`text-xs text-right -mt-1 ${form.govtDescription.length > GOVT_DESC_MAX ? "text-red-500" : "text-gray-400"}`}>
            {form.govtDescription.length} / {GOVT_DESC_MAX} characters used
          </p>
        </div>

        {/* Remarks */}
        <div className="flex flex-col gap-1.5">
          <TextareaField
            label="Remarks"
            placeholder="Optional internal notes..."
            value={form.remarks ?? ""}
            maxLength={REMARKS_MAX}
            onChange={(e) => {
              const val = e.target.value;
              setForm((f) => ({ ...f, remarks: val }));
              if (val.length > REMARKS_MAX) {
                setErrors((prev) => ({ ...prev, remarks: `Max ${REMARKS_MAX} characters.` }));
              } else {
                setErrors((prev) => ({ ...prev, remarks: undefined }));
              }
            }}
            error={errors.remarks}
            rows={2}
          />
          <p className={`text-xs text-right -mt-1 ${(form.remarks ?? "").length > REMARKS_MAX ? "text-red-500" : "text-gray-400"}`}>
            {(form.remarks ?? "").length} / {REMARKS_MAX} characters used
          </p>
        </div>

        {/* Status toggle */}
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
          <span className={`text-sm ${form.isActive ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
            {form.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </MasterFormModal>

      {/* Status toggle confirmation */}
      <ConfirmModal
        open={!!toggleTarget}
        title="Change Status"
        message={
          toggleTarget
            ? `Are you sure you want to change the status of HSN "${toggleTarget.hsnCode}" to ${toggleTarget.isActive ? "Inactive" : "Active"}?`
            : ""
        }
        confirmLabel="Yes, Change"
        cancelLabel="No, Cancel"
        onConfirm={handleToggleConfirm}
        onCancel={() => setToggleTarget(null)}
        loading={toggleMutation.isPending}
      />

      {/* Delete confirmation */}
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

      {/* Import result modal */}
      <ImportResultModal
        open={importResultOpen}
        result={importResult}
        entityName="HSN Codes"
        onClose={() => setImportResultOpen(false)}
      />
    </AppLayout>
  );
}
