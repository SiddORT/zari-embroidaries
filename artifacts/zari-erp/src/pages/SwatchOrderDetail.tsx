import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, Plus, Trash2, Info, Upload, X, FileText, Image as ImageIcon,
  User, Layers, Scissors, CalendarDays, MessageSquare, Paperclip, CheckCircle2,
  ChevronDown, Loader2, Palette, ExternalLink, Pencil,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useSwatchOrder, useCreateSwatchOrder, useUpdateSwatchOrder, type ReferenceItem, type FileAttachment } from "@/hooks/useSwatchOrders";
import { useArtworkList, useDeleteArtwork, useUpdateArtwork, type ArtworkRecord, type FileAttachment as ArtFileAttachment } from "@/hooks/useArtworks";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";
import { useAllFabrics, type FabricRecord } from "@/hooks/useFabrics";
import { useUnitTypes, useCreateUnitType, type LookupRecord } from "@/hooks/useLookups";
import AddableSelect from "@/components/ui/AddableSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { useStyleList, type StyleRecord } from "@/hooks/useStyles";
import { useSwatchList, type SwatchRecord } from "@/hooks/useSwatches";

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const ORDER_STATUSES = ["Draft", "Issued", "In Sampling", "In Artwork", "Pending Approval", "Completed", "Rejected", "Cancelled"];
const DEPARTMENTS = ["Design", "Production", "Sampling", "Artwork", "Quality", "Finishing"];

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-gray-900 text-[#C9B45C] ring-gray-900",
  Medium: "bg-gray-900 text-[#C9B45C] ring-gray-900",
  High: "bg-gray-900 text-[#C9B45C] ring-gray-900",
  Urgent: "bg-gray-900 text-[#C9B45C] ring-gray-900",
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "text-gray-600 bg-gray-50 border-gray-200",
  Issued: "text-blue-700 bg-blue-50 border-blue-200",
  "In Sampling": "text-amber-700 bg-amber-50 border-amber-200",
  "In Artwork": "text-purple-700 bg-purple-50 border-purple-200",
  "Pending Approval": "text-orange-700 bg-orange-50 border-orange-200",
  Completed: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Rejected: "text-red-700 bg-red-50 border-red-200",
  Cancelled: "text-gray-500 bg-gray-50 border-gray-200",
};

const STANDARD_ESTIMATE_ITEMS = [
  "Sampling", "Artwork", "Material", "Embroidery",
  "Fabric", "QC", "Travel", "Overheads",
];

interface EstimateItem {
  id: string;
  label: string;
  rate: string;
  isCustom?: boolean;
}

function makeDefaultEstimate(): EstimateItem[] {
  return STANDARD_ESTIMATE_ITEMS.map(label => ({ id: label.toLowerCase(), label, rate: "", isCustom: false }));
}

const TABS = [
  { label: "Basic Info",   icon: "🗂" },
  { label: "References",   icon: "🔗" },
  { label: "Artworks",     icon: "🎨" },
  { label: "Estimate",     icon: "📊" },
  { label: "Revisions",    icon: "🔄" },
  { label: "Costing",      icon: "💰" },
  { label: "Client Link",  icon: "🔗" },
  { label: "Invoice",      icon: "🧾" },
];

type FormState = {
  swatchName: string;
  clientId: string;
  clientName: string;
  isChargeable: boolean;
  quantity: string;
  priority: string;
  orderStatus: string;
  styleReferences: ReferenceItem[];
  swatchReferences: ReferenceItem[];
  fabricId: string;
  fabricName: string;
  hasLining: boolean;
  liningFabricId: string;
  liningFabricName: string;
  unitLength: string;
  unitWidth: string;
  unitType: string;
  orderIssueDate: string;
  deliveryDate: string;
  targetHours: string;
  issuedTo: string;
  department: string;
  description: string;
  internalNotes: string;
  clientInstructions: string;
  refDocs: FileAttachment[];
  refImages: FileAttachment[];
  actualStartDate: string;
  actualStartTime: string;
  tentativeDeliveryDate: string;
  actualCompletionDate: string;
  actualCompletionTime: string;
  delayReason: string;
  approvalDate: string;
  revisionCount: number;
  estimate: EstimateItem[];
};

const EMPTY_FORM: FormState = {
  swatchName: "", clientId: "", clientName: "", isChargeable: false,
  quantity: "", priority: "Medium", orderStatus: "Draft",
  styleReferences: [], swatchReferences: [],
  fabricId: "", fabricName: "", hasLining: false, liningFabricId: "", liningFabricName: "",
  unitLength: "", unitWidth: "", unitType: "",
  orderIssueDate: "", deliveryDate: "", targetHours: "", issuedTo: "", department: "",
  description: "", internalNotes: "", clientInstructions: "",
  refDocs: [], refImages: [],
  actualStartDate: "", actualStartTime: "", tentativeDeliveryDate: "",
  actualCompletionDate: "", actualCompletionTime: "", delayReason: "",
  approvalDate: "", revisionCount: 0,
  estimate: makeDefaultEstimate(),
};

function SectionCard({ icon, title, subtitle, accentColor, children }: {
  icon: React.ReactNode; title: string; subtitle: string; accentColor: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className={`flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50`}>
        <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${accentColor}`}>
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
const selectCls = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 appearance-none cursor-pointer";

function fileToAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result as string, size: file.size });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FileUploadZone({ files, onChange, accept, icon, label }: {
  files: FileAttachment[];
  onChange: (files: FileAttachment[]) => void;
  accept: string;
  icon: React.ReactNode;
  label: string;
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
                <img
                  src={f.data}
                  alt={f.name}
                  className="h-14 w-14 rounded-lg object-cover border border-gray-200 shrink-0"
                />
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

export default function SwatchOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const numId = isNew ? null : parseInt(id ?? "0");

  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();

  const { data: orderData, isLoading: loadingOrder } = useSwatchOrder(numId);
  const createOrder = useCreateSwatchOrder();
  const updateOrder = useUpdateSwatchOrder();
  const { data: artworksData } = useArtworkList(numId);

  const { data: clientsData } = useAllClients();
  const { data: fabricsData } = useAllFabrics();
  const { data: unitTypesData } = useUnitTypes();
  const { data: stylesData } = useStyleList({ search: "", status: "active", client: "", location: "", page: 1, limit: 200 });
  const { data: swatchesData } = useSwatchList({ search: "", status: "active", client: "", location: "", swatchCategory: "", page: 1, limit: 200 });

  const createUnitType = useCreateUnitType();

  const clients: ClientRecord[] = clientsData ?? [];
  const fabrics: FabricRecord[] = fabricsData ?? [];
  const unitTypes: LookupRecord[] = unitTypesData ?? [];
  const styles: StyleRecord[] = stylesData?.data ?? [];
  const swatches: SwatchRecord[] = swatchesData?.data ?? [];

  const unitTypeOptions = unitTypes.filter(t => t.isActive).map(t => ({ value: t.name, label: t.name }));
  const clientOptions = clients.map(c => ({ value: String(c.id), label: c.brandName }));
  const fabricOptions = fabrics.map(f => ({ value: String(f.id), label: `${f.fabricCode} — ${f.fabricType} ${f.quality}` }));
  const styleOptions = styles.map(s => ({ value: String(s.id), label: `${s.styleNo} – ${s.client}` }));
  const swatchOptions = swatches.map(s => ({ value: String(s.id), label: `${s.swatchCode} – ${s.swatchName}` }));

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const t = parseInt(params.get("tab") ?? "0", 10);
    return !isNaN(t) && t >= 0 && t < TABS.length ? t : 0;
  });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [addUnitTypeOpen, setAddUnitTypeOpen] = useState(false);
  const [newUnitTypeName, setNewUnitTypeName] = useState("");
  const [unitTypeError, setUnitTypeError] = useState("");

  const [artworkToDelete, setArtworkToDelete] = useState<number | null>(null);
  const [imgUploadTarget, setImgUploadTarget] = useState<{ artId: number; type: "wip" | "final" } | null>(null);
  const artImgInputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<{ images: ArtFileAttachment[]; index: number } | null>(null);

  const deleteArtwork = useDeleteArtwork();
  const updateArtwork = useUpdateArtwork();

  useEffect(() => {
    if (orderData?.data) {
      const o = orderData.data;
      setForm({
        swatchName: o.swatchName ?? "", clientId: o.clientId ?? "", clientName: o.clientName ?? "",
        isChargeable: o.isChargeable, quantity: o.quantity ?? "", priority: o.priority,
        orderStatus: o.orderStatus, styleReferences: o.styleReferences ?? [], swatchReferences: o.swatchReferences ?? [],
        fabricId: o.fabricId ?? "", fabricName: o.fabricName ?? "", hasLining: o.hasLining,
        liningFabricId: o.liningFabricId ?? "", liningFabricName: o.liningFabricName ?? "",
        unitLength: o.unitLength ?? "", unitWidth: o.unitWidth ?? "", unitType: o.unitType ?? "",
        orderIssueDate: o.orderIssueDate ?? "", deliveryDate: o.deliveryDate ?? "",
        targetHours: o.targetHours ?? "", issuedTo: o.issuedTo ?? "", department: o.department ?? "",
        description: o.description ?? "", internalNotes: o.internalNotes ?? "",
        clientInstructions: o.clientInstructions ?? "", refDocs: o.refDocs ?? [], refImages: o.refImages ?? [],
        actualStartDate: o.actualStartDate ?? "", actualStartTime: o.actualStartTime ?? "",
        tentativeDeliveryDate: o.tentativeDeliveryDate ?? "",
        actualCompletionDate: o.actualCompletionDate ?? "", actualCompletionTime: o.actualCompletionTime ?? "",
        delayReason: o.delayReason ?? "", approvalDate: o.approvalDate ?? "",
        revisionCount: o.revisionCount ?? 0,
        estimate: (() => {
          const saved = (o.estimate ?? []) as EstimateItem[];
          const defaults = makeDefaultEstimate();
          // Merge: keep saved rates for standard items, preserve order, append custom items
          const merged = defaults.map(def => {
            const found = saved.find(s => s.id === def.id && !s.isCustom);
            return found ? { ...def, rate: found.rate ?? "" } : def;
          });
          const custom = saved.filter(s => s.isCustom);
          return [...merged, ...custom];
        })(),
      });
    }
  }, [orderData]);

  useEffect(() => {
    if (form.clientId) {
      const c = clients.find(c => String(c.id) === form.clientId);
      setSelectedClient(c ?? null);
    } else {
      setSelectedClient(null);
    }
  }, [form.clientId, clients]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addStyleRef() {
    set("styleReferences", [...form.styleReferences, { id: "", label: "", remark: "" }]);
  }
  function addSwatchRef() {
    set("swatchReferences", [...form.swatchReferences, { id: "", label: "", remark: "" }]);
  }
  function updateRef(type: "style" | "swatch", idx: number, field: keyof ReferenceItem, value: string) {
    const key = type === "style" ? "styleReferences" : "swatchReferences";
    const arr = [...form[key]];
    arr[idx] = { ...arr[idx], [field]: value };
    set(key, arr);
  }
  function removeRef(type: "style" | "swatch", idx: number) {
    const key = type === "style" ? "styleReferences" : "swatchReferences";
    set(key, form[key].filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!form.swatchName.trim()) {
      toast({ title: "Swatch Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await createOrder.mutateAsync(form);
        toast({ title: "Swatch order created", description: res.data.orderCode });
        setLocation(`/swatch-orders/${res.data.id}`);
      } else if (numId) {
        await updateOrder.mutateAsync({ id: numId, data: form });
        toast({ title: "Changes saved" });
      }
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleAddUnitType() {
    const trimmed = newUnitTypeName.trim();
    if (!trimmed) return;
    const alreadyExists = unitTypes.some(t => t.name.toLowerCase() === trimmed.toLowerCase());
    if (alreadyExists) {
      setUnitTypeError(`"${trimmed}" already exists — select it from the dropdown`);
      return;
    }
    setUnitTypeError("");
    createUnitType.mutate({ name: trimmed }, {
      onSuccess: () => {
        set("unitType", trimmed);
        setAddUnitTypeOpen(false);
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "";
        if (msg.toLowerCase().includes("conflict") || msg.toLowerCase().includes("already exists") || msg.includes("409")) {
          setUnitTypeError(`"${trimmed}" already exists — select it from the dropdown`);
        } else {
          setUnitTypeError("Failed to add unit type. Please try again.");
        }
      },
    });
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("zarierp_token");
        qc.removeQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
      },
    });
  }

  function handleArtworkImageFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!imgUploadTarget || !e.target.files) return;
    const { artId, type } = imgUploadTarget;
    const art = (artworksData?.data ?? []).find((a: ArtworkRecord) => a.id === artId);
    if (!art) return;
    const files = Array.from(e.target.files);
    const readers = files.map(file =>
      new Promise<ArtFileAttachment>(resolve => {
        const reader = new FileReader();
        reader.onload = ev => resolve({
          name: file.name, type: file.type,
          data: ev.target!.result as string,
          size: file.size,
        });
        reader.readAsDataURL(file);
      })
    );
    Promise.all(readers).then(newFiles => {
      const existing = type === "wip" ? (art.wipImages ?? []) : (art.finalImages ?? []);
      const merged = [...existing, ...newFiles];
      updateArtwork.mutate({
        id: artId,
        data: {
          swatchOrderId: art.swatchOrderId,
          artworkName: art.artworkName,
          artworkCreated: art.artworkCreated,
          feedbackStatus: art.feedbackStatus,
          wipImages: type === "wip" ? merged : (art.wipImages ?? []),
          finalImages: type === "final" ? merged : (art.finalImages ?? []),
          files: art.files ?? [],
          refImages: art.refImages ?? [],
        },
      });
    });
    e.target.value = "";
    setImgUploadTarget(null);
  }

  function handleDeleteArtworkConfirm() {
    if (artworkToDelete === null) return;
    deleteArtwork.mutate(artworkToDelete, {
      onSuccess: () => setArtworkToDelete(null),
    });
  }

  if (loadingUser) return null;
  if (!user) { setLocation("/login"); return null; }
  if (!isNew && loadingOrder) return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">Loading…</div>
    </AppLayout>
  );

  const orderCode = isNew ? "New Order" : (orderData?.data?.orderCode ?? `#${numId}`);

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-6xl mx-auto pb-12">

        {/* ── Sticky Header ── */}
        <div className="sticky top-0 z-20 -mx-6 bg-[#f8f9fb]/95 backdrop-blur border-b border-gray-200">
          {/* Top row: back, code, status, save */}
          <div className="px-6 py-3 max-w-6xl mx-auto flex items-center gap-4">
            <button onClick={() => setLocation("/swatch-orders")}
              className="p-2 rounded-xl hover:bg-gray-200 text-gray-500 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-mono font-bold text-gray-700 bg-white border border-gray-200 px-3 py-1 rounded-lg shrink-0">
              {orderCode}
            </span>
            <div className="flex-1" />
            {/* Status selector */}
            <div className="relative shrink-0">
              <select value={form.orderStatus} onChange={e => set("orderStatus", e.target.value)}
                className={`pl-3 pr-7 py-1.5 text-xs font-medium rounded-full border cursor-pointer appearance-none focus:outline-none ${STATUS_COLORS[form.orderStatus] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" />
            </div>
            {/* Save — only on tabs with editable data (0=Basic Info, 1=References) */}
            {activeTab <= 1 && (
              <button onClick={() => { void handleSave(); }} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shrink-0">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
          {/* Tab bar */}
          <div className="px-6 flex items-end gap-0 overflow-x-auto scrollbar-none">
            {TABS.map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === i
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                } ${i >= 3 ? "opacity-60" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">

        {/* ══ TAB 0: Basic Info ══ */}
        {activeTab === 0 && <div className="space-y-5">

          {/* ── Section 1: Identity — full width ── */}
          <SectionCard icon={<User className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
            title="Identity" subtitle="Core details of this swatch order">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Swatch Name *">
                <input className={inputCls} placeholder="e.g. Ivory Silk Embroidery – Spring 2026"
                  value={form.swatchName} onChange={e => set("swatchName", e.target.value)} />
              </Field>

              <Field label="Client">
                <AddableSelect
                  value={form.clientId}
                  onChange={v => {
                    const c = clients.find(c => String(c.id) === v);
                    set("clientId", v);
                    set("clientName", c?.brandName ?? "");
                  }}
                  options={clientOptions}
                  placeholder="— Select client —"
                />
              </Field>

              {selectedClient && (
                <div className="col-span-2 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-xl p-4">
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div><p className="text-gray-400 mb-0.5">Contact</p><p className="font-medium text-gray-800">{selectedClient.contactName}</p></div>
                    <div><p className="text-gray-400 mb-0.5">Email</p><p className="font-medium text-gray-800">{selectedClient.email}</p></div>
                    <div><p className="text-gray-400 mb-0.5">Phone</p><p className="font-medium text-gray-800">{selectedClient.contactNo}</p></div>
                    {selectedClient.country && <div><p className="text-gray-400 mb-0.5">Country</p><p className="font-medium text-gray-800">{selectedClient.country}</p></div>}
                  </div>
                </div>
              )}

              <Field label="Quantity">
                <input className={inputCls} type="number" min="0" placeholder="e.g. 10"
                  value={form.quantity} onChange={e => set("quantity", e.target.value)} />
              </Field>

              <Field label="Chargeable Swatch" hint="Enable if this swatch requires a client invoice">
                <div className="flex items-center gap-3 pt-1.5">
                  <button type="button" onClick={() => set("isChargeable", !form.isChargeable)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.isChargeable ? "bg-gray-900" : "bg-gray-200"}`}>
                    <span className={`inline-block h-4 w-4 rounded-full shadow transform transition-transform ${form.isChargeable ? "translate-x-6 bg-[#C9B45C]" : "translate-x-1 bg-white"}`} />
                  </button>
                  <span className={`text-sm font-medium ${form.isChargeable ? "text-gray-900" : "text-gray-400"}`}>
                    {form.isChargeable ? "Yes — Invoice will be generated" : "No — Non-billable"}
                  </span>
                </div>
              </Field>

              <div className="col-span-2">
                <Field label="Priority">
                  <div className="flex gap-2 mt-1">
                    {PRIORITIES.map(p => (
                      <button key={p} type="button" onClick={() => set("priority", p)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ring-1 ${
                          form.priority === p
                            ? `${PRIORITY_STYLES[p]} ring-2`
                            : "bg-white text-gray-500 ring-gray-200 hover:ring-gray-400"
                        }`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* ── Row: Material + Planning side by side ── */}
          <div className="grid grid-cols-2 gap-5">

            {/* ── Section 3: Material ── */}
            <SectionCard icon={<Scissors className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
              title="Material" subtitle="Fabric specifications and unit sizing">
              <div className="space-y-4">
                <Field label="Fabric">
                  <AddableSelect
                    value={form.fabricId}
                    onChange={v => {
                      const f = fabrics.find(f => String(f.id) === v);
                      set("fabricId", v);
                      set("fabricName", f ? `${f.fabricType} – ${f.quality}` : "");
                    }}
                    options={fabricOptions}
                    placeholder="— Select fabric —"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <Field label="Lining">
                    <div className="flex items-center gap-3 pt-1.5">
                      <button type="button" onClick={() => set("hasLining", !form.hasLining)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.hasLining ? "bg-gray-900" : "bg-gray-200"}`}>
                        <span className={`inline-block h-4 w-4 rounded-full shadow transform transition-transform ${form.hasLining ? "translate-x-6 bg-[#C9B45C]" : "translate-x-1 bg-white"}`} />
                      </button>
                      <span className={`text-sm font-medium ${form.hasLining ? "text-gray-900" : "text-gray-400"}`}>
                        {form.hasLining ? "Yes" : "No"}
                      </span>
                    </div>
                  </Field>
                  <Field label="Lining Fabric">
                    <AddableSelect
                      value={form.liningFabricId}
                      disabled={!form.hasLining}
                      onChange={v => {
                        const f = fabrics.find(f => String(f.id) === v);
                        set("liningFabricId", v);
                        set("liningFabricName", f ? `${f.fabricType} – ${f.quality}` : "");
                      }}
                      options={fabricOptions}
                      placeholder="— Select fabric —"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Length">
                    <input className={inputCls} placeholder="Length" type="number" min="0"
                      value={form.unitLength} onChange={e => set("unitLength", e.target.value)} />
                  </Field>
                  <Field label="Width">
                    <input className={inputCls} placeholder="Width" type="number" min="0"
                      value={form.unitWidth} onChange={e => set("unitWidth", e.target.value)} />
                  </Field>
                </div>

                <AddableSelect
                  label="Unit Type"
                  value={form.unitType}
                  onChange={v => set("unitType", v)}
                  onAdd={() => { setNewUnitTypeName(""); setUnitTypeError(""); setAddUnitTypeOpen(true); }}
                  options={unitTypeOptions}
                  placeholder="Select Unit Type"
                />
              </div>
            </SectionCard>

            {/* ── Section 4: Planning ── */}
            <SectionCard icon={<CalendarDays className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
              title="Planning" subtitle="Dates, timing and assignment details">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Order Issue Date">
                    <input type="date" className={inputCls} value={form.orderIssueDate} onChange={e => set("orderIssueDate", e.target.value)} />
                  </Field>
                  <Field label="Delivery Date">
                    <input type="date" className={inputCls} value={form.deliveryDate} onChange={e => set("deliveryDate", e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Target Hours" hint="Estimated production hours">
                    <input type="number" min="0" step="0.5" className={inputCls} placeholder="e.g. 8"
                      value={form.targetHours} onChange={e => set("targetHours", e.target.value)} />
                  </Field>
                  <Field label="Department">
                    <SearchableSelect
                      value={form.department}
                      onChange={v => set("department", v)}
                      options={DEPARTMENTS}
                      placeholder="— Select department —"
                      clearable
                    />
                  </Field>
                </div>
                <Field label="Issued To">
                  <input className={inputCls} placeholder="Artisan / Team member name"
                    value={form.issuedTo} onChange={e => set("issuedTo", e.target.value)} />
                </Field>
              </div>
            </SectionCard>
          </div>

          {/* ── Row: Notes + Completion Tracking side by side ── */}
          <div className="grid grid-cols-2 gap-5 items-start">

            {/* Notes */}
            <SectionCard icon={<MessageSquare className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
              title="Notes" subtitle="Description, internal remarks and client instructions">
              <div className="space-y-4">
                <Field label="Description">
                  <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Brief description of the swatch order…"
                    value={form.description} onChange={e => set("description", e.target.value)} />
                </Field>
                <Field label="Internal Notes" hint="Only visible to your team, not shown to client">
                  <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Internal remarks, production notes…"
                    value={form.internalNotes} onChange={e => set("internalNotes", e.target.value)} />
                </Field>
                <Field label="Client Instructions">
                  <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Specific instructions from client…"
                    value={form.clientInstructions} onChange={e => set("clientInstructions", e.target.value)} />
                </Field>
              </div>
            </SectionCard>

            {/* Completion Tracking */}
            <SectionCard icon={<CheckCircle2 className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
              title="Completion Tracking" subtitle="Record actual timings, revisions and approval">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Actual Start Date">
                    <input type="date" className={inputCls} value={form.actualStartDate} onChange={e => set("actualStartDate", e.target.value)} />
                  </Field>
                  <Field label="Actual Completion Date">
                    <input type="date" className={inputCls} value={form.actualCompletionDate} onChange={e => set("actualCompletionDate", e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tentative Delivery Date">
                    <input type="date" className={inputCls} value={form.tentativeDeliveryDate} onChange={e => set("tentativeDeliveryDate", e.target.value)} />
                  </Field>
                  <Field label="Approval Date">
                    <input type="date" className={inputCls} value={form.approvalDate} onChange={e => set("approvalDate", e.target.value)} />
                  </Field>
                </div>
                <Field label="Revision Count" hint="Number of revisions this order has gone through">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => set("revisionCount", Math.max(0, form.revisionCount - 1))}
                      className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 font-bold text-lg transition-colors">−</button>
                    <span className="text-lg font-bold text-gray-900 w-8 text-center">{form.revisionCount}</span>
                    <button type="button" onClick={() => set("revisionCount", form.revisionCount + 1)}
                      className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 font-bold text-lg transition-colors">+</button>
                    {form.revisionCount > 0 && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                        {form.revisionCount} revision{form.revisionCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </Field>
                <Field label="Delay Reason" hint="Explain if the order was delayed beyond the delivery date">
                  <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Reason for any delay (optional)…"
                    value={form.delayReason} onChange={e => set("delayReason", e.target.value)} />
                </Field>
              </div>
            </SectionCard>
          </div>

          {/* Bottom Save — Tab 0 */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setLocation("/swatch-orders")}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button onClick={() => { void handleSave(); }} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : (isNew ? "Create Swatch Order" : "Save Changes")}
            </button>
          </div>
        </div>} {/* ── end Tab 0 ── */}

        {/* ══ TAB 1: References ══ */}
        {activeTab === 1 && <div className="space-y-5">

          {/* Style + Swatch References */}
          <SectionCard icon={<Layers className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
            title="References" subtitle="Link related styles and swatches, add remarks for each">
            <div className="grid grid-cols-2 gap-6">
              {/* Style References */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Style References</span>
                  <button onClick={addStyleRef}
                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
                    <Plus className="h-3.5 w-3.5" /> Add Style
                  </button>
                </div>
                {form.styleReferences.length === 0 ? (
                  <div className="text-xs text-gray-400 py-3 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">No style references added</div>
                ) : (
                  <div className="space-y-2">
                    {form.styleReferences.map((ref, i) => (
                      <div key={i} className="flex gap-2 items-start p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="flex-1 space-y-2">
                          <AddableSelect
                            value={ref.id}
                            onChange={v => {
                              const s = styles.find(s => String(s.id) === v);
                              updateRef("style", i, "id", v);
                              updateRef("style", i, "label", s ? `${s.styleNo} – ${s.client}` : "");
                            }}
                            options={styleOptions}
                            placeholder="— Select style —"
                          />
                          <input className={inputCls} placeholder="Remark…" value={ref.remark}
                            onChange={e => updateRef("style", i, "remark", e.target.value)} />
                        </div>
                        <button onClick={() => removeRef("style", i)} className="p-1.5 text-gray-400 hover:text-red-500 mt-0.5">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Swatch References */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Swatch References</span>
                  <button onClick={addSwatchRef}
                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
                    <Plus className="h-3.5 w-3.5" /> Add Swatch
                  </button>
                </div>
                {form.swatchReferences.length === 0 ? (
                  <div className="text-xs text-gray-400 py-3 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">No swatch references added</div>
                ) : (
                  <div className="space-y-2">
                    {form.swatchReferences.map((ref, i) => (
                      <div key={i} className="flex gap-2 items-start p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="flex-1 space-y-2">
                          <AddableSelect
                            value={ref.id}
                            onChange={v => {
                              const s = swatches.find(s => String(s.id) === v);
                              updateRef("swatch", i, "id", v);
                              updateRef("swatch", i, "label", s?.swatchName ?? "");
                            }}
                            options={swatchOptions}
                            placeholder="— Select swatch —"
                          />
                          <input className={inputCls} placeholder="Remark…" value={ref.remark}
                            onChange={e => updateRef("swatch", i, "remark", e.target.value)} />
                        </div>
                        <button onClick={() => removeRef("swatch", i)} className="p-1.5 text-gray-400 hover:text-red-500 mt-0.5">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Attachments */}
          <SectionCard icon={<Paperclip className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
            title="Attachments" subtitle="Upload reference documents and images">
            <div className="grid grid-cols-2 gap-6">
              <Field label="Reference Documents">
                <FileUploadZone
                  files={form.refDocs} onChange={files => set("refDocs", files)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  icon={<FileText className="h-5 w-5" />}
                  label="Upload Documents"
                />
              </Field>
              <Field label="Reference Images">
                <FileUploadZone
                  files={form.refImages} onChange={files => set("refImages", files)}
                  accept="image/*"
                  icon={<ImageIcon className="h-5 w-5" />}
                  label="Upload Images"
                />
              </Field>
            </div>
          </SectionCard>

          {/* Bottom Save — Tab 1 */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setLocation("/swatch-orders")}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button onClick={() => { void handleSave(); }} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>} {/* ── end Tab 1 ── */}

        {/* ══ TAB 2: Artworks ══ */}
        {activeTab === 2 && <div className="space-y-5">
          {isNew ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Palette className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">Save this order first to start adding artworks.</p>
            </div>
          ) : (
            <SectionCard icon={<Palette className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
              title="Artworks" subtitle="Manage artworks linked to this swatch order">
              <div className="space-y-3">
                {(artworksData?.data ?? []).length === 0 ? (
                  <div className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No artworks yet — click "New Artwork" to begin
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(artworksData?.data ?? []).map((art: ArtworkRecord) => (
                      <div key={art.id} className="bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-white transition-all">
                        {/* ── Row 1: Identity + status + actions ── */}
                        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                          {/* Thumbnail (finalImage if Approved, else palette icon) */}
                          {art.feedbackStatus === "Approved" && (art.finalImages ?? []).length > 0 ? (
                            <img
                              src={art.finalImages[0].data}
                              alt="Final"
                              className="h-10 w-10 rounded-lg object-cover border border-gray-200 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                              onClick={e => { e.stopPropagation(); setLightbox({ images: art.finalImages ?? [], index: 0 }); }}
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
                              <Palette className="h-4 w-4 text-[#C9B45C]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{art.artworkName}</p>
                            <p className="text-xs text-gray-400 font-mono">{art.artworkCode}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                              art.feedbackStatus === "Approved"
                                ? "bg-gray-900 text-[#C9B45C] border-gray-900"
                                : art.feedbackStatus === "Revision Required"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : art.feedbackStatus === "Rejected"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : art.feedbackStatus === "In Review"
                                ? "bg-sky-50 text-sky-700 border-sky-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                            }`}>{art.feedbackStatus}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{art.artworkCreated}</span>
                            {art.totalCost && (
                              <span className="text-xs font-medium text-gray-700">₹ {Number(art.totalCost).toLocaleString()}</span>
                            )}
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-center gap-1 ml-1 shrink-0">
                            {art.feedbackStatus === "Approved" ? (
                              <button
                                onClick={() => setLocation(`/swatch-orders/${numId}/artworks/${art.id}`)}
                                title="View artwork (read-only)"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                                <ExternalLink className="h-3 w-3" /> View
                              </button>
                            ) : (
                              <button
                                onClick={() => setLocation(`/swatch-orders/${numId}/artworks/${art.id}`)}
                                title="Edit artwork"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setArtworkToDelete(art.id)}
                              title={art.feedbackStatus === "Approved" ? "Cannot delete an approved artwork" : "Delete artwork"}
                              disabled={art.feedbackStatus === "Approved"}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* ── Row 2: WIP + Final image strips ── */}
                        <div className="flex items-start gap-4 px-4 pb-3 border-t border-gray-100 pt-2 mt-0.5">
                          {/* WIP Images */}
                          <div className="flex-1">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">WIP Images</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(art.wipImages ?? []).map((img, idx) => (
                                <img key={idx} src={img.data} alt={img.name}
                                  className="h-10 w-10 rounded-lg object-cover border border-gray-200 cursor-pointer hover:scale-105 transition-transform"
                                  title={img.name}
                                  onClick={e => { e.stopPropagation(); setLightbox({ images: art.wipImages ?? [], index: idx }); }}
                                />
                              ))}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setImgUploadTarget({ artId: art.id, type: "wip" });
                                  setTimeout(() => artImgInputRef.current?.click(), 0);
                                }}
                                title="Add WIP image"
                                className="h-10 w-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors shrink-0">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="w-px bg-gray-200 self-stretch" />

                          {/* Final Images */}
                          <div className="flex-1">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Final Images</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(art.finalImages ?? []).map((img, idx) => (
                                <img key={idx} src={img.data} alt={img.name}
                                  className="h-10 w-10 rounded-lg object-cover border border-gray-200 cursor-pointer hover:scale-105 transition-transform"
                                  title={img.name}
                                  onClick={e => { e.stopPropagation(); setLightbox({ images: art.finalImages ?? [], index: idx }); }}
                                />
                              ))}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setImgUploadTarget({ artId: art.id, type: "final" });
                                  setTimeout(() => artImgInputRef.current?.click(), 0);
                                }}
                                title="Add final image"
                                className="h-10 w-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors shrink-0">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setLocation(`/swatch-orders/${numId}/artworks/new`)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-900 hover:text-gray-900 transition-colors w-full justify-center font-medium">
                  <Plus className="h-4 w-4" /> New Artwork
                </button>
              </div>
            </SectionCard>
          )}
        </div>} {/* ── end Tab 2 ── */}

        {/* ══ TAB 3: Estimate ══ */}
        {activeTab === 3 && (
          <div className="space-y-5">

            {/* Estimate Items Input */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gray-900">
                  <span className="text-sm">📊</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-gray-900">Estimate Items</h2>
                  <p className="text-xs text-gray-400">Enter rates for each cost component</p>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3 w-full">Item</th>
                      <th className="text-right text-xs font-semibold text-gray-500 px-6 py-3 whitespace-nowrap">Rate (₹)</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {form.estimate.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-3">
                          {item.isCustom ? (
                            <input
                              className="w-full text-sm text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:border-gray-900 focus:outline-none py-0.5 placeholder:text-gray-400"
                              placeholder="Service name…"
                              value={item.label}
                              onChange={e => {
                                const updated = [...form.estimate];
                                updated[idx] = { ...updated[idx], label: e.target.value };
                                set("estimate", updated);
                              }}
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-800">{item.label}</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-gray-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              className="w-32 text-right text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-300 bg-white"
                              value={item.rate}
                              onChange={e => {
                                const updated = [...form.estimate];
                                updated[idx] = { ...updated[idx], rate: e.target.value };
                                set("estimate", updated);
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.isCustom && (
                            <button
                              type="button"
                              onClick={() => set("estimate", form.estimate.filter((_, i) => i !== idx))}
                              title="Remove"
                              className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Custom */}
              <div className="px-6 py-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    const customId = `custom_${Date.now()}`;
                    set("estimate", [...form.estimate, { id: customId, label: "", rate: "", isCustom: true }]);
                  }}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
                  <Plus className="h-4 w-4" />
                  Add Custom Service
                </button>
              </div>
            </div>

            {/* Summary card */}
            {(() => {
              const lineItems = form.estimate.filter(it => {
                const r = parseFloat(it.rate);
                return !isNaN(r) && r > 0 && it.label.trim();
              });
              const total = lineItems.reduce((sum, it) => sum + parseFloat(it.rate), 0);
              return (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gray-900">
                      <span className="text-sm">💰</span>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
                      <p className="text-xs text-gray-400">
                        {lineItems.length > 0 ? `${lineItems.length} item${lineItems.length !== 1 ? "s" : ""} · Total ₹ ${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "No rates entered yet"}
                      </p>
                    </div>
                  </div>
                  {lineItems.length === 0 ? (
                    <div className="px-6 py-10 text-center text-sm text-gray-400 italic">
                      Enter rates above to see the summary
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3 w-full">Item</th>
                            <th className="text-right text-xs font-semibold text-gray-500 px-6 py-3 whitespace-nowrap">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {lineItems.map((it, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-6 py-3 text-sm text-gray-700">{it.label}</td>
                              <td className="px-6 py-3 text-sm text-right text-gray-900 font-medium tabular-nums">
                                ₹ {parseFloat(it.rate).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 bg-gray-900">
                            <td className="px-6 py-3.5 text-sm font-semibold text-[#C9B45C]">Grand Total</td>
                            <td className="px-6 py-3.5 text-sm font-bold text-right text-[#C9B45C] tabular-nums">
                              ₹ {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Save button */}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { void handleSave(); }} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shadow-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save Estimate"}
              </button>
            </div>
          </div>
        )}

        {/* ══ TABS 4–7: Coming Soon placeholders ══ */}
        {activeTab >= 4 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl">
              {TABS[activeTab].icon}
            </div>
            <h3 className="text-base font-semibold text-gray-700">{TABS[activeTab].label}</h3>
            <p className="text-sm text-gray-400 max-w-xs">
              This section is coming soon. You'll be able to manage {TABS[activeTab].label.toLowerCase()} details here once it's ready.
            </p>
            <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 font-medium">Coming Soon</span>
          </div>
        )}

        </div> {/* ── end outer mt-5 ── */}

        {/* Hidden file input for artwork WIP/Final image upload */}
        <input
          ref={artImgInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleArtworkImageFiles}
        />

        {/* Image Lightbox */}
        {lightbox && (
          <ImageLightbox
            images={lightbox.images}
            startIndex={lightbox.index}
            onClose={() => setLightbox(null)}
          />
        )}

        {/* Delete Artwork Confirmation Modal */}
        {artworkToDelete !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Delete Artwork?</h3>
                  <p className="text-sm text-gray-500 mt-0.5">This artwork will be permanently deleted. This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setArtworkToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDeleteArtworkConfirm} disabled={deleteArtwork.isPending}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60">
                  {deleteArtwork.isPending ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Unit Type Modal */}
        {addUnitTypeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Add Unit Type</h3>
              <input
                autoFocus
                className={`${inputCls} ${unitTypeError ? "border-red-400 focus:ring-red-200" : ""}`}
                placeholder="e.g. cm, inch, meter"
                value={newUnitTypeName}
                onChange={e => { setNewUnitTypeName(e.target.value); setUnitTypeError(""); }}
                onKeyDown={e => { if (e.key === "Enter") { handleAddUnitType(); } }}
              />
              {unitTypeError && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <span className="font-medium">⚠</span> {unitTypeError}
                </p>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setAddUnitTypeOpen(false); setUnitTypeError(""); }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button onClick={handleAddUnitType} disabled={!newUnitTypeName.trim() || createUnitType.isPending}
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
