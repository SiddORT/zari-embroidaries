import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pencil, Trash2, X, FileDown, FileUp, FileSpreadsheet,
  Upload, ZoomIn, Image, Film, Loader2, ChevronDown, Paperclip,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

import AppLayout from "@/components/layout/AppLayout";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import SearchBar from "@/components/master/SearchBar";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SearchableSelect from "@/components/ui/SearchableSelect";
import AddableSelect from "@/components/ui/AddableSelect";
import MediaUploadSection from "@/components/ui/MediaUploadSection";

import {
  useSwatchList, useCreateSwatch, useUpdateSwatch, useToggleSwatchStatus, useDeleteSwatch,
  useImportSwatches, fetchAllSwatchesForExport,
  type SwatchRecord, type SwatchFormData, type SwatchAttachment, type StatusFilter, type MediaItem,
} from "@/hooks/useSwatches";
import { useAllFabrics } from "@/hooks/useFabrics";
import { useUnitTypes, useSwatchCategories, useCreateSwatchCategory, useCreateUnitType } from "@/hooks/useLookups";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";
import { useEffect } from "react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const LOCATION_OPTIONS = ["Inhouse", "Client"];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

const EMPTY_FORM: SwatchFormData = {
  client: "", swatchName: "", swatchCategory: "", fabric: "",
  location: "", swatchDate: "", length: "", width: "", unitType: "",
  hours: "", attachments: [], isActive: true,
};

type FormErrors = Partial<Record<keyof SwatchFormData, string>>;
type PendingMedia = { id: string; file: File; previewUrl: string };

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

const asSwatch = (r: TableRow) => r as unknown as SwatchRecord;

// ─── Local Media Panel (used for create mode pending + edit mode combined) ─────

interface LocalMediaPanelProps {
  label: string;
  pending: PendingMedia[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  serverItems?: MediaItem[];
  onDeleteServer?: (url: string) => void;
}

function LocalMediaPanel({ label, pending, onAdd, onRemove, serverItems = [], onDeleteServer }: LocalMediaPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">{label}</span>
        <label className="flex items-center gap-1 cursor-pointer px-2 py-1 rounded border border-dashed border-gray-300 text-xs text-gray-500 hover:border-amber-400 hover:text-amber-700 transition">
          <Upload size={11} /> Upload
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            multiple className="hidden"
            onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) onAdd(files); e.target.value = ""; }} />
        </label>
      </div>
      {serverItems.length === 0 && pending.length === 0 && (
        <p className="text-xs text-gray-400 italic">No files yet.</p>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {serverItems.map((item) => (
          <div key={item.url} className="relative group rounded border border-gray-200 bg-gray-50 aspect-square flex items-center justify-center overflow-hidden">
            {item.type === "image"
              ? <img src={item.url.startsWith("/uploads/") ? `/api${item.url}` : item.url} alt={item.name} className="w-full h-full object-cover" />
              : <div className="flex flex-col items-center gap-1 p-1"><Film size={20} className="text-gray-400" /><span className="text-[9px] text-gray-500 truncate w-full text-center">{item.name}</span></div>
            }
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
              <button type="button" onClick={() => setPreview(item.url.startsWith("/uploads/") ? `/api${item.url}` : item.url)}
                className="p-1 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow"><ZoomIn size={11} /></button>
              {onDeleteServer && (
                <button type="button" onClick={() => onDeleteServer(item.url)}
                  className="p-1 rounded-full bg-white/90 text-red-500 hover:bg-white shadow"><Trash2 size={11} /></button>
              )}
            </div>
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.id} className="relative group rounded border border-amber-200 bg-amber-50 aspect-square flex items-center justify-center overflow-hidden">
            {p.file.type.startsWith("image/")
              ? <img src={p.previewUrl} alt={p.file.name} className="w-full h-full object-cover" />
              : <div className="flex flex-col items-center gap-1 p-1"><Film size={20} className="text-amber-400" /><span className="text-[9px] text-amber-700 truncate w-full text-center">{p.file.name}</span></div>
            }
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
              {p.file.type.startsWith("image/") && (
                <button type="button" onClick={() => setPreview(p.previewUrl)}
                  className="p-1 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow"><ZoomIn size={11} /></button>
              )}
              <button type="button" onClick={() => onRemove(p.id)}
                className="p-1 rounded-full bg-white/90 text-red-500 hover:bg-white shadow"><X size={11} /></button>
            </div>
            <span className="absolute top-0.5 right-0.5 text-[8px] bg-amber-500 text-white rounded px-1">new</span>
          </div>
        ))}
      </div>
      {preview && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" onClick={() => setPreview(null)}>
          <button onClick={() => setPreview(null)} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2"><X size={20} /></button>
          <img src={preview} alt="preview" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ─── Add Category/Unit inline mini modals ──────────────────────────────────────

function InlineAddModal({ title, open, onClose, onAdd, adding }: { title: string; open: boolean; onClose: () => void; onAdd: (name: string) => Promise<void>; adding: boolean }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setName(""); setErr(""); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);
  if (!open) return null;
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Name is required"); return; }
    try { await onAdd(name.trim()); setName(""); onClose(); } catch { setErr("Already exists or failed to add"); }
  }
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input ref={inputRef} type="text" value={name} onChange={(e) => { setName(e.target.value); setErr(""); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="Enter name" />
            {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={adding} className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-60">{adding ? "Adding…" : "Add"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SwatchMaster() {
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
  const [clientFilter, setClientFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [swatchCategoryFilter, setSwatchCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // ── Form state ──
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<SwatchRecord | null>(null);
  const [form, setForm] = useState<SwatchFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  // ── Media state ──
  const [wipMedia, setWipMedia] = useState<MediaItem[]>([]);
  const [finalMedia, setFinalMedia] = useState<MediaItem[]>([]);
  const [pendingWip, setPendingWip] = useState<PendingMedia[]>([]);
  const [pendingFinal, setPendingFinal] = useState<PendingMedia[]>([]);

  // ── Modals ──
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ id: number; isActive: boolean } | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addUnitOpen, setAddUnitOpen] = useState(false);

  // ── Import/Export ──
  const importRef = useRef<HTMLInputElement>(null);
  const [importDropOpen, setImportDropOpen] = useState(false);
  const [exportDropOpen, setExportDropOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Data ──
  const { data, isLoading } = useSwatchList({ search, status, client: clientFilter, location: locationFilter, swatchCategory: swatchCategoryFilter, page, limit });
  const { data: fabricsData } = useAllFabrics();
  const { data: unitTypesData } = useUnitTypes();
  const { data: clientsData } = useAllClients();
  const { data: swatchCatsData } = useSwatchCategories();

  const createMutation = useCreateSwatch();
  const updateMutation = useUpdateSwatch();
  const toggleStatus = useToggleSwatchStatus();
  const deleteMutation = useDeleteSwatch();
  const createCatMutation = useCreateSwatchCategory();
  const createUnitType = useCreateUnitType();
  const importMutation = useImportSwatches();

  const fabricOptions = (fabricsData ?? []).map(f => { const v = `${f.fabricType} – ${f.quality}`.trim(); return { value: v, label: v }; });
  const unitOptions = (unitTypesData ?? []).filter(u => u.isActive).map(u => ({ value: u.name, label: u.name }));
  const clientOptions = ((clientsData ?? []) as ClientRecord[]).map(c => c.brandName);
  const swatchCatOptions = (swatchCatsData ?? []).filter(c => c.isActive).map(c => ({ value: c.name, label: c.name }));

  // ── Form helpers ──
  function openCreate() {
    setEditRecord(null); setForm(EMPTY_FORM); setErrors({});
    setWipMedia([]); setFinalMedia([]); setPendingWip([]); setPendingFinal([]);
    setShowForm(true);
    setTimeout(() => document.getElementById("swatch-name-input")?.focus(), 80);
  }

  function openEdit(r: SwatchRecord) {
    setEditRecord(r);
    setForm({
      client: r.client ?? "", swatchName: r.swatchName,
      swatchCategory: r.swatchCategory ?? "", fabric: r.fabric ?? "",
      location: r.location ?? "", swatchDate: r.swatchDate ?? "",
      length: r.length ?? "", width: r.width ?? "",
      unitType: r.unitType ?? "", hours: r.hours ?? "",
      attachments: (r.attachments as SwatchAttachment[]) ?? [], isActive: r.isActive,
    });
    setWipMedia((r.wipMedia as MediaItem[]) ?? []);
    setFinalMedia((r.finalMedia as MediaItem[]) ?? []);
    setPendingWip([]); setPendingFinal([]);
    setErrors({}); setShowForm(true);
    setTimeout(() => document.getElementById("swatch-form-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function closeForm() {
    pendingWip.forEach(p => URL.revokeObjectURL(p.previewUrl));
    pendingFinal.forEach(p => URL.revokeObjectURL(p.previewUrl));
    setShowForm(false); setEditRecord(null); setForm(EMPTY_FORM); setErrors({});
    setWipMedia([]); setFinalMedia([]); setPendingWip([]); setPendingFinal([]);
  }

  function addPending(category: "wip" | "final", files: File[]) {
    const items: PendingMedia[] = files.map(f => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));
    if (category === "wip") setPendingWip(p => [...p, ...items]);
    else setPendingFinal(p => [...p, ...items]);
  }

  function removePending(category: "wip" | "final", id: string) {
    if (category === "wip") {
      setPendingWip(p => { const item = p.find(x => x.id === id); if (item) URL.revokeObjectURL(item.previewUrl); return p.filter(x => x.id !== id); });
    } else {
      setPendingFinal(p => { const item = p.find(x => x.id === id); if (item) URL.revokeObjectURL(item.previewUrl); return p.filter(x => x.id !== id); });
    }
  }

  async function uploadPendingToServer(swatchId: number, pending: PendingMedia[], category: "wip" | "final") {
    for (const p of pending) {
      const fd = new FormData();
      fd.append("file", p.file);
      fd.append("category", category);
      await fetch(`/api/swatches/${swatchId}/media`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
    }
  }

  // ── Validation ──
  function setField<K extends keyof SwatchFormData>(key: K, val: SwatchFormData[K]) {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }

  function validate(): boolean {
    const e: FormErrors = {};
    const name = form.swatchName.trim();
    if (!name) e.swatchName = "Swatch Name is required.";
    else if (!NAME_REGEX.test(name)) e.swatchName = "Swatch Name must contain only letters and spaces (max 100 characters).";
    else if (name.length > 100) e.swatchName = "Swatch Name must contain only letters and spaces (max 100 characters).";

    if (form.swatchDate) {
      const d = new Date(form.swatchDate);
      const today = new Date(); today.setHours(23, 59, 59, 999);
      if (d > today) e.swatchDate = "Future date is not allowed.";
    }

    if (form.length && !NUMERIC_REGEX.test(form.length.trim())) e.length = "Length must be a positive numeric value.";
    if (form.width && !NUMERIC_REGEX.test(form.width.trim())) e.width = "Width must be a positive numeric value.";
    if (form.hours && !NUMERIC_REGEX.test(form.hours.trim())) e.hours = "Hours must be a positive numeric value.";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!validate()) return;
    const payload: SwatchFormData = {
      ...form,
      swatchName: form.swatchName.trim(),
      length: form.length.trim(),
      width: form.width.trim(),
      hours: form.hours.trim(),
    };
    try {
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: payload });
        if (pendingWip.length > 0) await uploadPendingToServer(editRecord.id, pendingWip, "wip");
        if (pendingFinal.length > 0) await uploadPendingToServer(editRecord.id, pendingFinal, "final");
        toast({ title: "Swatch updated successfully." });
      } else {
        const record = await createMutation.mutateAsync(payload) as SwatchRecord;
        if (pendingWip.length > 0) await uploadPendingToServer(record.id, pendingWip, "wip");
        if (pendingFinal.length > 0) await uploadPendingToServer(record.id, pendingFinal, "final");
        toast({ title: "Swatch created successfully." });
      }
      closeForm();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    }
  }

  // ── Delete ──
  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast({ title: "Swatch deleted" });
  }

  // ── Status Toggle ──
  async function confirmStatusChange() {
    if (!statusConfirm) return;
    await toggleStatus.mutateAsync(statusConfirm.id);
    setStatusConfirm(null);
    toast({ title: "Swatch status updated successfully." });
  }

  // ── Attachments ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const d = (ev.target?.result as string).split(",")[1] ?? "";
        const att: SwatchAttachment = { name: file.name, type: file.type, data: d, size: file.size };
        setForm(f => ({ ...f, attachments: [...f.attachments, att] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));
  }

  // ── Add Category/Unit ──
  async function handleAddCategory(name: string) {
    const record = await createCatMutation.mutateAsync({ name, isActive: true }) as { name: string };
    setField("swatchCategory", record.name);
  }

  async function handleAddUnit(name: string) {
    const record = await createUnitType.mutateAsync({ name, isActive: true }) as { name: string };
    setField("unitType", record.name);
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
      const result = await importMutation.mutateAsync(rows) as import("@/hooks/useSwatches").SwatchImportResult;
      toast({ title: `Import done: ${result.succeeded} added, ${result.failed} failed` });
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

  // ── Export All ──
  async function handleExportAll() {
    setExporting(true);
    setExportDropOpen(false);
    try {
      const rows = await fetchAllSwatchesForExport({ search, status, client: clientFilter, location: locationFilter, swatchCategory: swatchCategoryFilter });
      const sheet = rows.map(r => ({
        "Swatch No": r.swatchCode,
        "Swatch Name": r.swatchName,
        "Client": r.client ?? "",
        "Category": r.swatchCategory ?? "",
        "Base Fabric": r.fabric ?? "",
        "Location": r.location ?? "",
        "Date": r.swatchDate ?? "",
        "Length": r.length ?? "",
        "Width": r.width ?? "",
        "Unit Type": r.unitType ?? "",
        "Hours": r.hours ?? "",
        "Status": r.isActive ? "Active" : "Inactive",
        "Created By": r.createdBy,
        "Created At": formatDate(r.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(sheet);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Swatches");
      XLSX.writeFile(wb, "swatches_export.xlsx");
      toast({ title: `Exported ${rows.length} records` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  // ── Clear Filters ──
  function clearFilters() {
    setSearch(""); setStatus("all"); setClientFilter(""); setLocationFilter(""); setSwatchCategoryFilter(""); setPage(1);
  }

  const hasFilters = search || status !== "all" || clientFilter || locationFilter || swatchCategoryFilter;

  // ── Table ──
  const rows: TableRow[] = ((data?.data ?? []) as SwatchRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "swatchCode", label: "Swatch No", render: (r) => asSwatch(r).swatchCode },
    { key: "swatchName", label: "Swatch Name", render: (r) => asSwatch(r).swatchName },
    { key: "client", label: "Client", render: (r) => asSwatch(r).client || "—" },
    { key: "swatchCategory", label: "Category", render: (r) => asSwatch(r).swatchCategory || "—" },
    { key: "fabric", label: "Base Fabric", render: (r) => asSwatch(r).fabric || "—" },
    { key: "location", label: "Location", render: (r) => {
      const loc = asSwatch(r).location;
      if (!loc) return "—";
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${loc === "Inhouse" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>{loc}</span>;
    }},
    { key: "swatchDate", label: "Date", render: (r) => formatDate(asSwatch(r).swatchDate) },
    { key: "length", label: "Length", render: (r) => asSwatch(r).length || "—" },
    { key: "unitType", label: "Unit", render: (r) => asSwatch(r).unitType || "—" },
    { key: "width", label: "Width", render: (r) => asSwatch(r).width || "—" },
    { key: "isActive", label: "Status", render: (r) => {
      const rec = asSwatch(r);
      return (
        <button
          type="button"
          onClick={() => setStatusConfirm({ id: rec.id, isActive: rec.isActive })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rec.isActive ? "bg-gray-900" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${rec.isActive ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </button>
      );
    }},
    { key: "createdBy", label: "Created By", render: (r) => asSwatch(r).createdBy },
    { key: "actions", label: "Actions", render: (r) => {
      const rec = asSwatch(r);
      return (
        <div className="flex gap-2">
          <button onClick={() => openEdit(rec)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
          <button onClick={() => setDeleteId(rec.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
        </div>
      );
    }},
  ];

  if (!user) return null;

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Swatch Master</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage fabric swatches</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Import dropdown */}
            <div className="relative">
              <button
                onClick={() => { setImportDropOpen(o => !o); setExportDropOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[#C9B45C]/50 bg-white text-gray-700 hover:border-[#C9B45C] hover:bg-amber-50/40 transition"
              >
                <FileSpreadsheet size={15} className="text-[#C9B45C]" />
                Import
                <ChevronDown size={13} className="text-gray-400" />
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

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => { setExportDropOpen(o => !o); setImportDropOpen(false); }}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[#C9B45C]/50 bg-white text-gray-700 hover:border-[#C9B45C] hover:bg-amber-50/40 transition disabled:opacity-60"
              >
                {exporting ? <Loader2 size={15} className="animate-spin text-[#C9B45C]" /> : <FileDown size={15} className="text-[#C9B45C]" />}
                Export
                <ChevronDown size={13} className="text-gray-400" />
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
            <button
              onClick={showForm && !editRecord ? closeForm : openCreate}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 font-medium transition"
            >
              {showForm && !editRecord ? <X size={15} /> : null}
              {showForm && !editRecord ? "Cancel" : "+ Add Swatch"}
            </button>
          </div>
        </div>

        {/* ── On-page Form ── */}
        {showForm && (
          <div id="swatch-form-card" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Form Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {editRecord ? `Edit Swatch — ${editRecord.swatchCode}` : "New Swatch"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Fields marked <span className="text-red-500">*</span> are required</p>
              </div>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition"><X size={16} /></button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left: Fields */}
                <div className="lg:col-span-2 space-y-5">
                  <div className="grid grid-cols-2 gap-x-5 gap-y-4">

                    {/* Client */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                      <SearchableSelect value={form.client} onChange={(v) => setField("client", v)}
                        options={clientOptions} placeholder="Select client" clearable />
                    </div>

                    {/* Swatch Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Swatch Name <span className="text-red-500">*</span></label>
                      <input id="swatch-name-input" type="text" value={form.swatchName} maxLength={100}
                        onChange={(e) => setField("swatchName", e.target.value)}
                        placeholder="e.g. Silk Brocade"
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 transition ${errors.swatchName ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-gray-900"}`} />
                      {errors.swatchName && <p className="text-xs text-red-500 mt-1">{errors.swatchName}</p>}
                    </div>

                    {/* Swatch Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Swatch Category</label>
                      <AddableSelect value={form.swatchCategory} onChange={(v) => setField("swatchCategory", v)}
                        onAdd={() => setAddCatOpen(true)} addLabel="+ Add New Category"
                        options={swatchCatOptions} placeholder="Select category" />
                    </div>

                    {/* Base Fabric */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Base Fabric</label>
                      <SearchableSelect value={form.fabric} onChange={(v) => setField("fabric", v)}
                        options={fabricOptions.map(o => o.value)} placeholder="Select fabric" clearable />
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <SearchableSelect value={form.location} onChange={(v) => setField("location", v)}
                        options={LOCATION_OPTIONS} placeholder="Select location" clearable />
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input type="date" value={form.swatchDate} max={todayStr()}
                        onChange={(e) => setField("swatchDate", e.target.value)}
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 transition ${errors.swatchDate ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-gray-900"}`} />
                      {errors.swatchDate && <p className="text-xs text-red-500 mt-1">{errors.swatchDate}</p>}
                    </div>

                    {/* Length */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                      <input type="number" value={form.length} min="0" step="0.01"
                        onKeyDown={(e) => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
                        onChange={(e) => setField("length", e.target.value)}
                        placeholder="e.g. 120"
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 transition ${errors.length ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-gray-900"}`} />
                      {errors.length && <p className="text-xs text-red-500 mt-1">{errors.length}</p>}
                    </div>

                    {/* Width */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                      <input type="number" value={form.width} min="0" step="0.01"
                        onKeyDown={(e) => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
                        onChange={(e) => setField("width", e.target.value)}
                        placeholder="e.g. 60"
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 transition ${errors.width ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-gray-900"}`} />
                      {errors.width && <p className="text-xs text-red-500 mt-1">{errors.width}</p>}
                    </div>

                    {/* Unit Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type</label>
                      <AddableSelect value={form.unitType} onChange={(v) => setField("unitType", v)}
                        onAdd={() => setAddUnitOpen(true)} addLabel="+ Add Unit Type"
                        options={unitOptions} placeholder="Select unit" />
                    </div>

                    {/* Hours */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                      <input type="number" value={form.hours} min="0" step="0.01"
                        onKeyDown={(e) => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
                        onChange={(e) => setField("hours", e.target.value)}
                        placeholder="e.g. 4.5"
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 transition ${errors.hours ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-gray-900"}`} />
                      {errors.hours && <p className="text-xs text-red-500 mt-1">{errors.hours}</p>}
                    </div>
                  </div>

                  {/* Active toggle */}
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <button type="button" onClick={() => setField("isActive", !form.isActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                    <span className="text-sm text-gray-500">{form.isActive ? "Active" : "Inactive"}</span>
                  </div>

                  {/* Attachments */}
                  <div className="space-y-2 pt-1 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">Attachments</span>
                      <label className="flex items-center gap-1 cursor-pointer px-2 py-1 rounded border border-dashed border-gray-300 text-xs text-gray-500 hover:border-amber-400 hover:text-amber-700 transition">
                        <Paperclip size={11} /> Upload
                        <input type="file" multiple className="hidden" onChange={handleFileChange} />
                      </label>
                    </div>
                    {form.attachments.length > 0 && (
                      <ul className="space-y-1">
                        {form.attachments.map((att, idx) => (
                          <li key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-sm text-gray-700">
                            <Paperclip size={12} className="text-gray-400 shrink-0" />
                            <span className="flex-1 truncate text-xs">{att.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{(att.size / 1024).toFixed(1)} KB</span>
                            <button type="button" onClick={() => removeAttachment(idx)} className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><X size={12} /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Right: Media */}
                <div className="space-y-5">
                  {/* WIP Images */}
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
                    {editRecord ? (
                      <>
                        <LocalMediaPanel
                          label="WIP Images"
                          pending={pendingWip}
                          onAdd={(files) => addPending("wip", files)}
                          onRemove={(id) => removePending("wip", id)}
                          serverItems={wipMedia}
                        />
                        <div className="border-t border-gray-200 pt-3">
                          <MediaUploadSection
                            entityType="swatches"
                            entityId={editRecord.id}
                            wipMedia={wipMedia}
                            finalMedia={finalMedia}
                            onUpdate={({ wipMedia: wm, finalMedia: fm }) => { setWipMedia(wm); setFinalMedia(fm); }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <LocalMediaPanel
                          label="WIP Images"
                          pending={pendingWip}
                          onAdd={(files) => addPending("wip", files)}
                          onRemove={(id) => removePending("wip", id)}
                        />
                        <div className="border-t border-gray-200 pt-3 mt-2">
                          <LocalMediaPanel
                            label="Final Images"
                            pending={pendingFinal}
                            onAdd={(files) => addPending("final", files)}
                            onRemove={(id) => removePending("final", id)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Info hint for new */}
                  {!editRecord && (pendingWip.length > 0 || pendingFinal.length > 0) && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Images marked <strong>new</strong> will be uploaded automatically when you save.
                    </p>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-5 mt-5 border-t border-gray-100">
                <button type="button" onClick={closeForm}
                  className="px-5 py-2.5 text-sm rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="px-6 py-2.5 text-sm rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-gray-800 font-medium transition disabled:opacity-60 flex items-center gap-2">
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Saving…" : (editRecord ? "Update Swatch" : "Create Swatch")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="space-y-3">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search swatches…" />
            </div>
            <select value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              <option value="">All Clients</option>
              {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              <option value="">All Locations</option>
              {LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={swatchCategoryFilter} onChange={(e) => { setSwatchCategoryFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              <option value="">All Categories</option>
              {swatchCatOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
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
        </div>

        {/* ── Table ── */}
        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        {/* ── Modals ── */}
        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Swatch" message="Are you sure you want to delete this swatch?" />

        <ConfirmModal
          open={statusConfirm !== null}
          onCancel={() => setStatusConfirm(null)}
          onConfirm={() => { void confirmStatusChange(); }}
          title="Change Status"
          message={`Are you sure you want to ${statusConfirm?.isActive ? "deactivate" : "activate"} this swatch?`}
        />

        <InlineAddModal title="Add Swatch Category" open={addCatOpen} onClose={() => setAddCatOpen(false)}
          onAdd={handleAddCategory} adding={createCatMutation.isPending} />

        <InlineAddModal title="Add Unit Type" open={addUnitOpen} onClose={() => setAddUnitOpen(false)}
          onAdd={handleAddUnit} adding={createUnitType.isPending} />

        {/* Close dropdowns on outside click */}
        {(importDropOpen || exportDropOpen) && (
          <div className="fixed inset-0 z-20" onClick={() => { setImportDropOpen(false); setExportDropOpen(false); }} />
        )}
      </div>
    </AppLayout>
  );
}
