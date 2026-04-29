import { useState, useEffect, useRef, useCallback } from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Save, Info, Upload, X, FileText, Image as ImageIcon,
  Palette, Ruler, Settings2, MessageSquare, Loader2, Trash2, CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useArtwork, useCreateArtwork, useUpdateArtwork, type FileAttachment } from "@/hooks/useArtworks";
import { useUnitTypes, useCreateUnitType, type LookupRecord } from "@/hooks/useLookups";
import { useAllVendors, type VendorRecord } from "@/hooks/useVendors";
import AddableSelect from "@/components/ui/AddableSelect";
import ImageLightbox from "@/components/ui/ImageLightbox";

const FEEDBACK_STATUSES = ["Pending", "In Review", "Approved", "Revision Required", "Rejected"];
const FEEDBACK_COLORS: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-600 ring-gray-300",
  "In Review": "bg-sky-100 text-sky-700 ring-sky-300",
  Approved: "bg-gray-900 text-[#C9B45C] ring-gray-900",
  "Revision Required": "bg-amber-100 text-amber-700 ring-amber-300",
  Rejected: "bg-red-100 text-red-700 ring-red-300",
};

function SectionCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gray-900">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1.5">
        {label}
        {hint && (
          <span className="group relative cursor-pointer">
            <Info className="h-3.5 w-3.5 text-gray-400" />
            <span className="absolute left-5 top-0 w-44 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 hidden group-hover:block z-10 shadow-lg">{hint}</span>
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400";

function fileToAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result as string, size: file.size });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FileUploadZone({ files, onChange, accept, icon, label, onImageClick }: {
  files: FileAttachment[];
  onChange: (files: FileAttachment[]) => void;
  accept: string;
  icon: React.ReactNode;
  label: string;
  onImageClick?: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles = await Promise.all(Array.from(fileList).map(fileToAttachment));
    onChange([...files, ...newFiles]);
  }

  function remove(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
  }

  // compute a per-image index (only among image files in this array)
  const imageIndices: number[] = [];
  files.forEach((f, i) => { if (f.type.startsWith("image/")) imageIndices.push(i); });

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">{icon}</div>
          <div>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">Click to browse or drag & drop</p>
          </div>
        </div>
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden"
          onChange={e => { void handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {files.length > 0 && (
        <div className="mt-2 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
              {f.type.startsWith("image/") && (
                <img src={f.data} alt={f.name}
                  className="h-14 w-14 rounded-lg object-cover border border-gray-200 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                  onClick={e => { e.stopPropagation(); onImageClick?.(imageIndices.indexOf(i)); }} />
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <span className="text-xs font-medium text-gray-700 truncate">{f.name}</span>
                <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
              <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 transition-colors mt-1 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PAYMENT_MODES = ["Cash", "Bank Transfer", "Cheque", "UPI", "NEFT", "RTGS", "Other"];
const PAYMENT_STATUSES = ["Pending", "Partial", "Paid"];

type FormState = {
  artworkName: string;
  unitLength: string;
  unitWidth: string;
  unitType: string;
  artworkCreated: "Inhouse" | "Outsource";
  workHours: string;
  hourlyRate: string;
  totalCost: string;
  outsourceVendorId: string;
  outsourceVendorName: string;
  outsourcePaymentDate: string;
  outsourcePaymentAmount: string;
  outsourcePaymentMode: string;
  outsourceTransactionId: string;
  outsourcePaymentStatus: string;
  feedbackStatus: string;
  files: FileAttachment[];
  refImages: FileAttachment[];
  wipImages: FileAttachment[];
  finalImages: FileAttachment[];
};

const EMPTY_FORM: FormState = {
  artworkName: "", unitLength: "", unitWidth: "", unitType: "",
  artworkCreated: "Inhouse", workHours: "", hourlyRate: "", totalCost: "",
  outsourceVendorId: "", outsourceVendorName: "", outsourcePaymentDate: "",
  outsourcePaymentAmount: "", outsourcePaymentMode: "", outsourceTransactionId: "",
  outsourcePaymentStatus: "Pending",
  feedbackStatus: "Pending",
  files: [], refImages: [], wipImages: [], finalImages: [],
};

export default function ArtworkDetail() {
  const { swatchOrderId, id } = useParams<{ swatchOrderId: string; id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const isNew = id === "new";
  const numericId = isNew ? null : parseInt(id);
  const swatchOrderIdNum = parseInt(swatchOrderId);

  const { data: artworkData, isLoading } = useArtwork(numericId);
  const createArtwork = useCreateArtwork();
  const updateArtwork = useUpdateArtwork();

  const { data: unitTypeData } = useUnitTypes();
  const unitTypes: LookupRecord[] = unitTypeData ?? [];
  const unitTypeOptions = unitTypes.map(u => ({ value: u.name, label: u.name }));

  const { data: vendorData } = useAllVendors();
  const vendors: VendorRecord[] = (vendorData as VendorRecord[] | undefined) ?? [];
  const vendorOptions = vendors.map(v => ({ value: String(v.id), label: v.brandName }));

  const createUnitType = useCreateUnitType();
  const [addUnitTypeOpen, setAddUnitTypeOpen] = useState(false);
  const [newUnitTypeName, setNewUnitTypeName] = useState("");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: FileAttachment[]; index: number } | null>(null);
  const savedFormRef = useRef<FormState>(EMPTY_FORM);
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedFormRef.current);

  useEffect(() => {
    if (artworkData?.data) {
      const a = artworkData.data;
      const loaded: FormState = {
        artworkName: a.artworkName ?? "",
        unitLength: a.unitLength ?? "",
        unitWidth: a.unitWidth ?? "",
        unitType: a.unitType ?? "",
        artworkCreated: (a.artworkCreated as "Inhouse" | "Outsource") ?? "Inhouse",
        workHours: a.workHours ?? "",
        hourlyRate: a.hourlyRate ?? "",
        totalCost: a.totalCost ?? "",
        outsourceVendorId: a.outsourceVendorId ?? "",
        outsourceVendorName: a.outsourceVendorName ?? "",
        outsourcePaymentDate: a.outsourcePaymentDate ?? "",
        outsourcePaymentAmount: a.outsourcePaymentAmount ?? "",
        outsourcePaymentMode: a.outsourcePaymentMode ?? "",
        outsourceTransactionId: a.outsourceTransactionId ?? "",
        outsourcePaymentStatus: a.outsourcePaymentStatus ?? "Pending",
        feedbackStatus: a.feedbackStatus ?? "Pending",
        files: (a.files ?? []) as FileAttachment[],
        refImages: (a.refImages ?? []) as FileAttachment[],
        wipImages: (a.wipImages ?? []) as FileAttachment[],
        finalImages: (a.finalImages ?? []) as FileAttachment[],
      };
      setForm(loaded);
      savedFormRef.current = loaded;
    }
  }, [artworkData]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function computeTotalCost(hourlyRate: string, workHours: string): string {
    const rate = parseFloat(hourlyRate);
    const hours = parseFloat(workHours);
    if (!isNaN(rate) && !isNaN(hours) && rate > 0 && hours > 0) {
      return (rate * hours).toFixed(2);
    }
    return "";
  }

  async function handleAddUnitType() {
    if (!newUnitTypeName.trim()) return;
    await createUnitType.mutateAsync({ name: newUnitTypeName.trim(), isActive: true });
    set("unitType", newUnitTypeName.trim());
    setAddUnitTypeOpen(false);
  }

  const isViewMode = !isNew && artworkData?.data?.feedbackStatus === "Approved";

  async function handleSave() {
    if (!form.artworkName.trim()) {
      toast({ title: "Artwork Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const payload = { ...form, swatchOrderId: swatchOrderIdNum };
        await createArtwork.mutateAsync(payload);
        toast({ title: "Artwork created" });
        savedFormRef.current = form;
        setLocation(`/swatch-orders/${swatchOrderId}?tab=2`);
      } else if (isViewMode) {
        await updateArtwork.mutateAsync({
          id: numericId!,
          data: {
            swatchOrderId: swatchOrderIdNum,
            artworkName: form.artworkName,
            artworkCreated: form.artworkCreated,
            feedbackStatus: form.feedbackStatus,
            files: form.files,
            refImages: form.refImages,
            wipImages: form.wipImages,
            finalImages: form.finalImages,
            totalCost: form.totalCost,
          },
        });
        savedFormRef.current = form;
        toast({ title: "Artwork updated" });
      } else {
        const payload = { ...form, swatchOrderId: swatchOrderIdNum };
        await updateArtwork.mutateAsync({ id: numericId!, data: payload });
        savedFormRef.current = form;
        toast({ title: "Artwork saved" });
      }
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const handleSaveForGuard = useCallback(async () => { await handleSave(); }, [form, isNew, isViewMode, numericId, swatchOrderId, swatchOrderIdNum]);
  useUnsavedChanges(isDirty, handleSaveForGuard);

  if (!isNew && isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </AppLayout>
    );
  }

  const artworkCode = artworkData?.data?.artworkCode ?? "NEW";

  return (
    <AppLayout>
      <div className="py-6 px-6 max-w-screen-xl mx-auto min-h-screen bg-[#f8f9fb]">

        {/* Sticky header */}
        <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-[#f8f9fb]/95 backdrop-blur border-b border-gray-200">
          <div className="max-w-screen-xl mx-auto flex items-center gap-4">
            <button onClick={() => setLocation(`/swatch-orders/${swatchOrderId}?tab=2`)}
              className="p-2 rounded-xl hover:bg-gray-200 text-gray-500 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-mono font-bold text-gray-700 bg-white border border-gray-200 px-3 py-1 rounded-lg">
                  {artworkCode}
                </span>
                <span className="text-xs text-gray-400">→ Swatch Order #{swatchOrderId}</span>
                {isViewMode && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-900 text-[#C9B45C] border border-gray-900">
                    View Only — Approved
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => { void handleSave(); }} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shrink-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : isViewMode ? "Save Changes" : "Save"}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-5">

          {/* Identity */}
          <SectionCard icon={<Palette className="h-4 w-4 text-[#C9B45C]" />}
            title="Identity" subtitle="Artwork name and basic details">
            <Field label="Artwork Name *">
              <input className={`${inputCls} ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                placeholder="e.g. Floral Border Pattern" readOnly={isViewMode}
                value={form.artworkName} onChange={e => set("artworkName", e.target.value)} />
            </Field>
          </SectionCard>

          {/* Specifications (2-col) */}
          <div className="grid grid-cols-2 gap-5">

            {/* Dimensions */}
            <SectionCard icon={<Ruler className="h-4 w-4 text-[#C9B45C]" />}
              title="Dimensions" subtitle="Size and unit specifications">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Length">
                    <input className={`${inputCls} ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                      type="number" min="0" placeholder="Length" readOnly={isViewMode}
                      value={form.unitLength} onChange={e => set("unitLength", e.target.value)} />
                  </Field>
                  <Field label="Width">
                    <input className={`${inputCls} ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                      type="number" min="0" placeholder="Width" readOnly={isViewMode}
                      value={form.unitWidth} onChange={e => set("unitWidth", e.target.value)} />
                  </Field>
                </div>
                <AddableSelect
                  label="Unit Type"
                  value={form.unitType}
                  onChange={v => set("unitType", v)}
                  onAdd={() => { setNewUnitTypeName(""); setAddUnitTypeOpen(true); }}
                  options={unitTypeOptions}
                  placeholder="Select unit type"
                  disabled={isViewMode}
                />
              </div>
            </SectionCard>

            {/* Production */}
            <SectionCard icon={<Settings2 className="h-4 w-4 text-[#C9B45C]" />}
              title="Production" subtitle="Creation method and cost details">
              <div className="space-y-4">
                <Field label="Artwork Created">
                  <div className="flex gap-2 mt-1">
                    {(["Inhouse", "Outsource"] as const).map(opt => (
                      <button key={opt} type="button"
                        onClick={() => { if (!isViewMode) set("artworkCreated", opt); }}
                        disabled={isViewMode}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold ring-1 transition-all ${
                          form.artworkCreated === opt
                            ? "bg-gray-900 text-[#C9B45C] ring-gray-900"
                            : "bg-white text-gray-500 ring-gray-200 hover:ring-gray-400"
                        } ${isViewMode ? "opacity-70 cursor-default" : ""}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </Field>

                {form.artworkCreated === "Inhouse" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Work Hours" hint="Hours spent on this artwork">
                      <input className={`${inputCls} ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                        type="number" min="0" step="0.5" placeholder="e.g. 8" readOnly={isViewMode}
                        value={form.workHours}
                        onChange={e => {
                          set("workHours", e.target.value);
                          const computed = computeTotalCost(form.hourlyRate, e.target.value);
                          if (computed) set("totalCost", computed);
                        }} />
                    </Field>
                    <Field label="Hourly Rate" hint="Cost per hour for in-house work">
                      <input className={`${inputCls} ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                        type="number" min="0" step="0.01" placeholder="e.g. 250" readOnly={isViewMode}
                        value={form.hourlyRate}
                        onChange={e => {
                          set("hourlyRate", e.target.value);
                          const computed = computeTotalCost(e.target.value, form.workHours);
                          if (computed) set("totalCost", computed);
                        }} />
                    </Field>
                  </div>
                )}

                {form.artworkCreated === "Outsource" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Work Hours" hint="Hours spent on this artwork">
                        <input className={`${inputCls} ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                          type="number" min="0" step="0.5" placeholder="e.g. 8" readOnly={isViewMode}
                          value={form.workHours}
                          onChange={e => {
                            set("workHours", e.target.value);
                            const computed = computeTotalCost(form.hourlyRate, e.target.value);
                            if (computed) set("totalCost", computed);
                          }} />
                      </Field>
                      <Field label="Hourly Rate" hint="Cost per hour">
                        <input className={`${inputCls} ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                          type="number" min="0" step="0.01" placeholder="e.g. 250" readOnly={isViewMode}
                          value={form.hourlyRate}
                          onChange={e => {
                            set("hourlyRate", e.target.value);
                            const computed = computeTotalCost(e.target.value, form.workHours);
                            if (computed) set("totalCost", computed);
                          }} />
                      </Field>
                    </div>
                    <Field label="Vendor">
                      <AddableSelect
                        options={vendorOptions}
                        value={form.outsourceVendorId}
                        onChange={v => {
                          const vendor = vendors.find(vnd => String(vnd.id) === v);
                          set("outsourceVendorId", v ?? "");
                          set("outsourceVendorName", vendor?.brandName ?? "");
                        }}
                        placeholder="Select vendor…"
                        disabled={isViewMode}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Payment Date">
                        <input
                          type="date"
                          className={`${inputCls} ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                          readOnly={isViewMode}
                          value={form.outsourcePaymentDate}
                          onChange={e => set("outsourcePaymentDate", e.target.value)}
                        />
                      </Field>
                      <Field label="Payment Amount">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                          <input
                            type="number" min="0" step="0.01" placeholder="0.00"
                            className={`${inputCls} pl-7 ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                            readOnly={isViewMode}
                            value={form.outsourcePaymentAmount}
                            onChange={e => set("outsourcePaymentAmount", e.target.value)}
                          />
                        </div>
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Payment Mode">
                        <select
                          className={`${inputCls} ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                          disabled={isViewMode}
                          value={form.outsourcePaymentMode}
                          onChange={e => set("outsourcePaymentMode", e.target.value)}>
                          <option value="">Select mode…</option>
                          {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </Field>
                      <Field label="Transaction / Cheque ID">
                        <input
                          type="text" placeholder="e.g. TXN123456"
                          className={`${inputCls} ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                          readOnly={isViewMode}
                          value={form.outsourceTransactionId}
                          onChange={e => set("outsourceTransactionId", e.target.value)}
                        />
                      </Field>
                    </div>

                    <Field label="Payment Status">
                      <div className="flex gap-2 mt-1">
                        {PAYMENT_STATUSES.map(s => (
                          <button key={s} type="button"
                            onClick={() => { if (!isViewMode) set("outsourcePaymentStatus", s); }}
                            disabled={isViewMode}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold ring-1 transition-all ${
                              form.outsourcePaymentStatus === s
                                ? s === "Paid" ? "bg-green-600 text-white ring-green-600"
                                  : s === "Partial" ? "bg-amber-500 text-white ring-amber-500"
                                  : "bg-red-500 text-white ring-red-500"
                                : "bg-white text-gray-500 ring-gray-200 hover:ring-gray-400"
                            } ${isViewMode ? "opacity-70 cursor-default" : ""}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}

                <Field label="Total Cost" hint={form.artworkCreated === "Inhouse" ? "Auto-computed from hourly rate × work hours" : "Vendor quoted / invoiced amount"}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                    <input className={`${inputCls} pl-7 ${isViewMode ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                      type="number" min="0" step="0.01" placeholder="0.00" readOnly={isViewMode}
                      value={form.totalCost} onChange={e => set("totalCost", e.target.value)} />
                  </div>
                </Field>
              </div>
            </SectionCard>
          </div>

          {/* Feedback Status */}
          <SectionCard icon={<MessageSquare className="h-4 w-4 text-[#C9B45C]" />}
            title="Feedback" subtitle="Current approval status of this artwork">
            <Field label="Feedback Status">
              <div className="flex flex-wrap gap-2 mt-1">
                {FEEDBACK_STATUSES.map(s => (
                  <button key={s} type="button"
                    onClick={() => { if (!isViewMode) set("feedbackStatus", s); }}
                    disabled={isViewMode}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold ring-1 transition-all ${
                      form.feedbackStatus === s
                        ? `${FEEDBACK_COLORS[s]} ring-2`
                        : "bg-white text-gray-500 ring-gray-200 hover:ring-gray-400"
                    } ${isViewMode ? "opacity-70 cursor-default" : ""}`}>
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          </SectionCard>

          {/* Files & Images (2-col) */}
          <SectionCard icon={<Upload className="h-4 w-4 text-[#C9B45C]" />}
            title="Files & Images" subtitle="General reference files and images">
            {isViewMode ? (
              <div className="grid grid-cols-2 gap-6 text-xs text-gray-400">
                <div>
                  <p className="font-medium text-gray-600 mb-2">Reference Files ({form.files.length})</p>
                  {form.files.length === 0 ? <p className="italic">None</p> : form.files.map((f, i) => <p key={i} className="truncate">{f.name}</p>)}
                </div>
                <div>
                  <p className="font-medium text-gray-600 mb-2">Reference Images ({form.refImages.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.refImages.length === 0 ? <p className="italic text-gray-400">None</p> : form.refImages.map((img, i) => (
                      <img key={i} src={img.data} alt={img.name} title={img.name}
                        className="h-10 w-10 rounded-lg object-cover border border-gray-200 cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setLightbox({ images: form.refImages, index: i })} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <Field label="Reference Files">
                  <FileUploadZone
                    files={form.files} onChange={f => set("files", f)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                    icon={<FileText className="h-5 w-5" />}
                    label="Upload Files"
                  />
                </Field>
                <Field label="Reference Images">
                  <FileUploadZone
                    files={form.refImages} onChange={f => set("refImages", f)}
                    accept="image/*"
                    icon={<ImageIcon className="h-5 w-5" />}
                    label="Upload Images"
                    onImageClick={i => setLightbox({ images: form.refImages.filter(f => f.type.startsWith("image/")), index: i })}
                  />
                </Field>
              </div>
            )}
          </SectionCard>

          {/* WIP Images */}
          <SectionCard icon={<CheckCircle2 className="h-4 w-4 text-[#C9B45C]" />}
            title="WIP Images" subtitle="Work-in-progress photos for this artwork">
            {isViewMode ? (
              <div className="flex flex-wrap gap-2">
                {(form.wipImages ?? []).length === 0
                  ? <p className="text-xs text-gray-400 italic">No WIP images uploaded</p>
                  : form.wipImages.map((img, i) => (
                    <img key={i} src={img.data} alt={img.name} title={img.name}
                      className="h-16 w-16 rounded-xl object-cover border border-gray-200 cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setLightbox({ images: form.wipImages, index: i })} />
                  ))
                }
              </div>
            ) : (
              <FileUploadZone
                files={form.wipImages} onChange={f => set("wipImages", f)}
                accept="image/*"
                icon={<ImageIcon className="h-5 w-5" />}
                label="Upload WIP Images"
                onImageClick={i => setLightbox({ images: form.wipImages, index: i })}
              />
            )}
          </SectionCard>

          {/* Final Images */}
          <SectionCard icon={<CheckCircle2 className="h-4 w-4 text-[#C9B45C]" />}
            title="Final Images" subtitle="Completed artwork photos">
            <FileUploadZone
              files={form.finalImages} onChange={f => set("finalImages", f)}
              accept="image/*"
              icon={<ImageIcon className="h-5 w-5" />}
              label="Upload Final Images"
              onImageClick={i => setLightbox({ images: form.finalImages, index: i })}
            />
          </SectionCard>

          {/* Bottom Save */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setLocation(`/swatch-orders/${swatchOrderId}`)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button onClick={() => { void handleSave(); }} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : (isNew ? "Create Artwork" : "Save Changes")}
            </button>
          </div>
        </div>

        {/* Image Lightbox */}
        {lightbox && (
          <ImageLightbox
            images={lightbox.images}
            startIndex={lightbox.index}
            onClose={() => setLightbox(null)}
          />
        )}

        {/* Add Unit Type Modal */}
        {addUnitTypeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Add Unit Type</h3>
              <input
                autoFocus
                className={inputCls}
                placeholder="e.g. cm, inch, meter"
                value={newUnitTypeName}
                onChange={e => setNewUnitTypeName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { void handleAddUnitType(); } }}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setAddUnitTypeOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button onClick={() => { void handleAddUnitType(); }} disabled={!newUnitTypeName.trim() || createUnitType.isPending}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60">
                  {createUnitType.isPending ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
