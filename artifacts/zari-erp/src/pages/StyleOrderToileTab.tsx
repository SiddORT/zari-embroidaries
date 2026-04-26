import { useState, useRef } from "react";
import { Scissors, ChevronDown, ChevronUp, Save, Loader2, ImageIcon, Palette, X } from "lucide-react";
import AddableSelect from "@/components/ui/AddableSelect";
import {
  useStyleOrderArtworks,
  useUpdateStyleOrderArtwork,
  type FileAttachment,
  type StyleOrderArtworkRecord,
} from "@/hooks/useStyleOrderArtworks";
import { useAllVendors, type VendorRecord } from "@/hooks/useVendors";
import { useToast } from "@/hooks/use-toast";

const inputCls  = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400";
const selectCls = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 appearance-none";
const PAYMENT_MODES    = ["Cash", "Bank Transfer", "Cheque", "UPI", "Card", "Other"];
const PAYMENT_STATUSES = ["Pending", "Partial", "Paid"];

function fileToAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result as string, size: file.size });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FileUploadZone({
  files, onChange, accept, icon, label,
}: {
  files: FileAttachment[];
  onChange: (files: FileAttachment[]) => void;
  accept: string;
  icon: React.ReactNode;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const added = await Promise.all(Array.from(list).map(fileToAttachment));
    onChange([...files, ...added]);
  }
  return (
    <div className="space-y-2">
      <div onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">{icon}</div>
          <p className="text-xs font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">Click or drag & drop</p>
        </div>
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden"
          onChange={e => { void handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
              {f.type.startsWith("image/") ? (
                <img src={f.data} alt={f.name} className="h-10 w-10 rounded-lg object-cover border border-gray-200 shrink-0" />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{f.name}</p>
                <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

type ToileForm = {
  toileMakingCost: string;
  toileVendorId: string;
  toileVendorName: string;
  toilePaymentType: string;
  toilePaymentAmount: string;
  toilePaymentDate: string;
  toilePaymentMode: string;
  toilePaymentStatus: string;
  toileTransactionId: string;
  toileRemarks: string;
  toileImages: FileAttachment[];
};

function artworkToToileForm(a: StyleOrderArtworkRecord): ToileForm {
  return {
    toileMakingCost:   a.toileMakingCost ?? "",
    toileVendorId:     a.toileVendorId ?? "",
    toileVendorName:   a.toileVendorName ?? "",
    toilePaymentType:  a.toilePaymentType ?? "",
    toilePaymentAmount:a.toilePaymentAmount ?? "",
    toilePaymentDate:  a.toilePaymentDate ?? "",
    toilePaymentMode:  a.toilePaymentMode ?? "",
    toilePaymentStatus:a.toilePaymentStatus ?? "Pending",
    toileTransactionId:a.toileTransactionId ?? "",
    toileRemarks:      a.toileRemarks ?? "",
    toileImages:       (a.toileImages ?? []) as FileAttachment[],
  };
}

function ArtworkToileRow({
  artwork,
  vendors,
  vendorOptions,
}: {
  artwork: StyleOrderArtworkRecord;
  vendors: VendorRecord[];
  vendorOptions: { value: string; label: string }[];
}) {
  const { toast } = useToast();
  const updateArtwork = useUpdateStyleOrderArtwork();

  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<ToileForm>(() => artworkToToileForm(artwork));
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof ToileForm>(k: K, v: ToileForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateArtwork.mutateAsync({
        id: artwork.id,
        data: {
          toileMakingCost:   form.toileMakingCost || null,
          toileVendorId:     form.toileVendorId || null,
          toileVendorName:   form.toileVendorName || null,
          toilePaymentType:  form.toilePaymentType || null,
          toilePaymentAmount:form.toilePaymentAmount || null,
          toilePaymentDate:  form.toilePaymentDate || null,
          toilePaymentMode:  form.toilePaymentMode || null,
          toilePaymentStatus:form.toilePaymentStatus || null,
          toileTransactionId:form.toileTransactionId || null,
          toileRemarks:      form.toileRemarks || null,
          toileImages:       form.toileImages,
        },
      });
      toast({ title: "Toile details saved" });
    } catch {
      toast({ title: "Failed to save toile details", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const hasCost = !!artwork.toileMakingCost && parseFloat(artwork.toileMakingCost) > 0;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      {/* Row header */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="h-8 w-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
          <Palette className="h-4 w-4 text-[#C9B45C]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{artwork.artworkName}</p>
          <p className="text-xs text-gray-400">{artwork.artworkCode}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {hasCost && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
              ₹{parseFloat(artwork.toileMakingCost!).toLocaleString("en-IN")}
            </span>
          )}
          {artwork.toilePaymentStatus && (
            <span className={`text-xs rounded-full px-2 py-0.5 border ${
              artwork.toilePaymentStatus === "Paid"
                ? "bg-green-50 text-green-700 border-green-200"
                : artwork.toilePaymentStatus === "Partial"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-gray-50 text-gray-500 border-gray-200"
            }`}>
              {artwork.toilePaymentStatus}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Toile Making Cost">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                <input type="number" min="0" step="0.01" placeholder="0.00"
                  className={`${inputCls} pl-7`}
                  value={form.toileMakingCost}
                  onChange={e => setField("toileMakingCost", e.target.value)} />
              </div>
            </Field>
            <Field label="Vendor">
              <AddableSelect options={vendorOptions} value={form.toileVendorId}
                onChange={v => {
                  const vd = vendors.find(x => String(x.id) === v);
                  setField("toileVendorId", v ?? "");
                  setField("toileVendorName", vd?.brandName ?? "");
                }}
                placeholder="Select vendor…" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Payment Type">
              <select className={selectCls} value={form.toilePaymentType}
                onChange={e => setField("toilePaymentType", e.target.value)}>
                <option value="">Select type…</option>
                {["Advance", "Partial", "Full"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Payment Amount">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                <input type="number" min="0" step="0.01" placeholder="0.00"
                  className={`${inputCls} pl-7`}
                  value={form.toilePaymentAmount}
                  onChange={e => setField("toilePaymentAmount", e.target.value)} />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Payment Date">
              <input type="date" className={inputCls} value={form.toilePaymentDate}
                onChange={e => setField("toilePaymentDate", e.target.value)} />
            </Field>
            <Field label="Payment Mode">
              <select className={selectCls} value={form.toilePaymentMode}
                onChange={e => setField("toilePaymentMode", e.target.value)}>
                <option value="">Select mode…</option>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Transaction ID">
              <input type="text" placeholder="e.g. TXN123" className={inputCls}
                value={form.toileTransactionId}
                onChange={e => setField("toileTransactionId", e.target.value)} />
            </Field>
            <Field label="Remarks">
              <input type="text" placeholder="Payment remarks" className={inputCls}
                value={form.toileRemarks}
                onChange={e => setField("toileRemarks", e.target.value)} />
            </Field>
          </div>
          <Field label="Payment Status">
            <div className="flex gap-2 mt-1">
              {PAYMENT_STATUSES.map(s => (
                <button key={s} type="button"
                  onClick={() => setField("toilePaymentStatus", s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold ring-1 transition-all ${
                    form.toilePaymentStatus === s
                      ? s === "Paid" ? "bg-green-600 text-white ring-green-600"
                        : s === "Partial" ? "bg-amber-500 text-white ring-amber-500"
                        : "bg-red-500 text-white ring-red-500"
                      : "bg-white text-gray-500 ring-gray-200 hover:ring-gray-400"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Toile Making Images">
            <FileUploadZone
              files={form.toileImages}
              onChange={f => setField("toileImages", f)}
              accept="image/*"
              icon={<ImageIcon className="h-5 w-5" />}
              label="Upload Toile Images"
            />
          </Field>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shadow-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Toile Details"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StyleOrderToileTab({
  styleOrderId,
  isNew,
}: {
  styleOrderId: number | null;
  isNew: boolean;
}) {
  const { data: artworksData, isLoading } = useStyleOrderArtworks(styleOrderId);
  const { data: vendorData } = useAllVendors();

  const artworks = artworksData?.data ?? [];
  const vendors: VendorRecord[] = (vendorData as VendorRecord[] | undefined) ?? [];
  const vendorOptions = vendors.map(v => ({ value: String(v.id), label: v.brandName }));

  if (isNew) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
        <Scissors className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-500">Save the style order first to manage toile details.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gray-900">
          <Scissors className="h-4 w-4 text-[#C9B45C]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Toile</h2>
          <p className="text-xs text-gray-400">Toile making costs and payment details per artwork</p>
        </div>
      </div>
      <div className="px-6 py-5 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading artworks…
          </div>
        ) : artworks.length === 0 ? (
          <div className="text-xs text-gray-400 py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No artworks yet — add artworks in the Artworks tab first.
          </div>
        ) : (
          artworks.map(art => (
            <ArtworkToileRow
              key={art.id}
              artwork={art}
              vendors={vendors}
              vendorOptions={vendorOptions}
            />
          ))
        )}
      </div>
    </div>
  );
}
