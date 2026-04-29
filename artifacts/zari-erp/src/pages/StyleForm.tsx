import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, X, Link2, Plus, Upload, Film, ZoomIn,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import TopNavbar from "@/components/layout/TopNavbar";
import SearchableSelect from "@/components/ui/SearchableSelect";
import InputField from "@/components/ui/InputField";
import MediaUploadSection from "@/components/ui/MediaUploadSection";

import {
  useStyle, useCreateStyle, useUpdateStyle,
  type StyleRecord, type StyleFormData, type MediaItem,
} from "@/hooks/useStyles";
import { useSwatchesForReference, useCreateSwatch, type SwatchRefOption } from "@/hooks/useSwatches";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";
import { useAllStyleCategories, type StyleCategoryRecord } from "@/hooks/useStyleCategories";
import { useSwatchCategories, useUnitTypes } from "@/hooks/useLookups";
import { useAllFabrics } from "@/hooks/useFabrics";

// ─── Constants ──────────────────────────────────────────────────────────────────
const PLACE_OPTIONS = ["In-house", "Out-house"];
const URL_REGEX = /^https?:\/\/.+/i;

const EMPTY_FORM: StyleFormData = {
  client: "", styleNo: "", styleCategory: "", invoiceNo: "", description: "",
  attachLink: "", placeOfIssue: "", vendorPoNo: "", shippingDate: "",
  referenceSwatchId: "", isActive: true,
};

type FormErrors = Partial<Record<keyof StyleFormData, string>>;
type PendingMedia = { id: string; file: File; previewUrl: string };

// ─── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2">
        <X size={20} />
      </button>
      <img src={src} alt="preview" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ─── Local Media Panel (for new records) ───────────────────────────────────────
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
                    <button type="button" onClick={() => setPreviewSrc(p.previewUrl)} className="p-1 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow"><ZoomIn size={12} /></button>
                  )}
                  <button type="button" onClick={() => onRemove(p.id)} className="p-1 rounded-full bg-white/90 text-red-500 hover:bg-white shadow"><X size={12} /></button>
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

// ─── Create & Link Swatch Modal ────────────────────────────────────────────────
const SWATCH_LOCATION_OPTIONS = ["Inhouse", "Client"];
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

interface SwatchMiniForm {
  swatchName: string; client: string; swatchCategory: string; fabric: string;
  location: string; swatchDate: string; length: string; width: string;
  unitType: string; hours: string;
}
const EMPTY_SWATCH: SwatchMiniForm = {
  swatchName: "", client: "", swatchCategory: "", fabric: "",
  location: "", swatchDate: "", length: "", width: "", unitType: "", hours: "",
};
type SwatchMiniErrors = Partial<Record<keyof SwatchMiniForm, string>>;

interface CreateSwatchMiniModalProps {
  open: boolean;
  onClose: () => void;
  prefillClient?: string;
  onCreated: (swatchCode: string, swatchName: string) => void;
}
function CreateSwatchMiniModal({ open, onClose, prefillClient, onCreated }: CreateSwatchMiniModalProps) {
  const [form, setFormM] = useState<SwatchMiniForm>(EMPTY_SWATCH);
  const [errors, setErrors] = useState<SwatchMiniErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);

  const { data: clientsData } = useAllClients();
  const { data: swatchCatsData } = useSwatchCategories();
  const { data: fabricsData } = useAllFabrics();
  const { data: unitTypesData } = useUnitTypes();
  const createSwatch = useCreateSwatch();

  const clientOptions = ((clientsData ?? []) as ClientRecord[]).map(c => c.brandName);
  const catOptions = (swatchCatsData ?? []).filter(c => c.isActive).map(c => c.name);
  const fabricOptions = (fabricsData ?? []).map(f => `${f.fabricType} – ${f.quality}`.trim());
  const unitOptions = (unitTypesData ?? []).filter(u => u.isActive).map(u => u.name);

  useEffect(() => {
    if (open) {
      setFormM({ ...EMPTY_SWATCH, client: prefillClient ?? "" });
      setErrors({});
      setTimeout(() => nameRef.current?.focus(), 60);
    }
  }, [open, prefillClient]);

  if (!open) return null;

  function setF<K extends keyof SwatchMiniForm>(key: K, val: string) {
    setFormM(f => ({ ...f, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }

  function validate(): boolean {
    const e: SwatchMiniErrors = {};
    if (!form.swatchName.trim()) e.swatchName = "Swatch Name is required.";
    if (form.swatchDate) {
      const d = new Date(form.swatchDate);
      const today = new Date(); today.setHours(23, 59, 59, 999);
      if (d > today) e.swatchDate = "Future dates are not allowed.";
    }
    if (form.length && !NUMERIC_REGEX.test(form.length.trim())) e.length = "Must be a positive number.";
    if (form.width && !NUMERIC_REGEX.test(form.width.trim())) e.width = "Must be a positive number.";
    if (form.hours && !NUMERIC_REGEX.test(form.hours.trim())) e.hours = "Must be a positive number.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      const record = await createSwatch.mutateAsync({
        swatchName: form.swatchName.trim(),
        client: form.client || undefined,
        swatchCategory: form.swatchCategory || undefined,
        fabric: form.fabric || undefined,
        location: form.location || undefined,
        swatchDate: form.swatchDate || undefined,
        length: form.length.trim() || undefined,
        width: form.width.trim() || undefined,
        unitType: form.unitType || undefined,
        hours: form.hours.trim() || undefined,
        attachments: [],
        isActive: true,
      } as unknown as Parameters<typeof createSwatch.mutateAsync>[0]) as unknown as { swatchCode: string; swatchName: string };
      onCreated(record.swatchCode, record.swatchName);
      onClose();
    } catch {
      setErrors(e => ({ ...e, swatchName: "Failed to create swatch. Please try again." }));
    }
  }

  const sel = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <Link2 size={15} className="text-[#C6AF4B]" />
            <h3 className="text-base font-semibold text-gray-900">Create &amp; Link New Swatch</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-xs text-gray-400">Fields marked <span className="text-red-500">*</span> are required. A swatch code will be auto-generated.</p>

          <div className="grid grid-cols-2 gap-x-5 gap-y-4">

            {/* Swatch Name */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Swatch Name <span className="text-red-500">*</span></label>
              <input ref={nameRef} type="text" value={form.swatchName}
                onChange={e => setF("swatchName", e.target.value.slice(0, 50))}
                placeholder="Enter swatch name"
                maxLength={50}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 ${errors.swatchName ? "border-red-400" : "border-gray-300"}`} />
              {errors.swatchName && <p className="text-xs text-red-500 mt-1">{errors.swatchName}</p>}
            </div>

            {/* Client */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <SearchableSelect value={form.client} onChange={v => setF("client", v)}
                options={clientOptions} placeholder="Select client" clearable />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Swatch Category</label>
              <select value={form.swatchCategory} onChange={e => setF("swatchCategory", e.target.value)} className={sel}>
                <option value="">— None —</option>
                {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Base Fabric */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base Fabric</label>
              <SearchableSelect value={form.fabric} onChange={v => setF("fabric", v)}
                options={fabricOptions} placeholder="Select fabric" clearable />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select value={form.location} onChange={e => setF("location", e.target.value)} className={sel}>
                <option value="">— None —</option>
                {SWATCH_LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Swatch Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Swatch Date</label>
              <input type="date" value={form.swatchDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={e => setF("swatchDate", e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 ${errors.swatchDate ? "border-red-400" : "border-gray-300"}`} />
              {errors.swatchDate && <p className="text-xs text-red-500 mt-1">{errors.swatchDate}</p>}
            </div>

            {/* Hours */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
              <input type="text" value={form.hours}
                onChange={e => setF("hours", e.target.value)}
                placeholder="e.g. 4.5"
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 ${errors.hours ? "border-red-400" : "border-gray-300"}`} />
              {errors.hours && <p className="text-xs text-red-500 mt-1">{errors.hours}</p>}
            </div>

            {/* Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
              <input type="text" value={form.length}
                onChange={e => setF("length", e.target.value)}
                placeholder="e.g. 120"
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 ${errors.length ? "border-red-400" : "border-gray-300"}`} />
              {errors.length && <p className="text-xs text-red-500 mt-1">{errors.length}</p>}
            </div>

            {/* Width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
              <input type="text" value={form.width}
                onChange={e => setF("width", e.target.value)}
                placeholder="e.g. 60"
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 ${errors.width ? "border-red-400" : "border-gray-300"}`} />
              {errors.width && <p className="text-xs text-red-500 mt-1">{errors.width}</p>}
            </div>

            {/* Unit Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type</label>
              <select value={form.unitType} onChange={e => setF("unitType", e.target.value)} className={sel}>
                <option value="">— None —</option>
                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-5 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={createSwatch.isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-gray-900 text-[#C6AF4B] hover:bg-gray-800 disabled:opacity-60 transition">
              {createSwatch.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {createSwatch.isPending ? "Creating…" : "Create & Link Swatch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-4">{title}</h3>;
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function FieldWrap({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function StyleForm() {
  const [currentPath, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

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

  const { data: existing, isLoading: loadingRecord } = useStyle(numId);

  const [form, setForm] = useState<StyleFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [populated, setPopulated] = useState(false);
  const [wipMedia, setWipMedia] = useState<MediaItem[]>([]);
  const [finalMedia, setFinalMedia] = useState<MediaItem[]>([]);
  const [pendingWip, setPendingWip] = useState<PendingMedia[]>([]);
  const [pendingFinal, setPendingFinal] = useState<PendingMedia[]>([]);
  const [createSwatchOpen, setCreateSwatchOpen] = useState(false);

  const { data: clientsData } = useAllClients();
  const { data: styleCatsData } = useAllStyleCategories();
  const { data: swatchRefs } = useSwatchesForReference();

  const createMutation = useCreateStyle();
  const updateMutation = useUpdateStyle();

  const clientOptions = ((clientsData ?? []) as ClientRecord[]).map(c => c.brandName);
  const styleCatOptions = ((styleCatsData ?? []) as StyleCategoryRecord[])
    .filter(c => c.isActive)
    .map(c => ({ value: c.categoryName, label: c.categoryName }));
  const swatchOptions = ((swatchRefs ?? []) as SwatchRefOption[])
    .filter(s => s.source === "master")
    .map(s => ({ value: s.code, label: `${s.code}${s.name ? ` – ${s.name}` : ""}${s.client ? ` (${s.client})` : ""}` }));

  useEffect(() => {
    if (!isNew && existing && !populated) {
      setForm({
        client: existing.client, styleNo: existing.styleNo,
        styleCategory: existing.styleCategory ?? "",
        invoiceNo: existing.invoiceNo ?? "", description: existing.description ?? "",
        attachLink: existing.attachLink ?? "", placeOfIssue: existing.placeOfIssue ?? "",
        vendorPoNo: existing.vendorPoNo ?? "", shippingDate: existing.shippingDate ?? "",
        referenceSwatchId: existing.referenceSwatchId ?? "", isActive: existing.isActive,
      });
      setWipMedia((existing.wipMedia as MediaItem[]) ?? []);
      setFinalMedia((existing.finalMedia as MediaItem[]) ?? []);
      setPopulated(true);
    }
  }, [existing, isNew, populated]);

  function setField<K extends keyof StyleFormData>(key: K, val: StyleFormData[K]) {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }

  function addPending(category: "wip" | "final", files: File[]) {
    const items: PendingMedia[] = files.map(f => ({
      id: `${Date.now()}-${Math.random()}`, file: f, previewUrl: URL.createObjectURL(f),
    }));
    if (category === "wip") setPendingWip(p => [...p, ...items]);
    else setPendingFinal(p => [...p, ...items]);
  }

  function removePending(category: "wip" | "final", id: string) {
    const setter = category === "wip" ? setPendingWip : setPendingFinal;
    setter(p => { const item = p.find(x => x.id === id); if (item) URL.revokeObjectURL(item.previewUrl); return p.filter(x => x.id !== id); });
  }

  async function uploadPendingToServer(styleId: number, pending: PendingMedia[], category: "wip" | "final") {
    for (const p of pending) {
      const fd = new FormData();
      fd.append("file", p.file);
      fd.append("category", category);
      await fetch(`/api/styles/${styleId}/media`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
    }
  }

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.client.trim()) e.client = "Client is required.";
    if (!form.styleCategory.trim()) e.styleCategory = "Style Category is required.";
    if (!form.description.trim()) e.description = "Description / Style Name is required.";
    if (!form.placeOfIssue.trim()) e.placeOfIssue = "Place of Issue is required.";
    if (form.attachLink.trim() && !URL_REGEX.test(form.attachLink.trim()))
      e.attachLink = "Must be a valid URL starting with http:// or https://.";
    if (form.shippingDate) {
      const d = new Date(form.shippingDate);
      const today = new Date(); today.setHours(23, 59, 59, 999);
      if (isNaN(d.getTime())) e.shippingDate = "Invalid date.";
      else if (d < new Date(new Date().setHours(0, 0, 0, 0))) e.shippingDate = "Shipping date cannot be in the past.";
    }
    if (form.invoiceNo.length > 100) e.invoiceNo = "Invoice No must be 100 characters or fewer.";
    if (form.vendorPoNo.length > 100) e.vendorPoNo = "Vendor PO No must be 100 characters or fewer.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      if (!isNew && numId) {
        await updateMutation.mutateAsync({ id: numId, data: form });
        if (pendingWip.length > 0) await uploadPendingToServer(numId, pendingWip, "wip");
        if (pendingFinal.length > 0) await uploadPendingToServer(numId, pendingFinal, "final");
        toast({ title: "Style updated successfully." });
      } else {
        const record = await createMutation.mutateAsync(form) as StyleRecord;
        if (pendingWip.length > 0) await uploadPendingToServer(record.id, pendingWip, "wip");
        if (pendingFinal.length > 0) await uploadPendingToServer(record.id, pendingFinal, "final");
        toast({ title: "Style created successfully." });
      }
      setLocation("/masters/styles");
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    }
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
          <button onClick={() => setLocation("/masters/styles")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="h-5 w-px bg-gray-300" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isNew ? "New Style" : `Edit Style — ${existing?.styleNo ?? ""}`}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {isNew ? "Create a new style record" : "Update style details"}
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

              {/* ── Left: Fields (2/3) ── */}
              <div className="lg:col-span-2 space-y-6">

                {/* Basic Info */}
                <div>
                  <SectionHeader title="Basic Information" />
                  <div className="grid grid-cols-2 gap-x-5 gap-y-4">

                    <FieldWrap label="Client" required error={errors.client}>
                      <SearchableSelect value={form.client} onChange={v => setField("client", v)}
                        options={clientOptions} placeholder="Select client" clearable />
                    </FieldWrap>

                    {/* Style No — always read-only */}
                    <FieldWrap label="Style No">
                      <div className={`px-3 py-2 text-sm border rounded-lg font-mono ${
                        isNew
                          ? "bg-gray-50 border-dashed border-gray-300 text-gray-400 italic"
                          : "bg-gray-50 border-gray-200 text-gray-500"
                      }`}>
                        {isNew ? "Auto-generated (ST-XXXX)" : (existing?.styleNo ?? "")}
                      </div>
                    </FieldWrap>

                    <FieldWrap label="Style Category" required error={errors.styleCategory}>
                      <SearchableSelect value={form.styleCategory} onChange={v => setField("styleCategory", v)}
                        options={styleCatOptions.map(o => o.value)}
                        placeholder="Select category" clearable />
                    </FieldWrap>

                    <FieldWrap label="Description / Style Name" required error={errors.description}>
                      <input
                        type="text"
                        value={form.description}
                        onChange={e => setField("description", e.target.value)}
                        placeholder="Style description or name"
                        maxLength={200}
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 ${errors.description ? "border-red-400" : "border-gray-300"}`}
                      />
                    </FieldWrap>

                    <FieldWrap label="Place of Issue" required error={errors.placeOfIssue}>
                      <SearchableSelect value={form.placeOfIssue} onChange={v => setField("placeOfIssue", v)}
                        options={PLACE_OPTIONS} placeholder="Select place" clearable />
                    </FieldWrap>

                    <InputField label="Invoice No" value={form.invoiceNo}
                      onChange={e => setField("invoiceNo", e.target.value)}
                      placeholder="Invoice number" error={errors.invoiceNo} maxLength={100} />

                    <InputField label="Vendor PO No" value={form.vendorPoNo}
                      onChange={e => setField("vendorPoNo", e.target.value)}
                      placeholder="Vendor PO number" error={errors.vendorPoNo} maxLength={100} />

                    <FieldWrap label="Shipping Date" error={errors.shippingDate}>
                      <input
                        type="date"
                        value={form.shippingDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={e => setField("shippingDate", e.target.value)}
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 ${errors.shippingDate ? "border-red-400" : "border-gray-300"}`}
                      />
                    </FieldWrap>

                    <div className="col-span-2">
                      <FieldWrap label="Attach Link" error={errors.attachLink}>
                        <input
                          type="url"
                          value={form.attachLink}
                          onChange={e => setField("attachLink", e.target.value)}
                          placeholder="https://…"
                          className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 ${errors.attachLink ? "border-red-400" : "border-gray-300"}`}
                        />
                      </FieldWrap>
                    </div>

                  </div>
                </div>

                {/* Active Status */}
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-sm font-medium text-gray-700">Active</label>
                  <button type="button" onClick={() => setField("isActive", !form.isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <span className="text-sm text-gray-500">{form.isActive ? "Active" : "Inactive"}</span>
                </div>

              </div>

              {/* ── Right: Swatch + Media (1/3) ── */}
              <div className="space-y-6">

                {/* Reference Swatch */}
                <div>
                  <SectionHeader title="Reference Swatch" />
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          value={form.referenceSwatchId}
                          onChange={v => setField("referenceSwatchId", v)}
                          options={swatchOptions.map(o => o.value)}
                          placeholder="Search and select a swatch…"
                          clearable
                        />
                        {form.referenceSwatchId && (
                          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                            <Link2 size={11} />
                            Linked: <span className="font-mono font-semibold">{form.referenceSwatchId}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => setCreateSwatchOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-dashed border-[#C6AF4B] text-[#C6AF4B] hover:bg-amber-50 transition">
                      <Plus size={13} /> Create &amp; Link New Swatch
                    </button>
                  </div>
                </div>

                {/* Media */}
                <div>
                  <SectionHeader title="WIP & Final Media" />
                  {!isNew && numId ? (
                    <MediaUploadSection
                      entityType="styles"
                      entityId={numId}
                      wipMedia={wipMedia}
                      finalMedia={finalMedia}
                      onUpdate={({ wipMedia: wip, finalMedia: fin }) => { setWipMedia(wip); setFinalMedia(fin); }}
                    />
                  ) : (
                    <div className="space-y-4">
                      <LocalMediaPanel label="WIP Media" pending={pendingWip}
                        onAdd={files => addPending("wip", files)} onRemove={id => removePending("wip", id)} />
                      <LocalMediaPanel label="Final Media" pending={pendingFinal}
                        onAdd={files => addPending("final", files)} onRemove={id => removePending("final", id)} />
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* ── Footer Actions ── */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl flex justify-end gap-3">
            <button type="button" onClick={() => setLocation("/masters/styles")}
              className="px-5 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-60 transition">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? "Saving…" : (isNew ? "Create Style" : "Save Changes")}
            </button>
          </div>
        </div>
      </div>

      <CreateSwatchMiniModal
        open={createSwatchOpen}
        onClose={() => setCreateSwatchOpen(false)}
        prefillClient={form.client}
        onCreated={(swatchCode, swatchName) => {
          setField("referenceSwatchId", swatchCode);
          toast({ title: "Swatch created & linked", description: `${swatchCode} – ${swatchName}` });
        }}
      />
    </div>
  );
}
