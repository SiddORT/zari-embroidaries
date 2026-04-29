import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, Save, X, Upload, ZoomIn, Trash2, Film, Paperclip,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import TopNavbar from "@/components/layout/TopNavbar";
import SearchableSelect from "@/components/ui/SearchableSelect";
import AddableSelect from "@/components/ui/AddableSelect";
import MediaUploadSection from "@/components/ui/MediaUploadSection";

import {
  useSwatch, useCreateSwatch, useUpdateSwatch,
  type SwatchRecord, type SwatchFormData, type SwatchAttachment, type MediaItem,
} from "@/hooks/useSwatches";
import { useAllFabrics } from "@/hooks/useFabrics";
import { useUnitTypes, useSwatchCategories, useCreateSwatchCategory, useCreateUnitType } from "@/hooks/useLookups";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";

// ─── Constants ──────────────────────────────────────────────────────────────────
const LOCATION_OPTIONS = ["Inhouse", "Client"];
const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

const EMPTY_FORM: SwatchFormData = {
  client: "", swatchName: "", swatchCategory: "", fabric: "",
  location: "", swatchDate: "", length: "", width: "", unitType: "",
  hours: "", attachments: [], isActive: true,
};

type FormErrors = Partial<Record<keyof SwatchFormData, string>>;
type PendingMedia = { id: string; file: File; previewUrl: string };

function todayStr() { return new Date().toISOString().split("T")[0]; }

// ─── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2"><X size={20} /></button>
      <img src={src} alt="preview" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ─── Local Media Panel ─────────────────────────────────────────────────────────
interface LocalMediaPanelProps {
  label: string;
  pending: PendingMedia[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}

function LocalMediaPanel({ label, pending, onAdd, onRemove }: LocalMediaPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        <label className="flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded border border-dashed border-gray-300 text-xs text-gray-500 hover:border-[#C9B45C] hover:text-amber-700 transition">
          <Upload size={11} /> Upload
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            multiple className="hidden"
            onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) onAdd(files); e.target.value = ""; }} />
        </label>
      </div>
      {pending.length === 0
        ? <p className="text-xs text-gray-400 italic py-1">No files yet.</p>
        : (
          <div className="grid grid-cols-4 gap-2">
            {pending.map(p => (
              <div key={p.id} className="relative group rounded-lg border border-amber-200 bg-amber-50 aspect-square flex items-center justify-center overflow-hidden">
                {p.file.type.startsWith("image/")
                  ? <img src={p.previewUrl} alt={p.file.name} className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-1 p-1"><Film size={22} className="text-amber-400" /><span className="text-[9px] text-amber-700 truncate w-full text-center">{p.file.name}</span></div>
                }
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                  {p.file.type.startsWith("image/") && (
                    <button type="button" onClick={() => setPreviewSrc(p.previewUrl)}
                      className="p-1 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow"><ZoomIn size={12} /></button>
                  )}
                  <button type="button" onClick={() => onRemove(p.id)}
                    className="p-1 rounded-full bg-white/90 text-red-500 hover:bg-white shadow"><X size={12} /></button>
                </div>
                <span className="absolute top-0.5 right-0.5 text-[8px] bg-amber-500 text-white rounded px-1 leading-tight py-0.5">new</span>
              </div>
            ))}
          </div>
        )
      }
      {previewSrc && <Lightbox src={previewSrc} onClose={() => setPreviewSrc(null)} />}
    </div>
  );
}

// ─── Inline Add Modal ──────────────────────────────────────────────────────────
function InlineAddModal({ title, open, onClose, onAdd, adding }: {
  title: string; open: boolean; onClose: () => void; onAdd: (name: string) => Promise<void>; adding: boolean;
}) {
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
            <input ref={inputRef} type="text" value={name} onChange={e => { setName(e.target.value); setErr(""); }}
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

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function SwatchForm() {
  const [currentPath, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

  // Detect create mode: either explicit /new route (params.id undefined) or path ends with /new
  const isNew = !params.id || currentPath.endsWith("/new");
  const numId = isNew ? null : parseInt(params.id ?? "", 10);

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

  // ── Load swatch for edit ──
  const { data: existing, isLoading: loadingRecord } = useSwatch(numId);

  // ── Form state ──
  const [form, setForm] = useState<SwatchFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [populated, setPopulated] = useState(false);

  // ── Media state ──
  const [wipMedia, setWipMedia] = useState<MediaItem[]>([]);
  const [finalMedia, setFinalMedia] = useState<MediaItem[]>([]);
  const [pendingWip, setPendingWip] = useState<PendingMedia[]>([]);
  const [pendingFinal, setPendingFinal] = useState<PendingMedia[]>([]);

  // ── Modals ──
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addUnitOpen, setAddUnitOpen] = useState(false);

  // ── Data ──
  const { data: fabricsData } = useAllFabrics();
  const { data: unitTypesData } = useUnitTypes();
  const { data: clientsData } = useAllClients();
  const { data: swatchCatsData } = useSwatchCategories();

  const createMutation = useCreateSwatch();
  const updateMutation = useUpdateSwatch();
  const createCatMutation = useCreateSwatchCategory();
  const createUnitType = useCreateUnitType();

  const fabricOptions = (fabricsData ?? []).map(f => { const v = `${f.fabricType} – ${f.quality}`.trim(); return { value: v, label: v }; });
  const unitOptions = (unitTypesData ?? []).filter(u => u.isActive).map(u => ({ value: u.name, label: u.name }));
  const clientOptions = ((clientsData ?? []) as ClientRecord[]).map(c => c.brandName);
  const swatchCatOptions = (swatchCatsData ?? []).filter(c => c.isActive).map(c => ({ value: c.name, label: c.name }));

  // Populate form from loaded record (edit mode)
  useEffect(() => {
    if (!isNew && existing && !populated) {
      setForm({
        client: existing.client ?? "", swatchName: existing.swatchName,
        swatchCategory: existing.swatchCategory ?? "", fabric: existing.fabric ?? "",
        location: existing.location ?? "", swatchDate: existing.swatchDate ?? "",
        length: existing.length ?? "", width: existing.width ?? "",
        unitType: existing.unitType ?? "", hours: existing.hours ?? "",
        attachments: (existing.attachments as SwatchAttachment[]) ?? [], isActive: existing.isActive,
      });
      setWipMedia((existing.wipMedia as MediaItem[]) ?? []);
      setFinalMedia((existing.finalMedia as MediaItem[]) ?? []);
      setPopulated(true);
    }
  }, [existing, isNew, populated]);

  // ── Field helper ──
  function setField<K extends keyof SwatchFormData>(key: K, val: SwatchFormData[K]) {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }

  // ── Pending media helpers ──
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
    const setter = category === "wip" ? setPendingWip : setPendingFinal;
    setter(p => { const item = p.find(x => x.id === id); if (item) URL.revokeObjectURL(item.previewUrl); return p.filter(x => x.id !== id); });
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
  function validate(): boolean {
    const e: FormErrors = {};
    const name = form.swatchName.trim();
    if (!name) e.swatchName = "Swatch Name is required.";
    else if (name.length > 50) e.swatchName = "Swatch Name must be 50 characters or fewer.";
    else if (!NAME_REGEX.test(name)) e.swatchName = "Swatch Name must contain only letters and spaces.";

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
      if (!isNew && numId) {
        await updateMutation.mutateAsync({ id: numId, data: payload });
        if (pendingWip.length > 0) await uploadPendingToServer(numId, pendingWip, "wip");
        if (pendingFinal.length > 0) await uploadPendingToServer(numId, pendingFinal, "final");
        toast({ title: "Swatch updated successfully." });
      } else {
        const record = await createMutation.mutateAsync(payload) as SwatchRecord;
        if (pendingWip.length > 0) await uploadPendingToServer(record.id, pendingWip, "wip");
        if (pendingFinal.length > 0) await uploadPendingToServer(record.id, pendingFinal, "final");
        toast({ title: "Swatch created successfully." });
      }
      setLocation("/masters/swatches");
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    }
  }

  // ── Attachments ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const d = (ev.target?.result as string).split(",")[1] ?? "";
        setForm(f => ({ ...f, attachments: [...f.attachments, { name: file.name, type: file.type, data: d, size: file.size }] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));
  }

  // ── Add category/unit ──
  async function handleAddCategory(name: string) {
    const record = await createCatMutation.mutateAsync({ name, isActive: true }) as { name: string };
    setField("swatchCategory", record.name);
  }

  async function handleAddUnit(name: string) {
    const record = await createUnitType.mutateAsync({ name, isActive: true }) as { name: string };
    setField("unitType", record.name);
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  if (!user) return null;
  if (!isNew && loadingRecord) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavbar username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending} />

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">

        {/* ── Page Header ── */}
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/masters/swatches")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="h-5 w-px bg-gray-300" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isNew ? "New Swatch" : `Edit Swatch — ${existing?.swatchCode ?? ""}`}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {isNew ? "Create a new fabric swatch" : "Update swatch details"}
            </p>
          </div>
        </div>

        {/* ── Form Card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 rounded-t-2xl">
            <p className="text-xs text-gray-500">Fields marked <span className="text-red-500">*</span> are required</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Left: Fields (2/3) */}
              <div className="lg:col-span-2 space-y-6">

                {/* Basic Info */}
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-4">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-4">

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                      <SearchableSelect value={form.client} onChange={v => setField("client", v)}
                        options={clientOptions} placeholder="Select client" clearable />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Swatch Name <span className="text-red-500">*</span></label>
                      <input type="text" value={form.swatchName} maxLength={50}
                        onChange={e => setField("swatchName", e.target.value.slice(0, 50))}
                        placeholder="e.g. Silk Brocade"
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 transition ${errors.swatchName ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-gray-900"}`} />
                      {errors.swatchName && <p className="text-xs text-red-500 mt-1">{errors.swatchName}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Swatch Category</label>
                      <AddableSelect value={form.swatchCategory} onChange={v => setField("swatchCategory", v)}
                        onAdd={() => setAddCatOpen(true)} addLabel="+ Add New Category"
                        options={swatchCatOptions} placeholder="Select category" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Base Fabric</label>
                      <SearchableSelect value={form.fabric} onChange={v => setField("fabric", v)}
                        options={fabricOptions.map(o => o.value)} placeholder="Select fabric" clearable />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <SearchableSelect value={form.location} onChange={v => setField("location", v)}
                        options={LOCATION_OPTIONS} placeholder="Select location" clearable />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input type="date" value={form.swatchDate} max={todayStr()}
                        onChange={e => setField("swatchDate", e.target.value)}
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 transition ${errors.swatchDate ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-gray-900"}`} />
                      {errors.swatchDate && <p className="text-xs text-red-500 mt-1">{errors.swatchDate}</p>}
                    </div>
                  </div>
                </div>

                {/* Measurements */}
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-4">Measurements</h3>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-4">

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                      <input type="number" value={form.length} min="0" step="0.01"
                        onKeyDown={e => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
                        onChange={e => setField("length", e.target.value)}
                        placeholder="e.g. 120"
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 transition ${errors.length ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-gray-900"}`} />
                      {errors.length && <p className="text-xs text-red-500 mt-1">{errors.length}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                      <input type="number" value={form.width} min="0" step="0.01"
                        onKeyDown={e => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
                        onChange={e => setField("width", e.target.value)}
                        placeholder="e.g. 60"
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 transition ${errors.width ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-gray-900"}`} />
                      {errors.width && <p className="text-xs text-red-500 mt-1">{errors.width}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type</label>
                      <AddableSelect value={form.unitType} onChange={v => setField("unitType", v)}
                        onAdd={() => setAddUnitOpen(true)} addLabel="+ Add Unit Type"
                        options={unitOptions} placeholder="Select unit" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                      <input type="number" value={form.hours} min="0" step="0.01"
                        onKeyDown={e => { if (["e","E","+","-"].includes(e.key)) e.preventDefault(); }}
                        onChange={e => setField("hours", e.target.value)}
                        placeholder="e.g. 4.5"
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 transition ${errors.hours ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-gray-900"}`} />
                      {errors.hours && <p className="text-xs text-red-500 mt-1">{errors.hours}</p>}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-sm font-medium text-gray-700">Active</span>
                  <button type="button" onClick={() => setField("isActive", !form.isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <span className="text-sm text-gray-500">{form.isActive ? "Active" : "Inactive"}</span>
                </div>

                {/* Attachments */}
                <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Attachments</h3>
                    <label className="flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded border border-dashed border-gray-300 text-xs text-gray-500 hover:border-[#C9B45C] hover:text-amber-700 transition">
                      <Paperclip size={11} /> Add File
                      <input type="file" multiple className="hidden" onChange={handleFileChange} />
                    </label>
                  </div>
                  {form.attachments.length === 0
                    ? <p className="text-xs text-gray-400 italic">No attachments yet.</p>
                    : (
                      <ul className="space-y-1.5">
                        {form.attachments.map((att, idx) => (
                          <li key={idx} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-sm text-gray-700 border border-gray-100">
                            <Paperclip size={12} className="text-gray-400 shrink-0" />
                            <span className="flex-1 truncate text-xs">{att.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{(att.size / 1024).toFixed(1)} KB</span>
                            <button type="button" onClick={() => removeAttachment(idx)} className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><X size={12} /></button>
                          </li>
                        ))}
                      </ul>
                    )
                  }
                </div>
              </div>

              {/* Right: Media (1/3) */}
              <div className="space-y-5">
                <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">WIP & Final Images</h3>

                  {!isNew && numId ? (
                    /* Edit mode: live server upload panel */
                    <MediaUploadSection
                      entityType="swatches"
                      entityId={numId}
                      wipMedia={wipMedia}
                      finalMedia={finalMedia}
                      onUpdate={({ wipMedia: wm, finalMedia: fm }) => { setWipMedia(wm); setFinalMedia(fm); }}
                    />
                  ) : (
                    /* Create mode: local pending panels */
                    <div className="space-y-4">
                      <LocalMediaPanel label="WIP" pending={pendingWip}
                        onAdd={f => addPending("wip", f)} onRemove={id => removePending("wip", id)} />
                      <div className="border-t border-gray-200 pt-4">
                        <LocalMediaPanel label="Final" pending={pendingFinal}
                          onAdd={f => addPending("final", f)} onRemove={id => removePending("final", id)} />
                      </div>
                      {(pendingWip.length > 0 || pendingFinal.length > 0) && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Images will be uploaded automatically when you save.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit mode: also allow new pending uploads */}
                {!isNew && numId && (pendingWip.length > 0 || pendingFinal.length > 0) && (
                  <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/50 space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">New Files (queued)</h3>
                    <LocalMediaPanel label="WIP" pending={pendingWip}
                      onAdd={f => addPending("wip", f)} onRemove={id => removePending("wip", id)} />
                    <div className="border-t border-amber-200 pt-3">
                      <LocalMediaPanel label="Final" pending={pendingFinal}
                        onAdd={f => addPending("final", f)} onRemove={id => removePending("final", id)} />
                    </div>
                    <p className="text-xs text-amber-700">Will be uploaded when you save.</p>
                  </div>
                )}

                {/* Quick-add pending buttons for edit mode */}
                {!isNew && numId && pendingWip.length === 0 && pendingFinal.length === 0 && (
                  <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Queue additional files to upload on save:</p>
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-1 cursor-pointer px-2 py-2 rounded border border-dashed border-gray-300 text-xs text-gray-500 hover:border-[#C9B45C] hover:text-amber-700 transition">
                        <Upload size={11} /> WIP
                        <input type="file" accept="image/*,video/*" multiple className="hidden"
                          onChange={e => { addPending("wip", Array.from(e.target.files ?? [])); e.target.value = ""; }} />
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-1 cursor-pointer px-2 py-2 rounded border border-dashed border-gray-300 text-xs text-gray-500 hover:border-[#C9B45C] hover:text-amber-700 transition">
                        <Upload size={11} /> Final
                        <input type="file" accept="image/*,video/*" multiple className="hidden"
                          onChange={e => { addPending("final", Array.from(e.target.files ?? [])); e.target.value = ""; }} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100">
              <button type="button" onClick={() => setLocation("/masters/swatches")}
                className="px-5 py-2.5 text-sm rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 text-sm rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-gray-800 font-medium transition disabled:opacity-60">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {submitting ? "Saving…" : (isNew ? "Create Swatch" : "Update Swatch")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <InlineAddModal title="Add Swatch Category" open={addCatOpen} onClose={() => setAddCatOpen(false)}
        onAdd={handleAddCategory} adding={createCatMutation.isPending} />
      <InlineAddModal title="Add Unit Type" open={addUnitOpen} onClose={() => setAddUnitOpen(false)}
        onAdd={handleAddUnit} adding={createUnitType.isPending} />
    </div>
  );
}
