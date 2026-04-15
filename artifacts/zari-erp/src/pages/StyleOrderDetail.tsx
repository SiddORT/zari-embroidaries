import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Loader2, ChevronDown, Layers } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useStyleOrder, useCreateStyleOrder, useUpdateStyleOrder } from "@/hooks/useStyleOrders";

// ── Constants ─────────────────────────────────────────────────────────────────
const ORDER_STATUSES = ["Draft", "Issued", "In Production", "In Review", "Pending Approval", "Completed", "Rejected", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const DEPARTMENTS = ["Design", "Production", "Sampling", "Artwork", "Quality", "Finishing"];

const STATUS_COLORS: Record<string, string> = {
  Draft:              "text-gray-600 bg-gray-50 border-gray-200",
  Issued:             "text-blue-700 bg-blue-50 border-blue-200",
  "In Production":    "text-amber-700 bg-amber-50 border-amber-200",
  "In Review":        "text-purple-700 bg-purple-50 border-purple-200",
  "Pending Approval": "text-orange-700 bg-orange-50 border-orange-200",
  Completed:          "text-emerald-700 bg-emerald-50 border-emerald-200",
  Rejected:           "text-red-700 bg-red-50 border-red-200",
  Cancelled:          "text-gray-500 bg-gray-50 border-gray-200",
};

const TABS = [
  { label: "Basic Info",  icon: "🗂" },
  { label: "References",  icon: "🔗" },
  { label: "Products",    icon: "📦" },
  { label: "Artworks",    icon: "🎨" },
  { label: "Estimate",    icon: "📊" },
  { label: "Costing",     icon: "💰" },
  { label: "Cost Sheet",  icon: "📋" },
  { label: "Client Link", icon: "🔗" },
  { label: "Invoice",     icon: "🧾" },
];

// ── Form ──────────────────────────────────────────────────────────────────────
type FormState = {
  styleName: string;
  styleNo: string;
  clientId: string;
  clientName: string;
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
};

const EMPTY_FORM: FormState = {
  styleName: "", styleNo: "", clientId: "", clientName: "",
  quantity: "", priority: "Medium", orderStatus: "Draft",
  season: "", colorway: "", sampleSize: "", fabricType: "",
  orderIssueDate: "", deliveryDate: "", targetHours: "",
  issuedTo: "", department: "", description: "",
  internalNotes: "", clientInstructions: "", isChargeable: false,
};

// ── Shared UI helpers ─────────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400";
const selectCls = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 appearance-none cursor-pointer";

function SectionCard({ icon, title, subtitle, accentColor, children }: {
  icon: React.ReactNode; title: string; subtitle: string; accentColor: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PlaceholderTab({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-xs text-gray-400 mt-1">This tab will be built next.</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StyleOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const numId = isNew ? null : parseInt(id ?? "0");

  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();

  const { data: orderData, isLoading: loadingOrder } = useStyleOrder(numId);
  const createOrder = useCreateStyleOrder();
  const updateOrder = useUpdateStyleOrder();

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const t = parseInt(params.get("tab") ?? "0", 10);
    return !isNaN(t) && t >= 0 && t < TABS.length ? t : 0;
  });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (orderData?.data) {
      const o = orderData.data;
      setForm({
        styleName: o.styleName ?? "",
        styleNo: o.styleNo ?? "",
        clientId: o.clientId ?? "",
        clientName: o.clientName ?? "",
        quantity: o.quantity ?? "",
        priority: o.priority,
        orderStatus: o.orderStatus,
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
        isChargeable: o.isChargeable,
      });
    }
  }, [orderData]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.styleName.trim()) {
      toast({ title: "Style Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await createOrder.mutateAsync(form);
        toast({ title: "Style order created", description: res.data.orderCode });
        setLocation(`/style-orders/${res.data.id}`);
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

  const orderCode = isNew ? "New Style Order" : (orderData?.data?.orderCode ?? `#${numId}`);

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-6xl mx-auto pb-12">

        {/* ── Sticky Header ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 -mx-6 bg-[#f8f9fb]/95 backdrop-blur border-b border-gray-200">
          <div className="px-6 py-3 max-w-6xl mx-auto flex items-center gap-4">
            <button onClick={() => setLocation("/style-orders")}
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
            {/* Save — only on Basic Info and References tabs */}
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
              <button key={tab.label} onClick={() => setActiveTab(i)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === i
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">

          {/* ══ TAB 0: Basic Info ══════════════════════════════════════════ */}
          {activeTab === 0 && (
            <div className="space-y-5">

              {/* Identity */}
              <SectionCard icon={<Layers className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
                title="Identity" subtitle="Core details of this style order">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Style Name *">
                    <input className={inputCls} placeholder="e.g. Classic Kurta – Spring 2026"
                      value={form.styleName} onChange={e => set("styleName", e.target.value)} />
                  </Field>
                  <Field label="Style No">
                    <input className={inputCls} placeholder="e.g. ST-001"
                      value={form.styleNo} onChange={e => set("styleNo", e.target.value)} />
                  </Field>
                  <Field label="Client Name">
                    <input className={inputCls} placeholder="Client / Brand name"
                      value={form.clientName} onChange={e => set("clientName", e.target.value)} />
                  </Field>
                  <Field label="Quantity">
                    <input className={inputCls} placeholder="e.g. 500 pcs"
                      value={form.quantity} onChange={e => set("quantity", e.target.value)} />
                  </Field>
                  <Field label="Priority">
                    <select className={selectCls} value={form.priority} onChange={e => set("priority", e.target.value)}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Chargeable">
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" checked={form.isChargeable} onChange={e => set("isChargeable", e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 accent-gray-900" />
                      <span className="text-sm text-gray-700">Mark as chargeable</span>
                    </label>
                  </Field>
                </div>
              </SectionCard>

              {/* Scheduling */}
              <SectionCard icon={<span className="text-sm">📅</span>} accentColor="bg-blue-50"
                title="Scheduling" subtitle="Dates, assignment and timeline">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Order Issue Date">
                    <input type="date" className={inputCls} value={form.orderIssueDate} onChange={e => set("orderIssueDate", e.target.value)} />
                  </Field>
                  <Field label="Delivery Date">
                    <input type="date" className={inputCls} value={form.deliveryDate} onChange={e => set("deliveryDate", e.target.value)} />
                  </Field>
                  <Field label="Target Hours">
                    <input className={inputCls} placeholder="e.g. 48"
                      value={form.targetHours} onChange={e => set("targetHours", e.target.value)} />
                  </Field>
                  <Field label="Issued To">
                    <input className={inputCls} placeholder="Person name"
                      value={form.issuedTo} onChange={e => set("issuedTo", e.target.value)} />
                  </Field>
                  <Field label="Department">
                    <select className={selectCls} value={form.department} onChange={e => set("department", e.target.value)}>
                      <option value="">— Select —</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                </div>
              </SectionCard>

              {/* Style Attributes */}
              <SectionCard icon={<span className="text-sm">🎨</span>} accentColor="bg-purple-50"
                title="Style Attributes" subtitle="Season, colorway and fabric details">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Season">
                    <input className={inputCls} placeholder="e.g. Spring / Summer 2026"
                      value={form.season} onChange={e => set("season", e.target.value)} />
                  </Field>
                  <Field label="Colorway">
                    <input className={inputCls} placeholder="e.g. Ivory, Gold, Deep Red"
                      value={form.colorway} onChange={e => set("colorway", e.target.value)} />
                  </Field>
                  <Field label="Sample Size">
                    <input className={inputCls} placeholder="e.g. M / XL / Free Size"
                      value={form.sampleSize} onChange={e => set("sampleSize", e.target.value)} />
                  </Field>
                  <Field label="Fabric Type">
                    <input className={inputCls} placeholder="e.g. Silk, Cotton, Georgette"
                      value={form.fabricType} onChange={e => set("fabricType", e.target.value)} />
                  </Field>
                </div>
              </SectionCard>

              {/* Notes */}
              <SectionCard icon={<span className="text-sm">📝</span>} accentColor="bg-amber-50"
                title="Notes & Instructions" subtitle="Internal notes and client instructions">
                <div className="space-y-4">
                  <Field label="Description">
                    <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Describe the style…"
                      value={form.description} onChange={e => set("description", e.target.value)} />
                  </Field>
                  <Field label="Internal Notes">
                    <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Internal notes (not visible to client)…"
                      value={form.internalNotes} onChange={e => set("internalNotes", e.target.value)} />
                  </Field>
                  <Field label="Client Instructions">
                    <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Special instructions from client…"
                      value={form.clientInstructions} onChange={e => set("clientInstructions", e.target.value)} />
                  </Field>
                </div>
              </SectionCard>

            </div>
          )}

          {/* ══ TAB 1: References ══════════════════════════════════════════ */}
          {activeTab === 1 && <PlaceholderTab icon="🔗" label="References" />}

          {/* ══ TAB 2: Products ════════════════════════════════════════════ */}
          {activeTab === 2 && <PlaceholderTab icon="📦" label="Products" />}

          {/* ══ TAB 3: Artworks ════════════════════════════════════════════ */}
          {activeTab === 3 && <PlaceholderTab icon="🎨" label="Artworks" />}

          {/* ══ TAB 4: Estimate ════════════════════════════════════════════ */}
          {activeTab === 4 && <PlaceholderTab icon="📊" label="Estimate" />}

          {/* ══ TAB 5: Costing ═════════════════════════════════════════════ */}
          {activeTab === 5 && <PlaceholderTab icon="💰" label="Costing" />}

          {/* ══ TAB 6: Cost Sheet ══════════════════════════════════════════ */}
          {activeTab === 6 && <PlaceholderTab icon="📋" label="Cost Sheet" />}

          {/* ══ TAB 7: Client Link ═════════════════════════════════════════ */}
          {activeTab === 7 && <PlaceholderTab icon="🔗" label="Client Link" />}

          {/* ══ TAB 8: Invoice ═════════════════════════════════════════════ */}
          {activeTab === 8 && <PlaceholderTab icon="🧾" label="Invoice" />}

        </div>
      </div>
    </AppLayout>
  );
}
