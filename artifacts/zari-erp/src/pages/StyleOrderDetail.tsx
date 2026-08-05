import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, Loader2, ChevronDown, XCircle,
  User, CalendarDays, MessageSquare, CheckCircle2,
  Layers, Paperclip, Plus, X, FileText, Image as ImageIcon, Video, Eye,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useAllClients } from "@/hooks/useClients";
import AddableSelect from "@/components/ui/AddableSelect";
import { useDepartments, useCreateDepartment } from "@/hooks/useLookups";
import { useStyleOrder, useCreateStyleOrder, useUpdateStyleOrder, useCancelStyleOrder, type ReferenceItem, type FileAttachment } from "@/hooks/useStyleOrders";
import CancelOrderModal from "@/components/ui/CancelOrderModal";
import { useStylesForReference, type StyleRefOption } from "@/hooks/useStyles";
import { useSwatchesForReference, type SwatchRefOption } from "@/hooks/useSwatches";
import ProductsTab from "./ProductsTab";
import StyleOrderArtworksTab from "./StyleOrderArtworksTab";
import StyleOrderToileTab from "./StyleOrderToileTab";
import StyleCostingTab from "./StyleCostingTab";
import StyleCostSheetTab from "./StyleCostSheetTab";
import StyleClientLinkTab from "./StyleClientLinkTab";
import ShippingTab from "@/pages/ShippingTab";
import LinkedInvoicesPanel from "@/components/LinkedInvoicesPanel";
import { useCurrency } from "@/contexts/CurrencyContext";
import TagInput from "@/components/ui/TagInput";
import { FormAccessGate } from "@/components/FormAccessGate";
import { useFormAccessContext } from "@/contexts/FormAccessContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const ORDER_STATUSES = ["Draft", "Issued", "In Production", "In Review", "Pending Approval", "Completed", "Rejected"];

const STANDARD_ESTIMATE_ITEMS = [
  "Sampling", "Artwork", "Material", "Embroidery",
  "Fabric", "QC", "Travel", "Overheads",
];

interface EstimateItem {
  id: string;
  label: string;
  rate: string;
  isCustom: boolean;
}

function makeDefaultEstimate(): EstimateItem[] {
  return STANDARD_ESTIMATE_ITEMS.map(label => ({ id: label.toLowerCase(), label, rate: "", isCustom: false }));
}

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-slate-100 text-slate-700 ring-slate-300",
  Medium: "bg-blue-600 text-white ring-blue-600",
  High: "bg-amber-500 text-white ring-amber-500",
  Urgent: "bg-red-600 text-white ring-red-600",
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "text-gray-600 bg-gray-50 border-gray-200",
  Issued: "text-blue-700 bg-blue-50 border-blue-200",
  "In Production": "text-amber-700 bg-amber-50 border-amber-200",
  "In Review": "text-purple-700 bg-purple-50 border-purple-200",
  "Pending Approval": "text-orange-700 bg-orange-50 border-orange-200",
  Completed: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Rejected: "text-red-700 bg-red-50 border-red-200",
  Cancelled: "text-gray-500 bg-gray-50 border-gray-200",
};

const FULL_TABS = [
  { label: "Basic Info", permKey: "style_orders:tab:basic_info:view" },
  { label: "Completion Tracking", permKey: "style_orders:tab:completion_tracking:view" },
  { label: "References", permKey: "style_orders:tab:references:view" },
  { label: "Products", permKey: "style_orders:tab:products:view" },
  { label: "Artworks", permKey: "style_orders:tab:artworks:view" },
  { label: "Toile", permKey: "style_orders:tab:toile:view" },
  { label: "Client Link", permKey: "style_orders:tab:client_link:view" },
  { label: "Estimate", permKey: "style_orders:tab:estimate:view" },
  { label: "Costing", permKey: "style_orders:tab:costing:view" },
  { label: "Cost Sheet", permKey: "style_orders:tab:cost_sheet:view" },
  { label: "Shipping", permKey: "style_orders:tab:shipping:view" },
  { label: "Invoices", permKey: "style_orders:tab:invoices:view" },
];

// ── Form ──────────────────────────────────────────────────────────────────────
type FormState = {
  styleName: string;
  styleNo: string;
  clientId: string;
  clientName: string;
  tags: string[];
  quantity: string;
  priority: string;
  orderStatus: string;
  season: string;
  colorway: string;
  sampleSize: string;
  fabricType: string;
  orderIssueDate: string;
  deliveryDate: string;
  targetHours: string;
  issuedTo: string;
  department: string;
  description: string;
  internalNotes: string;
  clientInstructions: string;
  isChargeable: boolean;
  isInhouse: boolean;
  styleReferences: ReferenceItem[];
  swatchReferences: ReferenceItem[];
  refDocs: FileAttachment[];
  refImages: FileAttachment[];
  wipImages: FileAttachment[];
  finalImages: FileAttachment[];
  wipVideos: FileAttachment[];
  finalVideos: FileAttachment[];
  estimate: EstimateItem[];
  actualStartDate: string;
  actualStartTime: string;
  tentativeDeliveryDate: string;
  actualCompletionDate: string;
  actualCompletionTime: string;
  delayReason: string;
  approvalDate: string;
};

const EMPTY_FORM: FormState = {
  styleName: "", styleNo: "", clientId: "", clientName: "",
  tags: [], quantity: "", priority: "Medium", orderStatus: "Draft",
  season: "", colorway: "", sampleSize: "", fabricType: "",
  orderIssueDate: "", deliveryDate: "", targetHours: "",
  issuedTo: "", department: "", description: "",
  internalNotes: "", clientInstructions: "", isChargeable: false, isInhouse: false,
  styleReferences: [], swatchReferences: [],
  refDocs: [], refImages: [],
  wipImages: [], finalImages: [],
  wipVideos: [], finalVideos: [],
  estimate: makeDefaultEstimate(),
  actualStartDate: "", actualStartTime: "",
  tentativeDeliveryDate: "", actualCompletionDate: "",
  actualCompletionTime: "", delayReason: "", approvalDate: "",
};

// ── Shared helpers (defined outside component to avoid re-render focus loss) ─
const inputCls = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#C9B45C]/25 focus:border-[#C9B45C]/50 placeholder:text-gray-400 transition-colors";

function fileToAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result as string, size: file.size });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FilePreviewModal({ file, onClose }: { file: FileAttachment | null; onClose: () => void }) {
  if (!file) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white hover:text-gray-300">
          <X className="h-6 w-6" />
        </button>
        <div className="bg-white rounded-xl overflow-hidden flex items-center justify-center" style={{ maxHeight: "85vh" }}>
          {file.type.startsWith("image/") ? (
            <img src={file.data} alt={file.name} className="max-w-full max-h-[85vh] object-contain" />
          ) : file.type.startsWith("video/") ? (
            <video src={file.data} controls className="max-w-full max-h-[85vh]" />
          ) : file.type === "application/pdf" ? (
            <iframe src={file.data} title={file.name} className="w-[80vw] h-[85vh]" />
          ) : (
            <div className="p-8 text-center">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">{file.name}</p>
              <p className="text-xs text-gray-400 mb-4">Preview not available for this file type</p>
              <a href={file.data} download={file.name} className="inline-block px-4 py-2 bg-gray-900 text-[#C9B45C] rounded-lg text-sm font-semibold">Download</a>
            </div>
          )}
        </div>
        <p className="text-white text-sm mt-3 text-center truncate">{file.name}</p>
      </div>
    </div>
  );
}

function FileUploadZone({ files, onChange, accept, icon, label }: {
  files: FileAttachment[];
  onChange: (files: FileAttachment[]) => void;
  accept: string;
  icon: React.ReactNode;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);

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
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden"
          onChange={e => { void handleFiles(e.target.files); }} />
      </div>
      {files.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
              {f.type.startsWith("image/") ? (
                <img src={f.data} alt={f.name} className="h-14 w-14 rounded-lg object-cover border border-gray-200 shrink-0 cursor-pointer hover:opacity-80"
                  onClick={() => setPreviewFile(f)} />
              ) : f.type.startsWith("video/") ? (
                <div className="h-10 w-10 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80"
                  onClick={() => setPreviewFile(f)}>
                  <Video className="h-5 w-5 text-[#C9B45C]" />
                </div>
              ) : (
                <div className="h-8 w-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 shrink-0 cursor-pointer hover:opacity-80"
                  onClick={() => setPreviewFile(f)}>
                  <FileText className="h-4 w-4" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <span className="text-xs font-medium text-gray-700 truncate">{f.name}</span>
                <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
              <button onClick={() => setPreviewFile(f)} className="text-gray-400 hover:text-gray-800 transition-colors shrink-0" title="Preview">
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 transition-colors shrink-0" title="Remove">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}

function SectionCard({ icon, title, subtitle, accentColor, children }: {
  icon: React.ReactNode; title: string; subtitle: string; accentColor: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${accentColor} shadow-sm`}>
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        <div className="ml-auto h-1 w-8 rounded-full bg-gradient-to-r from-[#C9B45C]/40 to-transparent" />
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode, className?: string; }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function PlaceholderTab({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-gray-400 mt-1.5">Save the order first to unlock this tab.</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StyleOrderDetail() {
  const { fmt, currency: dc } = useCurrency();
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const numId = isNew ? null : parseInt(id ?? "0");
  const { canEdit } = useFormAccessContext();

  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ query: { enabled: !!token } as any });
  const logoutMutation = useLogout();
  const isAdmin = user?.role === "admin";

  const { data: orderData, isLoading: loadingOrder } = useStyleOrder(numId);
  const createOrder = useCreateStyleOrder();
  const updateOrder = useUpdateStyleOrder();
  const cancelOrderMutation = useCancelStyleOrder();
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: clientsData } = useAllClients();
  const clients = (clientsData as any)?.data ?? clientsData ?? [];

  const { data: styleRefs } = useStylesForReference();
  const { data: swatchRefs } = useSwatchesForReference();
  const styleOptions = (styleRefs ?? []).map((s: StyleRefOption) => ({
    value: s.id,
    label: s.source === "master"
      ? `${s.code}${s.client ? ` – ${s.client}` : ""}${s.name && s.name !== s.code ? ` (${s.name})` : ""}`
      : `${s.code} – ${s.name}${s.client ? ` · ${s.client}` : ""} [Order]`,
  }));
  const swatchOptions = (swatchRefs ?? []).map((s: SwatchRefOption) => ({
    value: s.id,
    label: s.source === "master"
      ? `${s.code} – ${s.name}${s.client ? ` (${s.client})` : ""}`
      : `${s.code} – ${s.name}${s.client ? ` · ${s.client}` : ""} [Order]`,
  }));

  const { data: deptData } = useDepartments();
  const createDept = useCreateDepartment();
  const departments = deptData ?? [];
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [deptError, setDeptError] = useState("");

  const { hasTabPermission } = useMyPermissions();

  const [activeTab, setActiveTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = parseInt(params.get("tab") ?? "0", 10);
    return FULL_TABS[!isNaN(t) && t >= 0 ? Math.min(t, FULL_TABS.length - 1) : 0]?.label ?? "Basic Info";
  });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const visibleTabs = useMemo(
    () => FULL_TABS.filter((t) => {
      if (t.label === "Invoices" && !form.isChargeable) return false;
      return hasTabPermission(t.permKey);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.isChargeable]
  );

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some(t => t.label === activeTab)) {
      setActiveTab(visibleTabs[0].label);
    }
  }, [visibleTabs, activeTab]);
  const [saving, setSaving] = useState(false);
  const savedFormRef = useRef<FormState>(EMPTY_FORM);
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedFormRef.current);

  useEffect(() => {
    if (orderData?.data) {
      const o = orderData.data;
      const loaded: FormState = {
        styleName: o.styleName ?? "",
        styleNo: o.styleNo ?? "",
        clientId: o.clientId ?? "",
        clientName: o.clientName ?? "",
        tags: o.tags ?? [],
        quantity: o.quantity ?? "",
        priority: o.priority ?? "Medium",
        orderStatus: o.orderStatus ?? "Draft",
        season: o.season ?? "",
        colorway: o.colorway ?? "",
        sampleSize: o.sampleSize ?? "",
        fabricType: o.fabricType ?? "",
        orderIssueDate: o.orderIssueDate ?? "",
        deliveryDate: o.deliveryDate ?? "",
        targetHours: o.targetHours ?? "",
        issuedTo: o.issuedTo ?? "",
        department: o.department ?? "",
        description: o.description ?? "",
        internalNotes: o.internalNotes ?? "",
        clientInstructions: o.clientInstructions ?? "",
        isChargeable: o.isChargeable ?? false,
        isInhouse: o.isInhouse ?? false,
        styleReferences: o.styleReferences ?? [],
        swatchReferences: o.swatchReferences ?? [],
        refDocs: o.refDocs ?? [],
        refImages: o.refImages ?? [],
        wipImages: (o.wipImages as FileAttachment[]) ?? [],
        finalImages: (o.finalImages as FileAttachment[]) ?? [],
        wipVideos: (o.wipVideos as FileAttachment[]) ?? [],
        finalVideos: (o.finalVideos as FileAttachment[]) ?? [],
        estimate: (() => {
          const saved = (o.estimate ?? []) as unknown as EstimateItem[];
          const defaults = makeDefaultEstimate();
          const merged = defaults.map(def => {
            const found = saved.find(s => s.id === def.id && !s.isCustom);
            return found ? { ...def, rate: found.rate ?? "" } : def;
          });
          const custom = saved.filter(s => s.isCustom);
          return [...merged, ...custom];
        })(),
        actualStartDate: o.actualStartDate ?? "",
        actualStartTime: o.actualStartTime ?? "",
        tentativeDeliveryDate: o.tentativeDeliveryDate ?? "",
        actualCompletionDate: o.actualCompletionDate ?? "",
        actualCompletionTime: o.actualCompletionTime ?? "",
        delayReason: o.delayReason ?? "",
        approvalDate: o.approvalDate ?? "",
      };
      setForm(loaded);
      savedFormRef.current = loaded;
    }
  }, [orderData]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addStyleRef() {
    set("styleReferences", [...form.styleReferences, { id: "", label: "", remark: "" }]);
  }
  function addSwatchRef() {
    set("swatchReferences", [...form.swatchReferences, { id: "", label: "", remark: "" }]);
  }
  function updateRef(type: "style" | "swatch", idx: number, updates: Partial<ReferenceItem>) {
    const key = type === "style" ? "styleReferences" : "swatchReferences";
    setForm(prev => {
      const arr = [...prev[key]];
      arr[idx] = { ...arr[idx], ...updates };
      return { ...prev, [key]: arr };
    });
  }
  function removeRef(type: "style" | "swatch", idx: number) {
    const key = type === "style" ? "styleReferences" : "swatchReferences";
    setForm(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  }

  const clientOptions = clients.map((c: { id: number; brandName: string }) => ({
    value: String(c.id), label: c.brandName,
  }));
  const selectedClient = clients.find((c: { id: number }) => String(c.id) === form.clientId) as
    { id: number; brandName: string; contactName: string; email: string; contactNo: string; country?: string } | undefined;

  const deptOptions = departments.map((d: { id: number; name: string }) => ({
    value: d.name, label: d.name,
  }));

  async function handleAddDept() {
    if (!newDeptName.trim()) { setDeptError("Name is required"); return; }
    try {
      const result = await createDept.mutateAsync({ name: newDeptName.trim(), isActive: true });
      set("department", result.name);
      setAddDeptOpen(false);
      setNewDeptName("");
      setDeptError("");
    } catch {
      setDeptError("Already exists or failed to create");
    }
  }

  function validateDates(): string | null {
    const { orderIssueDate, deliveryDate, actualStartDate, actualCompletionDate, tentativeDeliveryDate, approvalDate } = form;
    if (orderIssueDate && deliveryDate && deliveryDate < orderIssueDate)
      return "Delivery Date cannot be earlier than Order Issue Date";
    if (orderIssueDate && actualStartDate && actualStartDate < orderIssueDate)
      return "Actual Start Date cannot be earlier than Order Issue Date";
    if (actualStartDate && actualCompletionDate && actualCompletionDate < actualStartDate)
      return "Actual Completion Date cannot be earlier than Actual Start Date";
    if (orderIssueDate && tentativeDeliveryDate && tentativeDeliveryDate < orderIssueDate)
      return "Tentative Delivery Date cannot be earlier than Order Issue Date";
    if (actualCompletionDate && approvalDate && approvalDate < actualCompletionDate)
      return "Approval Date cannot be earlier than Actual Completion Date";
    return null;
  }

  async function handleSave() {
    if (!form.styleName.trim()) {
      toast({ title: "Style Name is required", variant: "destructive" });
      return;
    }

    if (!form.clientId.trim()) {
      toast({ title: "Client is required", variant: "destructive" });
      return;
    }
    const dateErr = validateDates();
    if (dateErr) {
      toast({ title: dateErr, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await createOrder.mutateAsync(form as any);
        toast({ title: "Style order created", description: res.data.orderCode });
        savedFormRef.current = form;
        clearDirty();
        setLocation(`/style-orders/${res.data.id}`);
      } else if (numId) {
        await updateOrder.mutateAsync({ id: numId, data: form as any });
        savedFormRef.current = form;
        toast({ title: "Changes saved" });
      }
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const handleSaveForGuard = useCallback(async () => { await handleSave(); }, [form, isNew, numId]);
  const { clearDirty } = useUnsavedChanges(isDirty, handleSaveForGuard);

  const CANCELLABLE_STATUSES = new Set(["Issued", "In Production", "In Review", "Pending Approval", "Completed"]);
  const canCancelOrder = !isNew && CANCELLABLE_STATUSES.has(form.orderStatus);

  async function handleCancelOrder(reason: string) {
    if (!numId) return;
    try {
      await cancelOrderMutation.mutateAsync({ id: numId, reason });
      toast({ title: "Order cancelled", description: "The order has been marked as Cancelled." });
      setCancelOpen(false);
      setForm(prev => ({ ...prev, orderStatus: "Cancelled" }));
      savedFormRef.current = { ...savedFormRef.current, orderStatus: "Cancelled" };
    } catch {
      toast({ title: "Error", description: "Failed to cancel order.", variant: "destructive" });
    }
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

  if (loadingUser) return null;
  if (!user) { setLocation("/login"); return null; }
  if (!isNew && loadingOrder) return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="-mx-6 -my-6 md:-mx-8 md:-my-8" style={{ background: "#F8F6F0", minHeight: "100vh" }}>
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">Loading…</div>
      </div>
    </AppLayout>
  );

  const orderCode = isNew ? "New Style Order" : (orderData?.data?.orderCode ?? `#${numId}`);

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="-mx-6 -my-6 md:-mx-8 md:-my-8 pb-12" style={{ background: "#F8F6F0", minHeight: "100vh" }}>

        {/* ── Sticky Header ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-[#F8F6F0]/95 backdrop-blur border-b border-[#C6AF4B]/20">
          {/* Breadcrumb / status / save */}
          <div className="px-6 md:px-8 py-3.5 max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setLocation("/style-orders")}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Style Orders
              </button>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-bold font-mono text-gray-900">{orderCode}</span>
            </div>
            <FormAccessGate readOnly={!canEdit}>
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <select value={form.orderStatus} onChange={e => set("orderStatus", e.target.value)}
                    className={`pl-3 pr-7 py-1.5 text-xs font-semibold rounded-full border cursor-pointer appearance-none focus:outline-none shadow-sm ${STATUS_COLORS[form.orderStatus] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none opacity-60" />
                </div>
                {canCancelOrder && (
                  <button onClick={() => setCancelOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors shrink-0">
                    <XCircle className="h-4 w-4" />
                    Cancel Order
                  </button>
                )}
                <button onClick={() => { void handleSave(); }} disabled={saving}
                  style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all shadow-md shrink-0">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </FormAccessGate>
          </div>

          {/* Tab bar */}
          <div className="px-6 md:px-8 max-w-6xl mx-auto overflow-x-auto scrollbar-none">
            <div className="flex items-end gap-0">
              {visibleTabs.map((tab) => (
                <button key={tab.label} onClick={() => setActiveTab(tab.label)}
                  className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === tab.label
                      ? "border-[#C9B45C] text-gray-900 font-semibold"
                      : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                    }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 md:px-8 max-w-6xl mx-auto mt-5">

          {/* ══ TAB: Basic Info ═══════════════════════════════════════════ */}
          {activeTab === "Basic Info" && (
            <div className="space-y-5">

              <FormAccessGate readOnly={!canEdit}>
                {/* ── Identity ──────────────────────────────────────────────── */}
                <SectionCard icon={<User className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
                  title="Identity" subtitle="Core details of this style order">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Style Name *">
                      <input className={inputCls} placeholder="e.g. Classic Kurta – Spring 2026"
                        value={form.styleName} onChange={e => set("styleName", e.target.value)} />
                    </Field>

                    <Field label="Client *">
                      <AddableSelect
                        value={form.clientId}
                        onChange={v => {
                          const c = clients.find((c: { id: number }) => String(c.id) === v) as
                            { id: number; brandName: string } | undefined;
                          set("clientId", v);
                          set("clientName", c?.brandName ?? "");
                        }}
                        options={clientOptions}
                        placeholder="— Select client —"
                        disabled={!isNew}
                      />
                    </Field>

                    {/* {selectedClient && (
                    <div className="col-span-2 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-xl px-4 py-2.5">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-gray-600">
                        {selectedClient.contactName && <span className="font-medium text-gray-800">{selectedClient.contactName}</span>}
                        {selectedClient.email && <><span className="text-gray-300">·</span><span>{selectedClient.email}</span></>}
                        {selectedClient.contactNo && <><span className="text-gray-300">·</span><span>{selectedClient.contactNo}</span></>}
                        {selectedClient.country && <><span className="text-gray-300">·</span><span>{selectedClient.country}</span></>}
                      </div>
                    </div>
                  )} */}

                    <Field label="Tags" className="col-span-2">
                      <TagInput
                        value={form.tags}
                        onChange={tags => set("tags", tags)}
                        placeholder="Add a tag..."
                      />
                    </Field>

                    <Field label="Quantity">
                      <input className={inputCls} type="number" min="0" placeholder="e.g. 500"
                        value={form.quantity} onChange={e => set("quantity", e.target.value)} />
                    </Field>

                    <div className="col-span-2 grid grid-cols-2 gap-4">
                      <Field label="Chargeable Order" hint="Enable if this order requires a client invoice">
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

                      <Field label="In-house Order" hint="Enable if this is an internal production order (no external client)">
                        <div className="flex items-center gap-3 pt-1.5">
                          <button type="button" onClick={() => set("isInhouse", !form.isInhouse)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.isInhouse ? "bg-gray-900" : "bg-gray-200"}`}>
                            <span className={`inline-block h-4 w-4 rounded-full shadow transform transition-transform ${form.isInhouse ? "translate-x-6 bg-[#C9B45C]" : "translate-x-1 bg-white"}`} />
                          </button>
                          <span className={`text-sm font-medium ${form.isInhouse ? "text-gray-900" : "text-gray-400"}`}>
                            {form.isInhouse ? "Yes — Internal production order" : "No — Client order"}
                          </span>
                        </div>
                      </Field>
                    </div>

                    <div className="col-span-2">
                      <Field label="Priority">
                        <div className="flex gap-2 mt-1">
                          {PRIORITIES.map(p => (
                            <button key={p} type="button" onClick={() => set("priority", p)}
                              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ring-1 ${form.priority === p
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

                {/* ── Planning ──────────────────────────────────────────────── */}
                <SectionCard icon={<CalendarDays className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
                  title="Planning" subtitle="Dates, timing and assignment details">
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Order Issue Date">
                      <input type="date" className={inputCls} value={form.orderIssueDate} onChange={e => set("orderIssueDate", e.target.value)} />
                    </Field>
                    <Field label="Delivery Date">
                      <input type="date" className={inputCls} value={form.deliveryDate} min={form.orderIssueDate || undefined} onChange={e => set("deliveryDate", e.target.value)} />
                    </Field>
                    <Field label="Target Hours" hint="Estimated production hours">
                      <input type="number" min="0" step="0.5" className={inputCls} placeholder="e.g. 48"
                        value={form.targetHours} onChange={e => set("targetHours", e.target.value)} />
                    </Field>
                    <Field label="Department">
                      <AddableSelect
                        value={form.department}
                        onChange={v => set("department", v)}
                        onAdd={() => { setNewDeptName(""); setDeptError(""); setAddDeptOpen(true); }}
                        options={deptOptions}
                        placeholder="— Select department —"
                      />
                    </Field>
                    <Field label="Issued To">
                      <input className={inputCls} placeholder="Artisan / Team member name"
                        value={form.issuedTo} onChange={e => set("issuedTo", e.target.value)} />
                    </Field>
                  </div>
                </SectionCard>

                {/* ── Notes ────────────────────────────────────────────────── */}
                <SectionCard icon={<MessageSquare className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
                  title="Notes" subtitle="Description, internal remarks and client instructions">
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Description">
                      <textarea rows={4} className={`${inputCls} resize-none`} placeholder="Brief description of this style order…"
                        value={form.description} onChange={e => set("description", e.target.value)} />
                    </Field>
                    <Field label="Internal Notes" hint="Only visible to your team, not shown to client">
                      <textarea rows={4} className={`${inputCls} resize-none`} placeholder="Internal remarks, production notes…"
                        value={form.internalNotes} onChange={e => set("internalNotes", e.target.value)} />
                    </Field>
                    <Field label="Client Instructions">
                      <textarea rows={4} className={`${inputCls} resize-none`} placeholder="Specific instructions from client…"
                        value={form.clientInstructions} onChange={e => set("clientInstructions", e.target.value)} />
                    </Field>
                  </div>
                </SectionCard>
              </FormAccessGate>

              {/* Bottom Save */}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setLocation("/style-orders")}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button onClick={() => { void handleSave(); }} disabled={saving || !canEdit}
                  style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all shadow-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : (isNew ? "Create Style Order" : "Save Changes")}
                </button>
              </div>
            </div>
          )}

          {/* ══ TAB: Completion Tracking ══════════════════════════════════ */}
          {activeTab === "Completion Tracking" && (
            <div className="space-y-5">
              <FormAccessGate readOnly={!canEdit}>
                <SectionCard icon={<CheckCircle2 className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
                  title="Completion Tracking" subtitle="Record actual timings, revisions and approval">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Actual Start Date">
                        <input type="date" className={inputCls} value={form.actualStartDate} min={form.orderIssueDate || undefined} onChange={e => set("actualStartDate", e.target.value)} />
                      </Field>
                      <Field label="Actual Completion Date">
                        <input type="date" className={inputCls} value={form.actualCompletionDate} min={form.actualStartDate || form.orderIssueDate || undefined} onChange={e => set("actualCompletionDate", e.target.value)} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tentative Delivery Date">
                        <input type="date" className={inputCls} value={form.tentativeDeliveryDate} min={form.orderIssueDate || undefined} onChange={e => set("tentativeDeliveryDate", e.target.value)} />
                      </Field>
                      <Field label="Approval Date">
                        <input type="date" className={inputCls} value={form.approvalDate} min={form.actualCompletionDate || form.actualStartDate || form.orderIssueDate || undefined} onChange={e => set("approvalDate", e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Delay Reason" hint="Explain if order was delayed beyond delivery date">
                      <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Reason for any delay (optional)…"
                        value={form.delayReason} onChange={e => set("delayReason", e.target.value)} />
                    </Field>
                  </div>
                </SectionCard>
              </FormAccessGate>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setLocation("/style-orders")}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button onClick={() => { void handleSave(); }} disabled={saving || !canEdit}
                  style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all shadow-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : (isNew ? "Create Style Order" : "Save Changes")}
                </button>
              </div>
            </div>
          )}

          {/* ══ TAB: References ════════════════════════════════════════════ */}
          {activeTab === "References" && <div className="space-y-5">

            <FormAccessGate readOnly={!canEdit}>
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
                                  const s = (styleRefs ?? []).find(s => s.id === v);
                                  updateRef("style", i, {
                                    id: v,
                                    label: s ? (s.source === "master" ? `${s.code}${s.client ? ` – ${s.client}` : ""}` : `${s.code} – ${s.name}`) : "",
                                  });
                                }}
                                options={styleOptions}
                                placeholder="— Select style —"
                              />
                              <input className={inputCls} placeholder="Remark…" value={ref.remark}
                                onChange={e => updateRef("style", i, { remark: e.target.value })} />
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
                                  const s = (swatchRefs ?? []).find(s => s.id === v);
                                  updateRef("swatch", i, { id: v, label: s ? `${s.code} – ${s.name}` : "" });
                                }}
                                options={swatchOptions}
                                placeholder="— Select swatch —"
                              />
                              <input className={inputCls} placeholder="Remark…" value={ref.remark}
                                onChange={e => updateRef("swatch", i, { remark: e.target.value })} />
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

              <SectionCard icon={<Paperclip className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
                title="Attachments" subtitle="Reference documents, WIP and final images & videos">
                {/* Row 1: Reference Docs + Reference Images */}
                <div className="grid grid-cols-2 gap-6 mb-6">
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
                {/* Divider */}
                <div className="border-t border-gray-100 mb-6" />
                {/* Row 2: WIP Images + WIP Videos */}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Work In Progress</p>
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <Field label="WIP Images">
                    <FileUploadZone
                      files={form.wipImages} onChange={files => set("wipImages", files)}
                      accept="image/*"
                      icon={<ImageIcon className="h-5 w-5" />}
                      label="Upload WIP Images"
                    />
                  </Field>
                  <Field label="WIP Videos">
                    <FileUploadZone
                      files={form.wipVideos} onChange={files => set("wipVideos", files)}
                      accept="video/*"
                      icon={<Video className="h-5 w-5" />}
                      label="Upload WIP Videos"
                    />
                  </Field>
                </div>
                {/* Divider */}
                <div className="border-t border-gray-100 mb-6" />
                {/* Row 3: Final Images + Final Videos */}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Final / Approved</p>
                <div className="mb-2 flex items-start gap-1 rounded-xl border border-amber-200 bg-amber-50 p-2">
                  <div>
                    <p className="mt-1 text-xs text-amber-800">Upload media in this order <strong>Counter Sample</strong>,{" "}
                      <strong>Flat Sample</strong>, <strong>Mannequin</strong>, and a{" "}
                      <strong>Video</strong> whenever available.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Final Images">
                    <FileUploadZone
                      files={form.finalImages} onChange={files => set("finalImages", files)}
                      accept="image/*"
                      icon={<ImageIcon className="h-5 w-5" />}
                      label="Upload Final Images"
                    />
                  </Field>
                  <Field label="Final Videos">
                    <FileUploadZone
                      files={form.finalVideos} onChange={files => set("finalVideos", files)}
                      accept="video/*"
                      icon={<Video className="h-5 w-5" />}
                      label="Upload Final Videos"
                    />
                  </Field>
                </div>
              </SectionCard>
            </FormAccessGate>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setLocation("/style-orders")}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
                <button onClick={() => { void handleSave(); }} disabled={saving || !canEdit}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shadow-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : "Save Changes"}
                </button>
            </div>
          </div>}

          {/* ══ TAB 2: Products ════════════════════════════════════════════ */}
          {activeTab === "Products" && (
            <ProductsTab styleOrderId={numId} isNew={isNew} />
          )}

          {/* ══ TAB 3: Artworks ════════════════════════════════════════════ */}
          {activeTab === "Artworks" && (
            <StyleOrderArtworksTab styleOrderId={numId} isNew={isNew} />
          )}

          {/* ══ TAB: Toile ══════════════════════════════════════════════════ */}
          {activeTab === "Toile" && (
            <StyleOrderToileTab styleOrderId={numId} isNew={isNew} />
          )}

          {/* ══ TAB 4: Client Link ═════════════════════════════════════════ */}
          {activeTab === "Client Link" && isNew && <PlaceholderTab icon="🔗" label="Client Link (save order first)" />}
          {activeTab === "Client Link" && !isNew && numId && (
            <StyleClientLinkTab styleOrderId={numId} />
          )}

          {/* ══ TAB 5: Estimate ════════════════════════════════════════════ */}
          {activeTab === "Estimate" && (
            <FormAccessGate readOnly={!canEdit}>
              <div className="space-y-5">

                {/* Estimate Items */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gray-900">
                      <span className="text-sm">📊</span>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-sm font-semibold text-gray-900">Estimate Items</h2>
                      <p className="text-xs text-gray-400">Enter rates for each cost component</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3 w-full">Item</th>
                          <th className="text-right text-xs font-semibold text-gray-500 px-6 py-3 whitespace-nowrap">Rate</th>
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
                                <span className="text-xs text-gray-400">{dc.symbol}</span>
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
                                  className="p-1 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200">
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

                {/* Summary */}
                {(() => {
                  const lineItems = form.estimate.filter(it => {
                    const r = parseFloat(it.rate);
                    return !isNaN(r) && r > 0 && it.label.trim();
                  });
                  const total = lineItems.reduce((sum, it) => sum + parseFloat(it.rate), 0);
                  return (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gray-900">
                          <span className="text-sm">💰</span>
                        </div>
                        <div>
                          <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
                          <p className="text-xs text-gray-400">
                            {lineItems.length > 0
                              ? `${lineItems.length} item${lineItems.length !== 1 ? "s" : ""} · Total ${fmt(total)}`
                              : "No rates entered yet"}
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
                                <th className="text-right text-xs font-semibold text-gray-500 px-6 py-3 whitespace-nowrap">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {lineItems.map((it, i) => (
                                <tr key={i} className="hover:bg-gray-50/50">
                                  <td className="px-6 py-3 text-sm text-gray-700">{it.label}</td>
                                  <td className="px-6 py-3 text-sm text-right text-gray-900 font-medium tabular-nums">
                                    {fmt(parseFloat(it.rate))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-gray-200 bg-gray-900">
                                <td className="px-6 py-3.5 text-sm font-semibold text-[#C9B45C]">Grand Total</td>
                                <td className="px-6 py-3.5 text-sm font-bold text-right text-[#C9B45C] tabular-nums">
                                  {fmt(total)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Save */}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { void handleSave(); }} disabled={saving}
                    style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all shadow-sm">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Saving…" : "Save Estimate"}
                  </button>
                </div>
              </div>
            </FormAccessGate>
          )}

          {/* ══ TAB 6: Costing ═════════════════════════════════════════════ */}
          {activeTab === "Costing" && !isNew && (
              <StyleCostingTab
                styleOrderId={numId!}
                orderCode={orderData?.data?.orderCode}
                styleName={orderData?.data?.styleName}
                clientName={form.clientName}
              />
          )}
          {activeTab === "Costing" && isNew && <PlaceholderTab icon="💰" label="Costing (save order first)" />}

          {/* ══ TAB: Cost Sheet ════════════════════════════════════════════ */}
          {activeTab === "Cost Sheet" && isNew && <PlaceholderTab icon="📋" label="Cost Sheet (save order first)" />}
          {activeTab === "Cost Sheet" && !isNew && numId && (
            <StyleCostSheetTab
              styleOrderId={numId}
              orderCode={orderData?.data?.orderCode}
              styleName={orderData?.data?.styleName}
              clientName={form.clientName}
              quantity={form.quantity}
            />
          )}

          {/* ══ TAB: Shipping ══════════════════════════════════════════════ */}
          {activeTab === "Shipping" && isNew && <PlaceholderTab icon="🚚" label="Shipping (save order first)" />}
          {activeTab === "Shipping" && !isNew && numId && (
            <ShippingTab
              referenceType="Style"
              referenceId={numId}
              clientName={form.clientName}
              orderStatus={form.orderStatus}
              isAdmin={isAdmin}
            />
          )}

          {/* ══ TAB: Invoices ══════════════════════════════════════════════ */}
          {activeTab === "Invoices" && isNew && <PlaceholderTab icon="🧾" label="Invoices (save order first)" />}
          {activeTab === "Invoices" && !isNew && numId && (
            <LinkedInvoicesPanel type="Style" orderId={numId} orderNo={form.styleName} />
          )}

        </div>
      </div>

      {/* ── Add Department Modal ─────────────────────────────────────────── */}
      {addDeptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Department</h3>
            <input
              autoFocus
              className={inputCls}
              placeholder="Department name…"
              value={newDeptName}
              onChange={e => { setNewDeptName(e.target.value); setDeptError(""); }}
              onKeyDown={e => { if (e.key === "Enter") void handleAddDept(); }}
            />
            {deptError && <p className="text-xs text-red-500 mt-1">{deptError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAddDeptOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button onClick={() => { void handleAddDept(); }} disabled={createDept.isPending}
                style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all">
                {createDept.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      <CancelOrderModal
        open={cancelOpen}
        orderCode={isNew ? undefined : (orderData?.data?.orderCode ?? undefined)}
        onConfirm={(reason) => { void handleCancelOrder(reason); }}
        onCancel={() => setCancelOpen(false)}
      />
    </AppLayout>
  );
}
