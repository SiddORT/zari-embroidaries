import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, Loader2, ChevronDown,
  User, CalendarDays, MessageSquare, CheckCircle2, Layers,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { useAllClients } from "@/hooks/useClients";
import AddableSelect from "@/components/ui/AddableSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useStyleOrder, useCreateStyleOrder, useUpdateStyleOrder } from "@/hooks/useStyleOrders";

// ── Constants ─────────────────────────────────────────────────────────────────
const ORDER_STATUSES = ["Draft", "Issued", "In Production", "In Review", "Pending Approval", "Completed", "Rejected", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const DEPARTMENTS = ["Design", "Production", "Sampling", "Artwork", "Quality", "Finishing"];

const PRIORITY_STYLES: Record<string, string> = {
  Low:    "bg-gray-900 text-[#C9B45C] ring-gray-900",
  Medium: "bg-gray-900 text-[#C9B45C] ring-gray-900",
  High:   "bg-gray-900 text-[#C9B45C] ring-gray-900",
  Urgent: "bg-gray-900 text-[#C9B45C] ring-gray-900",
};

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
  "Basic Info", "References", "Products", "Artworks",
  "Estimate", "Costing", "Cost Sheet", "Client Link", "Invoice",
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
  styleName: "", styleNo: "", clientId: "", clientName: "",
  quantity: "", priority: "Medium", orderStatus: "Draft",
  season: "", colorway: "", sampleSize: "", fabricType: "",
  orderIssueDate: "", deliveryDate: "", targetHours: "",
  issuedTo: "", department: "", description: "",
  internalNotes: "", clientInstructions: "", isChargeable: false,
  actualStartDate: "", actualStartTime: "",
  tentativeDeliveryDate: "", actualCompletionDate: "",
  actualCompletionTime: "", delayReason: "", approvalDate: "",
  revisionCount: 0,
};

// ── Shared helpers (defined outside component to avoid re-render focus loss) ─
const inputCls = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400";

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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
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
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-xs text-gray-400 mt-1">This tab will be built next.</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
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

  const { data: clientsData } = useAllClients();
  const clients = clientsData?.data ?? [];

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
        actualStartDate: o.actualStartDate ?? "",
        actualStartTime: o.actualStartTime ?? "",
        tentativeDeliveryDate: o.tentativeDeliveryDate ?? "",
        actualCompletionDate: o.actualCompletionDate ?? "",
        actualCompletionTime: o.actualCompletionTime ?? "",
        delayReason: o.delayReason ?? "",
        approvalDate: o.approvalDate ?? "",
        revisionCount: o.revisionCount ?? 0,
      });
    }
  }, [orderData]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const clientOptions = clients.map((c: { id: number; brandName: string }) => ({
    value: String(c.id), label: c.brandName,
  }));
  const selectedClient = clients.find((c: { id: number }) => String(c.id) === form.clientId) as
    { id: number; brandName: string; contactName: string; email: string; contactNo: string; country?: string } | undefined;

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

          {/* Tab bar */}
          <div className="px-6 flex items-end gap-0 overflow-x-auto scrollbar-none">
            {TABS.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)}
                className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === i
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">

          {/* ══ TAB 0: Basic Info ══════════════════════════════════════════ */}
          {activeTab === 0 && (
            <div className="space-y-5">

              {/* ── Identity ──────────────────────────────────────────────── */}
              <SectionCard icon={<User className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
                title="Identity" subtitle="Core details of this style order">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Style Name *">
                    <input className={inputCls} placeholder="e.g. Classic Kurta – Spring 2026"
                      value={form.styleName} onChange={e => set("styleName", e.target.value)} />
                  </Field>

                  <Field label="Client">
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
                    <input className={inputCls} type="number" min="0" placeholder="e.g. 500"
                      value={form.quantity} onChange={e => set("quantity", e.target.value)} />
                  </Field>

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

              {/* ── Planning ──────────────────────────────────────────────── */}
              <SectionCard icon={<CalendarDays className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
                title="Planning" subtitle="Dates, timing and assignment details">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Order Issue Date">
                    <input type="date" className={inputCls} value={form.orderIssueDate} onChange={e => set("orderIssueDate", e.target.value)} />
                  </Field>
                  <Field label="Delivery Date">
                    <input type="date" className={inputCls} value={form.deliveryDate} onChange={e => set("deliveryDate", e.target.value)} />
                  </Field>
                  <Field label="Target Hours" hint="Estimated production hours">
                    <input type="number" min="0" step="0.5" className={inputCls} placeholder="e.g. 48"
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
                  <Field label="Issued To">
                    <input className={inputCls} placeholder="Artisan / Team member name"
                      value={form.issuedTo} onChange={e => set("issuedTo", e.target.value)} />
                  </Field>
                </div>
              </SectionCard>

              {/* ── Notes + Completion Tracking side by side ──────────────── */}
              <div className="grid grid-cols-2 gap-5 items-start">

                {/* Notes */}
                <SectionCard icon={<MessageSquare className="h-4 w-4 text-[#C9B45C]" />} accentColor="bg-gray-900"
                  title="Notes" subtitle="Description, internal remarks and client instructions">
                  <div className="space-y-4">
                    <Field label="Description">
                      <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Brief description of this style order…"
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
                    <Field label="Delay Reason" hint="Explain if order was delayed beyond delivery date">
                      <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Reason for any delay (optional)…"
                        value={form.delayReason} onChange={e => set("delayReason", e.target.value)} />
                    </Field>
                  </div>
                </SectionCard>
              </div>

              {/* Bottom Save */}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setLocation("/style-orders")}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button onClick={() => { void handleSave(); }} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shadow-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : (isNew ? "Create Style Order" : "Save Changes")}
                </button>
              </div>
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
