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
import ConfirmModal from "@/components/ui/ConfirmModal";

import {
  useStyleCategoryList, useCreateStyleCategory, useUpdateStyleCategory,
  useToggleStyleCategoryStatus, useDeleteStyleCategory, useImportStyleCategories,
  fetchAllStyleCategoriesForExport,
  type StyleCategoryRecord, type StyleCategoryFormData, type CategoryImportResult, type StatusFilter,
} from "@/hooks/useStyleCategories";

const EMPTY_FORM: StyleCategoryFormData = { categoryName: "", isActive: true };
type FormErrors = Partial<Record<keyof StyleCategoryFormData, string>>;

const CATEGORY_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NAME_MAX = 100;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

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

const asCat = (r: TableRow) => r as unknown as StyleCategoryRecord;

export default function StyleCategoryMaster() {
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
  const [editRecord, setEditRecord] = useState<StyleCategoryRecord | null>(null);
  const [form, setForm] = useState<StyleCategoryFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [toggleTarget, setToggleTarget] = useState<StyleCategoryRecord | null>(null);

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<CategoryImportResult | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) setImportMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const { data, isLoading } = useStyleCategoryList({ search, status, page, limit });
  const createMutation = useCreateStyleCategory();
  const updateMutation = useUpdateStyleCategory();
  const toggleStatus = useToggleStyleCategoryStatus();
  const deleteMutation = useDeleteStyleCategory();
  const importMutation = useImportStyleCategories();

  function openCreate() { setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); }
  function openEdit(r: StyleCategoryRecord) {
    setEditRecord(r); setForm({ categoryName: r.categoryName, isActive: r.isActive }); setErrors({}); setModalOpen(true);
  }

  function validateName(val: string): string | undefined {
    const trimmed = val.trim().replace(/  +/g, " ");
    if (!trimmed) return "Category Name is required.";
    if (trimmed.length > NAME_MAX) return `Category Name must be ${NAME_MAX} characters or fewer.`;
    if (!CATEGORY_REGEX.test(trimmed)) return "Category Name must contain only letters and spaces (max 100 characters).";
    return undefined;
  }

  function isFormValid() {
    return !validateName(form.categoryName);
  }

  function validate(): boolean {
    const e: FormErrors = {};
    const err = validateName(form.categoryName);
    if (err) e.categoryName = err;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      const payload = { ...form, categoryName: form.categoryName.trim().replace(/  +/g, " ") };
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: payload });
        toast({ title: "Category saved successfully." });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Category saved successfully." });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "An error occurred.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }

  async function handleToggleConfirm() {
    if (!toggleTarget) return;
    try {
      await toggleStatus.mutateAsync(toggleTarget.id);
      toast({ description: `"${toggleTarget.categoryName}" is now ${toggleTarget.isActive ? "Inactive" : "Active"}.` });
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
      setToggleTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast({ title: "Category deleted" });
  }

  async function handleExportAll() {
    setExportLoading(true);
    try {
      const allRows = await fetchAllStyleCategoriesForExport(search, status);
      const exportData = allRows.map((r) => ({
        "Category Name": r.categoryName,
        "Status": r.isActive ? "Active" : "Inactive",
        "Created By": r.createdBy,
        "Created At": formatDateExport(r.createdAt),
        "Updated By": r.updatedBy ?? "",
        "Updated At": formatDateExport(r.updatedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 25 }, { wch: 22 }, { wch: 25 }, { wch: 22 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Style Categories");
      XLSX.writeFile(wb, "Style_Categories.xlsx");
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
      { "Category Name": "Fabric" },
      { "Category Name": "Accessories" },
      { "Category Name": "Embroidery Design" },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [{ wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Style Category Template");
    XLSX.writeFile(wb, "Style_Category_Import_Sample.xlsx");
    toast({ title: "Sample Downloaded", description: "Fill in the template and upload it to import." });
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
        toast({ title: "Empty File", description: "No data rows found.", variant: "destructive" });
        return;
      }
      const records = jsonRows.map((row) => ({ categoryName: String(row["Category Name"] ?? "").trim() }));
      const result = await importMutation.mutateAsync(records);
      setImportResult(result);
      setImportResultOpen(true);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to import file.";
      toast({ title: "Import Failed", description: msg, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  }

  const rows: TableRow[] = ((data?.data ?? []) as StyleCategoryRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No", className: "w-16 text-center" },
    { key: "categoryName", label: "Category Name", render: (r) => <span className="font-medium text-gray-900">{asCat(r).categoryName}</span> },
    { key: "isActive", label: "Status", render: (r) => <StatusToggle isActive={asCat(r).isActive} onToggle={() => setToggleTarget(asCat(r))} loading={toggleStatus.isPending && toggleTarget?.id === asCat(r).id} /> },
    { key: "createdBy", label: "Created By", render: (r) => <span className="text-gray-500">{asCat(r).createdBy}</span> },
    { key: "createdAt", label: "Created At", render: (r) => <span className="text-gray-500 whitespace-nowrap">{formatDateTable(asCat(r).createdAt)}</span> },
    { key: "updatedBy", label: "Updated By", render: (r) => <span className="text-gray-500">{asCat(r).updatedBy || "—"}</span> },
    { key: "updatedAt", label: "Updated At", render: (r) => <span className="text-gray-500 whitespace-nowrap">{formatDateTable(asCat(r).updatedAt)}</span> },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asCat(r);
        return (
          <div className="flex gap-2">
            <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit"><Pencil size={15} /></button>
            <button onClick={() => setDeleteId(rec.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={15} /></button>
          </div>
        );
      },
    },
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Style Category Master" onAdd={openCreate} addLabel="Add Category" />

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search categories…" />
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
      </div>

      <MasterFormModal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editRecord ? "Edit Style Category" : "Add Style Category"}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
        submitDisabled={!isFormValid()}>
        <div className="flex flex-col gap-1.5">
          <InputField
            label="Category Name" required
            placeholder="e.g. Fabric, Accessories"
            value={form.categoryName}
            maxLength={NAME_MAX}
            onChange={(e) => {
              const val = e.target.value;
              setForm(f => ({ ...f, categoryName: val }));
              const err = validateName(val);
              setErrors(prev => ({ ...prev, categoryName: err }));
            }}
            error={errors.categoryName}
          />
          <p className={`text-xs text-right -mt-1 ${form.categoryName.length > NAME_MAX ? "text-red-500" : "text-gray-400"}`}>
            {form.categoryName.length} / {NAME_MAX} characters used
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <label className="text-sm font-medium text-gray-700">Active</label>
          <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900/20 ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}
            role="switch" aria-checked={form.isActive}>
            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0"}`} />
          </button>
          <span className={`text-sm ${form.isActive ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
            {form.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </MasterFormModal>

      <ConfirmModal
        open={!!toggleTarget}
        title="Change Status"
        message={
          toggleTarget
            ? `Are you sure you want to change the status of "${toggleTarget.categoryName}" to ${toggleTarget.isActive ? "Inactive" : "Active"}?`
            : ""
        }
        confirmLabel="Yes, Change"
        onConfirm={() => { void handleToggleConfirm(); }}
        onCancel={() => setToggleTarget(null)}
        loading={toggleStatus.isPending}
      />

      <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
        title="Delete Category" message="Are you sure you want to delete this style category?" loading={deleteMutation.isPending} />

      {importResultOpen && importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Import Complete</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{importResult.imported}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Imported</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{importResult.skipped}</p>
                <p className="text-xs text-amber-600 mt-0.5">Skipped</p>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{importResult.errors.length}</p>
                <p className="text-xs text-red-600 mt-0.5">Errors</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Error Details</p>
                {importResult.errors.map((e, i) => (
                  <div key={i} className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                    <p className="text-xs font-medium text-red-700">Row {e.row}{e.name ? ` — "${e.name}"` : ""}</p>
                    <p className="text-xs text-red-500 mt-0.5">{e.error}</p>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setImportResultOpen(false)}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-semibold hover:bg-gray-800 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
