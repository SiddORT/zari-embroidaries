import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Loader2, CheckCircle, XCircle, FileText, Upload, X, Paperclip, Plus, Trash2 } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { SmallSearchSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/hooks/use-toast";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { useFormAccessContext } from "@/contexts/FormAccessContext";
import { FormAccessGate } from "@/components/FormAccessGate";
import { useCurrency } from "@/contexts/CurrencyContext";
import { mediaUrl } from "@/utils/mediaUrl";

const G = "#C6AF4B";
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const CHALLAN_TYPES = [
  "Material", "Artwork", "Outsource",
  "Toile Artisan", "Pattern Artisan", "Custom Artisan",
  "Packing", "Shipping", "Other Expense",
];

const STATUS_BADGE: Record<string, string> = {
  "Draft":           "bg-gray-100 text-gray-600",
  "Verified":        "bg-blue-100 text-blue-700",
  "Converted to PO": "bg-violet-100 text-violet-700",
  "Converted to PR": "bg-indigo-100 text-indigo-700",
  "Billed":          "bg-amber-100 text-amber-700",
  "Paid":            "bg-green-100 text-green-700",
  "Cancelled":       "bg-red-100 text-red-600",
};

type Vendor     = { id: number; brandName: string };
type OrderHit   = { code: string; label: string; type: "SWATCH" | "STYLE" };
type Attachment = { url: string; originalName: string; mimeType?: string; size?: number };

interface LineItem {
  _id:         string;
  description: string;
  quantity:    string;
  unit:        string;
  rate:        string;
  amount:      string;
}

const card       = "bg-white rounded-2xl border border-gray-100 shadow-sm";
const sectionLbl = "text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3";
const inputCls   = "w-full px-2.5 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed";
const labelCls   = "text-sm font-medium text-gray-700 block mb-1";
const cellInput  = "w-full px-2 py-1.5 text-sm text-gray-900 border-0 focus:outline-none focus:ring-0 bg-transparent placeholder-gray-300";

function newLine(): LineItem {
  return { _id: crypto.randomUUID(), description: "", quantity: "", unit: "", rate: "", amount: "" };
}

function authHeaders() {
  const token = localStorage.getItem("zarierp_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function authToken(): Record<string, string> {
  const token = localStorage.getItem("zarierp_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts?.headers ?? {}) } });
}

const emptyForm = () => ({
  challanDate:      new Date().toISOString().slice(0, 10),
  vendorId:         "",
  challanType:      "",
  referenceOrderId: "",
  description:      "",
  remarks:          "",
});

// ── Order search autocomplete ─────────────────────────────────────────────────
function OrderSearchInput({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  const [query, setQuery]     = useState(value);
  const [results, setResults] = useState<OrderHit[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef          = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function search(q: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const h = authToken();
        const [sw, st] = await Promise.all([
          fetch(`${BASE}/api/swatch-orders?search=${encodeURIComponent(q)}&limit=8`, { headers: h }).then(r => r.json()),
          fetch(`${BASE}/api/style-orders?search=${encodeURIComponent(q)}&limit=8`,  { headers: h }).then(r => r.json()),
        ]);
        const hits: OrderHit[] = [
          ...(sw.data ?? []).map((o: any) => ({ code: o.orderCode, label: o.swatchName ?? o.orderCode, type: "SWATCH" as const })),
          ...(st.data ?? []).map((o: any) => ({ code: o.orderCode, label: o.styleName  ?? o.orderCode, type: "STYLE"  as const })),
        ];
        setResults(hits); setOpen(hits.length > 0);
      } catch { /* ignore */ }
      setLoading(false);
    }, 280);
  }

  function select(hit: OrderHit) {
    const display = `${hit.code} — ${hit.label}`;
    setQuery(display); onChange(display); setOpen(false); setResults([]);
  }
  function handleChange(v: string) { setQuery(v); onChange(v); search(v); }

  if (disabled) return <input value={query} readOnly className={inputCls} placeholder="e.g. ZSW-0001 or ZST-0001" />;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input value={query} onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          className={inputCls} placeholder="Type order code or name to search…" autoComplete="off" />
        {loading && <div className="absolute right-2.5 top-1/2 -translate-y-1/2"><Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /></div>}
        {!loading && query && (
          <button type="button" onClick={() => { setQuery(""); onChange(""); setResults([]); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={14} /></button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-[200] overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {results.map(hit => (
              <button key={hit.code} type="button" onClick={() => select(hit)}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2.5 border-b border-gray-50 last:border-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${hit.type === "SWATCH" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>{hit.type}</span>
                <span className="font-mono text-xs font-semibold text-gray-700">{hit.code}</span>
                <span className="text-xs text-gray-500 truncate">{hit.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Attachment section (multiple files, works before & after save) ────────────
function AttachmentSection({ challanId, attachments, pendingFiles, onPendingFiles, onUploaded, disabled }: {
  challanId: number | null;
  attachments: Attachment[];
  pendingFiles: File[];
  onPendingFiles: (f: File[]) => void;
  onUploaded: () => void;
  disabled: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; isImage: boolean; isPdf: boolean } | null>(null);
  const { toast } = useToast();

  async function handleFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;

    // Before the challan is saved, stage the files; otherwise upload immediately.
    if (!challanId) {
      onPendingFiles([...pendingFiles, ...files]);
      return;
    }
    setUploading(true);
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    const r = await fetch(`${BASE}/api/vendor-challans/${challanId}/document`, { method: "POST", headers: authToken(), body: fd });
    if (r.ok) { toast({ title: files.length > 1 ? `${files.length} documents uploaded` : "Document uploaded" }); onUploaded(); }
    else { const d = await r.json(); toast({ title: d.error ?? "Upload failed", variant: "destructive" }); }
    setUploading(false);
  }

  async function handleRemoveSaved(url: string) {
    if (!challanId || !confirm("Remove this document?")) return;
    setRemovingUrl(url);
    const r = await fetch(`${BASE}/api/vendor-challans/${challanId}/document?url=${encodeURIComponent(url)}`, { method: "DELETE", headers: authToken() });
    if (r.ok) { toast({ title: "Document removed" }); onUploaded(); }
    else toast({ title: "Failed to remove", variant: "destructive" });
    setRemovingUrl(null);
  }

  const meta = (name: string, mimeType?: string) => ({
    isImage: /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(name) || (mimeType ?? "").startsWith("image/"),
    isPdf: /\.pdf$/i.test(name) || (mimeType ?? "") === "application/pdf",
  });

  const hasFiles = attachments.length > 0 || pendingFiles.length > 0;
  if (disabled && !hasFiles) return <p className="text-xs text-gray-400">No documents attached.</p>;

  return (
    <div className="space-y-2">
      {/* Saved attachments */}
      {attachments.map((att) => {
        const fileUrl = mediaUrl(att.url);
        const name = att.originalName ?? "";
        const size = att.size ? ` (${(att.size / 1024).toFixed(1)} KB)` : "";
        const { isImage, isPdf } = meta(name, att.mimeType);
        return (
          <div key={att.url} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            {isImage ? (
              <button type="button" onClick={() => setPreview({ url: fileUrl, name, isImage, isPdf })} className="shrink-0">
                <img src={fileUrl} alt={name}
                  className="h-12 w-12 rounded-lg object-cover border border-gray-200 hover:ring-2 hover:ring-[#C9B45C] transition-all" />
              </button>
            ) : (
              <Paperclip className="h-4 w-4 text-gray-400 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => (isImage || isPdf) ? setPreview({ url: fileUrl, name, isImage, isPdf }) : window.open(fileUrl, "_blank")}
                className="text-sm font-medium text-blue-600 hover:underline truncate block text-left">{name}</button>
              <p className="text-xs text-gray-400">{size}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {(isImage || isPdf) && (
                <button type="button" onClick={() => setPreview({ url: fileUrl, name, isImage, isPdf })}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">Preview</button>
              )}
              {!disabled && (
                <button type="button" onClick={() => handleRemoveSaved(att.url)} disabled={removingUrl === att.url}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                  {removingUrl === att.url ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Pending (not yet saved) files */}
      {/* {pendingFiles.map((file, i) => (
        <div key={`${file.name}-${i}`} className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <Paperclip className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-amber-600">Will be uploaded when challan is saved</p>
          </div>
          {!disabled && (
            <button type="button" onClick={() => onPendingFiles(pendingFiles.filter((_, idx) => idx !== i))}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors shrink-0">Remove</button>
          )}
        </div>
      ))} */}

      {pendingFiles.map((file, i) => {
        const { isImage, isPdf } = meta(file.name, file.type);

        return (
          <div
            key={`${file.name}-${i}`}
            className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200"
          >
            {isImage ? ( 
              <img src={URL.createObjectURL(file)} alt={file.name} className="h-12 w-12 rounded-lg object-cover border"/>
            ) : (
              <Paperclip className="h-4 w-4 text-amber-500 shrink-0" />
            )}

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">
                {file.name}
              </p>
              <p className="text-xs text-amber-600">
                Will be uploaded when challan is saved
              </p>
            </div>

            {(isImage || isPdf) && (
              <button
                type="button"
                onClick={() =>
                  setPreview({
                    url: URL.createObjectURL(file),
                    name: file.name,
                    isImage,
                    isPdf,
                  })
                }
                className="text-black text-xs px-2.5 py-1.5 rounded-lg border"
              >
                Preview
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onPendingFiles(
                  pendingFiles.filter((_, idx) => idx !== i)
                )
              }
              className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-600"
            >
              Remove
            </button>
          </div>
        );
      })}


      {/* Add files */}
      {!disabled && (
        <div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : hasFiles ? "Add More Documents" : "Attach Documents"}
          </button>
          <p className="text-xs text-gray-400 mt-1.5">PDF, JPG, PNG or WebP · max 20 MB each · multiple allowed</p>
          <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFilesChosen} />
        </div>
      )}

      {/* Shared preview modal */}
      {preview && (preview.isImage || preview.isPdf) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{preview.name}</h3>
              <div className="flex items-center gap-2">
                <a href={preview.url} target="_blank" rel="noreferrer"
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">Open in new tab</a>
                <button type="button" onClick={() => setPreview(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-gray-50">
              {preview.isImage ? (
                <img src={preview.url} alt={preview.name} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
              ) : (
                <iframe src={preview.url} title={preview.name} className="w-full h-[75vh] rounded-lg border border-gray-200" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Line items table ──────────────────────────────────────────────────────────
function LineItemsTable({ items, onChange, disabled }: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  disabled: boolean;
}) {
  const { fmt } = useCurrency();
  function updateItem(id: string, field: keyof LineItem, value: string) {
    // Block negative quantities/rates outright.
    if ((field === "quantity" || field === "rate") && value !== "" && parseFloat(value) < 0) {
      value = "";
    }
    onChange(items.map(item => {
      if (item._id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "rate") {
        const qty  = parseFloat(field === "quantity" ? value : item.quantity);
        const rate = parseFloat(field === "rate"     ? value : item.rate);
        if (!isNaN(qty) && !isNaN(rate)) updated.amount = (qty * rate).toFixed(2);
        else updated.amount = "";
      }
      return updated;
    }));
  }

  function removeItem(id: string) { onChange(items.filter(i => i._id !== id)); }

  const total = items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

  const colBase = "border-r border-gray-100 last:border-r-0";

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className={`${colBase} text-left px-3 py-2.5 text-xs font-semibold text-gray-500 w-8`}>#</th>
            <th className={`${colBase} text-left px-3 py-2.5 text-xs font-semibold text-gray-500`}>Description / Details</th>
            <th className={`${colBase} text-right px-3 py-2.5 text-xs font-semibold text-gray-500 w-24`}>Quantity</th>
            <th className={`${colBase} text-left px-3 py-2.5 text-xs font-semibold text-gray-500 w-20`}>Unit</th>
            <th className={`${colBase} text-right px-3 py-2.5 text-xs font-semibold text-gray-500 w-28`}>Rate</th>
            <th className={`${colBase} text-right px-3 py-2.5 text-xs font-semibold text-gray-500 w-28`}>Amount</th>
            {!disabled && <th className="w-10 px-2 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item._id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
              <td className={`${colBase} px-3 py-1.5 text-xs text-gray-400 text-center`}>{idx + 1}</td>
              <td className={`${colBase} px-1 py-1`}>
                <input value={item.description} onChange={e => updateItem(item._id, "description", e.target.value)}
                  disabled={disabled} placeholder="Item description…"
                  className={cellInput + (disabled ? " opacity-50 cursor-not-allowed" : "")} />
              </td>
              <td className={`${colBase} px-1 py-1`}>
                <input type="number" min="0" step="0.001" value={item.quantity}
                  onChange={e => updateItem(item._id, "quantity", e.target.value)}
                  disabled={disabled} placeholder="0.000"
                  className={`${cellInput} text-right` + (disabled ? " opacity-50 cursor-not-allowed" : "")} />
              </td>
              <td className={`${colBase} px-1 py-1`}>
                <input value={item.unit} onChange={e => updateItem(item._id, "unit", e.target.value)}
                  disabled={disabled} placeholder="pcs"
                  className={cellInput + (disabled ? " opacity-50 cursor-not-allowed" : "")} />
              </td>
              <td className={`${colBase} px-1 py-1`}>
                <input type="number" min="0" step="0.01" value={item.rate}
                  onChange={e => updateItem(item._id, "rate", e.target.value)}
                  disabled={disabled} placeholder="0.00"
                  className={`${cellInput} text-right` + (disabled ? " opacity-50 cursor-not-allowed" : "")} />
              </td>
              <td className={`${colBase} px-3 py-1.5 text-sm text-right font-medium text-gray-700`}>
                {item.amount ? `${fmt(parseFloat(item.amount))}` : "—"}
              </td>
              {!disabled && (
                <td className="px-2 py-1 text-center">
                  <button type="button" onClick={() => removeItem(item._id)}
                    className="p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td colSpan={disabled ? 6 : 7} className="px-4 py-6 text-center text-sm text-gray-400">
                {disabled ? "No line items recorded." : `No items yet — click "Add Row" to begin.`}
              </td>
            </tr>
          )}

          {/* Total row */}
          {items.length > 0 && (
            <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
              <td colSpan={disabled ? 5 : 5} className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-right uppercase tracking-wider">
                Total
              </td>
              <td className="px-3 py-2.5 text-sm text-right font-bold text-gray-900">
                {fmt(total)}
              </td>
              {!disabled && <td />}
            </tr>
          )}
        </tbody>
      </table>

      {!disabled && (
        <div className="px-3 py-2.5 border-t border-gray-100">
          <button type="button" onClick={() => onChange([...items, newLine()])}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <Plus size={15} className="text-gray-400" />
            Add Row
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VendorChallanDetail() {
  const { fmt, currency: dc } = useCurrency();
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const isNew = !params.id || params.id === "new";
  const numId = isNew ? null : parseInt(params.id, 10);

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

  const { can } = useMyPermissions();
  const { canEdit: canEditPerm } = useFormAccessContext();

  const [form, setForm]                     = useState(emptyForm());
  const [lineItems, setLineItems]           = useState<LineItem[]>([newLine()]);
  const [status, setStatus]                 = useState("Draft");
  const [challanNumber, setChallanNumber]   = useState<string | null>(null);
  const [linkedPoNumber, setLinkedPoNumber] = useState<string | null>(null);
  const [linkedPrNumber, setLinkedPrNumber] = useState<string | null>(null);
  const [attachments, setAttachments]       = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles]     = useState<File[]>([]);
  const [vendors, setVendors]               = useState<Vendor[]>([]);
  const [loading, setLoading]               = useState(!isNew);
  const [saving,  setSaving]                = useState(false);
  const [error,   setError]                 = useState("");
  const [actionLoading, setActionLoading]   = useState<"verify" | "cancel" | null>(null);
  const [cancelOpen, setCancelOpen]         = useState(false);

  function set(k: keyof ReturnType<typeof emptyForm>, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const totalAmount = lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const fetchVendors = useCallback(async () => {
    const r = await apiFetch("/api/vendors/all");
    if (r.ok) { const d = await r.json(); setVendors(d); }
  }, []);

  const fetchChallan = useCallback(async () => {
    if (!numId) return;
    setLoading(true);
    const r = await apiFetch(`/api/vendor-challans/${numId}`);
    if (r.ok) {
      const { data: c } = await r.json();
      setForm({
        challanDate:      c.challan_date        ?? "",
        vendorId:         c.vendor_id ? String(c.vendor_id) : "",
        challanType:      c.challan_type        ?? "",
        referenceOrderId: c.reference_order_id  ?? "",
        description:      c.description         ?? "",
        remarks:          c.remarks             ?? "",
      });
      if (c.line_items && Array.isArray(c.line_items) && c.line_items.length > 0) {
        setLineItems(c.line_items.map((li: any) => ({ ...li, _id: li._id ?? crypto.randomUUID() })));
      } else {
        setLineItems([newLine()]);
      }
      setStatus(c.status ?? "Draft");
      setChallanNumber(c.challan_number ?? null);
      setLinkedPoNumber(c.linked_po_number ?? null);
      setLinkedPrNumber(c.linked_pr_number ?? null);
      const list: Attachment[] = Array.isArray(c.attachments) ? c.attachments : [];
      if (c.attachment?.url && !list.some((a: Attachment) => a.url === c.attachment.url)) {
        setAttachments([c.attachment, ...list]);
      } else {
        setAttachments(list);
      }
    }
    setLoading(false);
  }, [numId]);

  useEffect(() => { void fetchVendors(); }, [fetchVendors]);
  useEffect(() => { void fetchChallan(); }, [fetchChallan]);

  const canEdit = (isNew || status === "Draft") && canEditPerm;

  async function handleSave() {
    setError("");
    if (!form.vendorId)    { setError("Vendor is required");       return; }
    if (!form.challanDate) { setError("Challan date is required"); return; }
    if (!form.challanType) { setError("Challan type is required"); return; }

    // Items & Pricing validation — at least one valid line item is required.
    const cleanItems = lineItems.filter(i => i.description.trim() || i.quantity || i.rate);
    if (cleanItems.length === 0) {
      setError("Add at least one line item with a description, quantity and rate");
      return;
    }
    for (const i of cleanItems) {
      const desc = i.description.trim();
      const qty  = parseFloat(i.quantity);
      const rate = parseFloat(i.rate);
      if (!desc) { setError("Each line item must have a description"); return; }
      if (!/[A-Za-z0-9]/.test(desc)) {
        setError(`Line item description "${desc}" must contain letters or numbers`); return;
      }
      if (isNaN(qty) || qty <= 0) {
        setError(`Quantity must be greater than zero for "${desc}"`); return;
      }
      if (isNaN(rate) || rate <= 0) {
        setError(`Rate must be greater than zero for "${desc}"`); return;
      }
    }

    setSaving(true);
    const vendorObj = vendors.find(v => String(v.id) === form.vendorId);
    const body = {
      challanDate:      form.challanDate,
      vendorId:         parseInt(form.vendorId, 10),
      vendorName:       vendorObj?.brandName ?? "",
      challanType:      form.challanType,
      referenceOrderId: form.referenceOrderId || undefined,
      description:      form.description      || undefined,
      remarks:          form.remarks          || undefined,
      lineItems:        cleanItems.map(i => ({
        description: i.description.trim(),
        quantity:    i.quantity,
        unit:        i.unit,
        rate:        i.rate,
        amount:      i.amount,
      })),
    };

    let r: Response;
    if (isNew) {
      // Send as multipart so any staged attachments are saved as part of
      // creation — before the admin auto-verify status would otherwise lock
      // out a follow-up document upload via the "Draft only" endpoint.
      const fd = new FormData();
      fd.append("challanDate", body.challanDate);
      fd.append("vendorId", String(body.vendorId));
      fd.append("vendorName", body.vendorName);
      fd.append("challanType", body.challanType);
      if (body.referenceOrderId) fd.append("referenceOrderId", body.referenceOrderId);
      if (body.description)      fd.append("description", body.description);
      if (body.remarks)          fd.append("remarks", body.remarks);
      fd.append("lineItems", JSON.stringify(body.lineItems));
      for (const f of pendingFiles) fd.append("files", f);
      r = await fetch(`${BASE}/api/vendor-challans`, { method: "POST", headers: authToken(), body: fd });
    } else {
      r = await apiFetch(`/api/vendor-challans/${numId}`, { method: "PUT", body: JSON.stringify(body) });
    }

    const d = await r.json();
    if (r.ok) {
      const newId: number = d.data.id;
      if (isNew) setPendingFiles([]);
      toast({ title: isNew ? "Vendor challan created" : "Vendor challan saved" });
      if (isNew) setLocation(`/procurement/vendor-challans/${newId}`);
      else void fetchChallan();
    } else {
      setError(d.error ?? "Failed to save");
    }
    setSaving(false);
  }

  async function handleVerify() {
    setActionLoading("verify");
    const r = await apiFetch(`/api/vendor-challans/${numId}/verify`, { method: "PATCH" });
    const d = await r.json();
    if (r.ok) { toast({ title: "Challan verified" }); void fetchChallan(); }
    else setError(d.error ?? "Failed to verify");
    setActionLoading(null);
  }

  async function confirmCancel() {
    setActionLoading("cancel");
    const r = await apiFetch(`/api/vendor-challans/${numId}/cancel`, { method: "PATCH" });
    const d = await r.json();
    if (r.ok) { toast({ title: "Challan cancelled" }); void fetchChallan(); }
    else setError(d.error ?? "Failed to cancel");
    setActionLoading(null);
    setCancelOpen(false);
  }

  if (!user) return null;
  if (!isNew && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F6F0" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: G }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
      <TopNavbar
        username={(user as any)?.name ?? (user as any)?.username ?? ""}
        role={(user as any)?.role ?? ""}
        onLogout={handleLogout}
        isLoggingOut={logoutMutation.isPending}
      />

      <div className="py-6 px-6 max-w-screen-xl mx-auto space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setLocation("/procurement/vendor-challans")}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" /> Vendor Challans
            </button>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {isNew ? "New Challan" : (challanNumber ?? `Challan #${numId}`)}
            </h1>
            {!isNew && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[status] ?? "bg-gray-100 text-gray-600"}`}>
                {status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isNew && status === "Draft" && can("procurement:vendor_challans:verify") && (
              <button onClick={handleVerify} disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-40"
                style={{ borderColor: "#C6AF4B", color: "#a8922e", background: "#fdf8ee" }}>
                {actionLoading === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Verify
              </button>
            )}
            {!isNew && !["Converted to PO","Converted to PR","Billed","Paid","Cancelled"].includes(status) && (
              <button onClick={() => setCancelOpen(true)} disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors disabled:opacity-40">
                {actionLoading === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Cancel Challan
              </button>
            )}
            {canEdit && (
              <button onClick={() => void handleSave()} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: `linear-gradient(135deg, ${G}, #a8922e)` }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : isNew ? "Create Challan" : "Save Changes"}
              </button>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

        {/* Linked PO / PR */}
        {(linkedPoNumber || linkedPrNumber) && (
          <div className={`${card} px-5 py-3 flex items-center gap-6 text-sm`}>
            <FileText className="h-4 w-4 text-gray-400 shrink-0" />
            {linkedPoNumber && <div className="flex items-center gap-2"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Linked PO</span><span className="font-mono font-bold text-violet-700">{linkedPoNumber}</span></div>}
            {linkedPrNumber && <div className="flex items-center gap-2"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Linked PR</span><span className="font-mono font-bold text-indigo-700">{linkedPrNumber}</span></div>}
          </div>
        )}

        <FormAccessGate readOnly={!canEdit}>
          {/* ── Challan Details ──────────────────────────────────────────────── */}
          <div className={`${card} p-5`}>
            <p className={sectionLbl}>Challan Details</p>
            <div className="grid grid-cols-2 gap-4">

              <div>
                <label className={labelCls}>Challan Date <span className="text-red-500">*</span></label>
                <input type="date" className={inputCls} value={form.challanDate}
                  onChange={e => set("challanDate", e.target.value)} disabled={!canEdit} />
              </div>

              <div>
                <label className={labelCls}>Vendor <span className="text-red-500">*</span></label>
                <SmallSearchSelect
                  value={form.vendorId}
                  onChange={v => set("vendorId", v)}
                  options={vendors.map(v => ({ value: String(v.id), label: v.brandName }))}
                  placeholder="— Search vendor —"
                  disabled={!canEdit}
                />
              </div>

              <div>
                <label className={labelCls}>Challan Type <span className="text-red-500">*</span></label>
                <select value={form.challanType} onChange={e => set("challanType", e.target.value)}
                  disabled={!canEdit} className={inputCls}>
                  <option value="">— Select type —</option>
                  {CHALLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  Reference Order <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <OrderSearchInput value={form.referenceOrderId} onChange={v => set("referenceOrderId", v)} disabled={!canEdit} />
              </div>

              <div className="col-span-2">
                <label className={labelCls}>Description</label>
                <textarea rows={2} className={`${inputCls} resize-none`}
                  placeholder="Overall description of this challan…"
                  value={form.description} onChange={e => set("description", e.target.value)}
                  disabled={!canEdit} />
              </div>

            </div>
          </div>

          {/* ── Line Items ───────────────────────────────────────────────────── */}
          <div className={`${card} p-5`}>
            <div className="flex items-baseline justify-between mb-3">
              <p className={sectionLbl} style={{ marginBottom: 0 }}>Items &amp; Pricing</p>
              <p className="text-xs text-gray-400">Amount auto-calculated from Qty × Rate</p>
            </div>
            <LineItemsTable items={lineItems} onChange={setLineItems} disabled={!canEdit} />
          </div>

          {/* ── Attachment ───────────────────────────────────────────────────── */}
          <div className={`${card} p-5`}>
            <p className={sectionLbl}>Attachments</p>
            <AttachmentSection
              challanId={numId}
              attachments={attachments}
              pendingFiles={pendingFiles}
              onPendingFiles={setPendingFiles}
              onUploaded={fetchChallan}
              disabled={!canEdit}
            />
          </div>

          {/* ── Remarks ──────────────────────────────────────────────────────── */}
          <div className={`${card} p-5`}>
            <p className={sectionLbl}>Remarks</p>
            <textarea rows={3} className={`${inputCls} resize-none`}
              placeholder="Any internal notes or remarks…"
              value={form.remarks} onChange={e => set("remarks", e.target.value)} disabled={!canEdit} />
          </div>
        </FormAccessGate>

        {/* ── Bottom action bar ────────────────────────────────────────────── */}
        {canEdit && (
          <div className="flex justify-end gap-3 pb-8">
            <button onClick={() => setLocation("/procurement/vendor-challans")}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button onClick={() => void handleSave()} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all shadow-sm"
              style={{ background: `linear-gradient(135deg, ${G}, #a8922e)` }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : isNew ? "Create Challan" : "Save Changes"}
            </button>
          </div>
        )}

      </div>

      {/* Cancel challan confirmation */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Cancel Challan</h3>
            </div>
            <div className="px-6 py-5 text-sm text-gray-600">
              Are you sure you want to cancel this challan? This action cannot be undone.
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setCancelOpen(false)} disabled={actionLoading === "cancel"}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40">
                Keep Challan
              </button>
              <button onClick={() => void confirmCancel()} disabled={actionLoading === "cancel"}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-40">
                {actionLoading === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                {actionLoading === "cancel" ? "Cancelling…" : "Cancel Challan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
