import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, Plus, Trash2, Info, Upload, X, FileText, Image as ImageIcon,
  User, Layers, Scissors, CalendarDays, MessageSquare, Paperclip, CheckCircle2,
  ChevronDown, Loader2,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useSwatchOrder, useCreateSwatchOrder, useUpdateSwatchOrder, type ReferenceItem, type FileAttachment } from "@/hooks/useSwatchOrders";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";
import { useAllFabrics, type FabricRecord } from "@/hooks/useFabrics";
import { useUnitTypes, useCreateUnitType, type LookupRecord } from "@/hooks/useLookups";
import AddableSelect from "@/components/ui/AddableSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useStyleList, type StyleRecord } from "@/hooks/useStyles";
import { useSwatchList, type SwatchRecord } from "@/hooks/useSwatches";

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const ORDER_STATUSES = ["Draft", "Issued", "In Sampling", "In Artwork", "Pending Approval", "Completed", "Rejected", "Cancelled"];
const DEPARTMENTS = ["Design", "Production", "Sampling", "Artwork", "Quality", "Finishing"];

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 ring-gray-300",
  Medium: "bg-sky-100 text-sky-700 ring-sky-300",
  High: "bg-orange-100 text-orange-700 ring-orange-300",
  Urgent: "bg-red-100 text-red-700 ring-red-300",
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

const FLOW_STEPS = ["Basic Info", "Artwork", "Costing"];

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

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [addUnitTypeOpen, setAddUnitTypeOpen] = useState(false);
  const [newUnitTypeName, setNewUnitTypeName] = useState("");

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

  async function handleAddUnitType() {
    if (!newUnitTypeName.trim()) return;
    try {
      await createUnitType.mutateAsync({ name: newUnitTypeName.trim() });
      set("unitType", newUnitTypeName.trim());
      setAddUnitTypeOpen(false);
    } catch {
      toast({ title: "Failed to add unit type", variant: "destructive" });
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
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">Loading…</div>
    </AppLayout>
  );

  const orderCode = isNew ? "New Order" : (orderData?.data?.orderCode ?? `#${numId}`);

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-6xl mx-auto pb-12">

        {/* ── Sticky Header ── */}
        <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-[#f8f9fb]/95 backdrop-blur border-b border-gray-200">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <button onClick={() => setLocation("/swatch-orders")}
              className="p-2 rounded-xl hover:bg-gray-200 text-gray-500 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-mono font-bold text-gray-700 bg-white border border-gray-200 px-3 py-1 rounded-lg">
                  {orderCode}
                </span>
                {/* Flow steps */}
                <div className="flex items-center gap-1 text-xs">
                  {FLOW_STEPS.map((step, i) => (
                    <div key={step} className="flex items-center gap-1">
                      <span className={`px-2.5 py-1 rounded-full font-medium ${
                        i === 0 ? "bg-gray-900 text-[#C9B45C]" : "bg-gray-100 text-gray-400"
                      }`}>{step}</span>
                      {i < FLOW_STEPS.length - 1 && <span className="text-gray-300 mx-0.5">›</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Status selector */}
            <div className="relative shrink-0">
              <select value={form.orderStatus} onChange={e => set("orderStatus", e.target.value)}
                className={`pl-3 pr-7 py-1.5 text-xs font-medium rounded-full border cursor-pointer appearance-none focus:outline-none ${STATUS_COLORS[form.orderStatus] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" />
            </div>

            <button onClick={() => { void handleSave(); }} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shrink-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-5">

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
                  onAdd={() => { setNewUnitTypeName(""); setAddUnitTypeOpen(true); }}
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

          {/* ── Section 2: References — full width ── */}
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

          {/* ── Row: Notes + Completion Tracking side by side ── */}
          <div className="grid grid-cols-2 gap-5 items-start">

            {/* ── Section 5: Notes ── */}
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

            {/* ── Section 7: Completion Tracking ── */}
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

          {/* ── Section 6: Attachments — full width ── */}
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

          {/* Bottom Save */}
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
        </div>

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
