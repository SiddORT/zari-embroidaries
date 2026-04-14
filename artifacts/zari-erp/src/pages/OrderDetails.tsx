import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Package, Scissors, Pencil, X, RefreshCw,
  ClipboardList, Hammer, Palette, DollarSign, Users, FileText,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/layout/AppLayout";
import InputField from "@/components/ui/InputField";
import { useOrder, useUpdateOrder, usePatchOrderStatus, type OrderRecord } from "@/hooks/useOrders";

const STATUS_OPTIONS = ["Pending", "In Progress", "Completed", "Cancelled"];
const COST_STATUS_OPTIONS = ["Pending", "Quoted", "Approved", "Revised"];
const APPROVAL_OPTIONS = ["Pending", "Approved", "Rejected"];
const INVOICE_OPTIONS = ["Not Issued", "Draft", "Issued", "Paid"];
const PAYMENT_OPTIONS = ["Unpaid", "Partial", "Paid"];
const PROD_MODES = ["in-house", "outsource", "hybrid"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700 border-amber-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};
const COST_COLORS: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-500 border-gray-200",
  Quoted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Revised: "bg-purple-100 text-purple-700 border-purple-200",
};
const APPROVAL_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700 border-amber-200",
  Approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
};
const INVOICE_COLORS: Record<string, string> = {
  "Not Issued": "bg-gray-100 text-gray-500 border-gray-200",
  Draft: "bg-blue-100 text-blue-700 border-blue-200",
  Issued: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function StatusBadge({ label, colorMap }: { label: string; colorMap: Record<string, string> }) {
  const cls = colorMap[label] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value || "—"}</span>
    </div>
  );
}

function Card({ icon: Icon, title, children, onEdit }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <Icon className="h-4 w-4 text-gray-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function EditModal({ title, open, onClose, onSave, saving, children }: {
  title: string;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[60vh]">{children}</div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving}
            className="px-6 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea rows={3} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 resize-none" />
    </div>
  );
}

export default function OrderDetails() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/orders/:id");
  const orderId = params?.id ? parseInt(params.id, 10) : null;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  useEffect(() => { if (!token || (!loadingUser && !user)) setLocation("/login"); }, [token, user, loadingUser, setLocation]);

  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync({}); } finally {
      localStorage.removeItem("zarierp_token");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  const { data: order, isLoading } = useOrder(orderId);
  const updateMutation = useUpdateOrder();
  const patchMutation = usePatchOrderStatus();

  type EditSection = "overview" | "making" | "artwork" | "costing" | "client" | "invoice" | null;
  const [editSection, setEditSection] = useState<EditSection>(null);

  const [overviewForm, setOverviewForm] = useState({ client: "", priority: "", assignedTo: "", deliveryDate: "", remarks: "" });
  const [makingForm, setMakingForm] = useState({ materials: "", consumption: "", artisanAssignment: "", outsourceAssignment: "" });
  const [artworkForm, setArtworkForm] = useState({ artworkHours: "", artworkRate: "", artworkFeedback: "" });
  const [costingForm, setCostingForm] = useState({ materialCost: "", artisanCost: "", outsourceCost: "", customCharges: "", totalCost: "" });
  const [clientForm, setClientForm] = useState({ clientComments: "" });
  const [invoiceForm, setInvoiceForm] = useState({ invoiceStatus: "", invoiceNumber: "", paymentStatus: "" });

  useEffect(() => {
    if (!order) return;
    setOverviewForm({
      client: order.client, priority: order.priority,
      assignedTo: order.assignedTo ?? "", deliveryDate: order.deliveryDate ?? "", remarks: order.remarks ?? "",
    });
    setMakingForm({
      materials: order.materials ?? "", consumption: order.consumption ?? "",
      artisanAssignment: order.artisanAssignment ?? "", outsourceAssignment: order.outsourceAssignment ?? "",
    });
    setArtworkForm({ artworkHours: order.artworkHours ?? "", artworkRate: order.artworkRate ?? "", artworkFeedback: order.artworkFeedback ?? "" });
    setCostingForm({
      materialCost: order.materialCost ?? "", artisanCost: order.artisanCost ?? "",
      outsourceCost: order.outsourceCost ?? "", customCharges: order.customCharges ?? "", totalCost: order.totalCost ?? "",
    });
    setClientForm({ clientComments: order.clientComments ?? "" });
    setInvoiceForm({ invoiceStatus: order.invoiceStatus, invoiceNumber: order.invoiceNumber ?? "", paymentStatus: order.paymentStatus });
  }, [order]);

  const save = async (data: Record<string, string>) => {
    if (!orderId) return;
    try {
      await updateMutation.mutateAsync({ id: orderId, data: data as unknown as Partial<OrderFormData> });
      toast({ title: "Saved", description: "Changes saved successfully." });
      setEditSection(null);
    } catch { toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" }); }
  };

  const patchStatus = async (patch: Record<string, string>) => {
    if (!orderId) return;
    try {
      await patchMutation.mutateAsync({ id: orderId, patch });
      toast({ title: "Updated", description: "Status updated." });
    } catch { toast({ title: "Error", description: "Failed to update.", variant: "destructive" }); }
  };

  const formatDate = (val: string | null | undefined) => {
    if (!val) return "—";
    try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return String(val); }
  };

  if (!user || isLoading || !order) {
    return (
      <AppLayout username={user?.username ?? ""} role={user?.role ?? ""} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </AppLayout>
    );
  }

  const saving = updateMutation.isPending;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto">

        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setLocation("/orders")}
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-gray-900 font-mono">{order.orderId}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  order.orderType === "swatch" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                }`}>
                  {order.orderType === "swatch" ? <Package className="h-3.5 w-3.5" /> : <Scissors className="h-3.5 w-3.5" />}
                  {order.orderType === "swatch" ? "Swatch Order" : "Style Order"}
                </span>
                <StatusBadge label={order.status} colorMap={STATUS_COLORS} />
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {order.client} · Created {formatDate(order.createdAt)} by {order.createdBy}
              </p>
            </div>
          </div>
        </div>

        {/* Main layout: cards + sidebar */}
        <div className="flex gap-6 items-start">

          {/* LEFT — Step cards */}
          <div className="flex-1 space-y-4">

            {/* Card 1: Order Overview */}
            <Card icon={ClipboardList} title="Order Overview" onEdit={() => setEditSection("overview")}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoRow label="Order ID" value={order.orderId} />
                <InfoRow label="Client" value={order.client} />
                <InfoRow label="Order Type" value={order.orderType === "swatch" ? "Swatch" : "Style"} />
                <InfoRow label="Priority" value={order.priority} />
                <InfoRow label="Status" value={<StatusBadge label={order.status} colorMap={STATUS_COLORS} />} />
                <InfoRow label="Assigned To" value={order.assignedTo} />
                <InfoRow label="Delivery Date" value={formatDate(order.deliveryDate)} />
                <InfoRow label="Production Mode" value={
                  <span className="capitalize">{order.productionMode}</span>
                } />
                {order.remarks && (
                  <div className="col-span-2">
                    <InfoRow label="Remarks" value={order.remarks} />
                  </div>
                )}
                {order.orderType === "swatch" && (
                  <>
                    <InfoRow label="Fabric" value={order.fabric} />
                    <InfoRow label="Quantity" value={order.quantity} />
                    <InfoRow label="Length × Width" value={order.swatchLength && order.swatchWidth ? `${order.swatchLength} × ${order.swatchWidth} cm` : null} />
                    {order.referenceSwatchId && <InfoRow label="Ref Swatch" value={order.referenceSwatchId} />}
                    {order.referenceStyleId && <InfoRow label="Ref Style" value={order.referenceStyleId} />}
                  </>
                )}
                {order.orderType === "style" && (
                  <>
                    <InfoRow label="Product" value={order.product} />
                    <InfoRow label="Pattern" value={order.pattern} />
                    {order.sizeBreakdown && <InfoRow label="Size Breakdown" value={order.sizeBreakdown} />}
                    {order.colorVariants && <InfoRow label="Color Variants" value={order.colorVariants} />}
                    {order.referenceSwatchId && <InfoRow label="Ref Swatch" value={order.referenceSwatchId} />}
                  </>
                )}
              </div>
            </Card>

            {/* Card 2: Making Process */}
            <Card icon={Hammer} title="Making Process" onEdit={() => setEditSection("making")}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoRow label="Fabric / Materials" value={order.materials} />
                <InfoRow label="Consumption" value={order.consumption} />
                <InfoRow label="Artisan Assignment" value={order.artisanAssignment} />
                <InfoRow label="Outsource Assignment" value={order.outsourceAssignment} />
              </div>
              {!order.materials && !order.artisanAssignment && (
                <p className="text-sm text-gray-400 italic">No making process details added yet. Click Edit to fill in.</p>
              )}
            </Card>

            {/* Card 3: Artwork */}
            <Card icon={Palette} title="Artwork" onEdit={() => setEditSection("artwork")}>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <InfoRow label="Artwork Hours" value={order.artworkHours} />
                <InfoRow label="Rate (₹/hr)" value={order.artworkRate} />
                <InfoRow label="Feedback Status" value={order.artworkFeedback} />
              </div>
              {!order.artworkHours && (
                <p className="text-sm text-gray-400 italic">No artwork details added yet. Click Edit to fill in.</p>
              )}
            </Card>

            {/* Card 4: Costing */}
            <Card icon={DollarSign} title="Costing" onEdit={() => setEditSection("costing")}>
              {(order.materialCost || order.artisanCost || order.outsourceCost) ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <InfoRow label="Material Cost" value={order.materialCost ? `₹${order.materialCost}` : null} />
                    <InfoRow label="Artisan Cost" value={order.artisanCost ? `₹${order.artisanCost}` : null} />
                    <InfoRow label="Outsource Cost" value={order.outsourceCost ? `₹${order.outsourceCost}` : null} />
                    <InfoRow label="Custom Charges" value={order.customCharges ? `₹${order.customCharges}` : null} />
                  </div>
                  {order.totalCost && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Total Cost</span>
                      <span className="text-lg font-bold text-gray-900">₹{order.totalCost}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No costing details added yet. Click Edit to fill in.</p>
              )}
            </Card>

            {/* Card 5: Client Centre */}
            <Card icon={Users} title="Client Centre" onEdit={() => setEditSection("client")}>
              <div className="space-y-4">
                <InfoRow label="Client Comments" value={order.clientComments} />
                {order.shareLink ? (
                  <div>
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Share Link</span>
                    <a href={order.shareLink} target="_blank" rel="noreferrer"
                      className="text-sm text-blue-600 hover:underline break-all">{order.shareLink}</a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No client centre details added yet. Click Edit to fill in.</p>
                )}
              </div>
            </Card>

            {/* Card 6: Invoice */}
            <Card icon={FileText} title="Invoice" onEdit={() => setEditSection("invoice")}>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <InfoRow label="Invoice Status" value={<StatusBadge label={order.invoiceStatus} colorMap={INVOICE_COLORS} />} />
                <InfoRow label="Invoice Number" value={order.invoiceNumber} />
                <InfoRow label="Payment Status" value={order.paymentStatus} />
              </div>
            </Card>
          </div>

          {/* RIGHT — Sticky status panel */}
          <div className="w-64 shrink-0 sticky top-24 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3.5 border-b border-gray-50 bg-gray-900">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#C9B45C]">Status Panel</h3>
              </div>

              <div className="p-4 space-y-4">
                {/* Order Status */}
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">Order Status</p>
                  <select value={order.status}
                    onChange={(e) => patchStatus({ status: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm outline-none transition focus:border-gray-400">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Cost Status */}
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">Cost Status</p>
                  <select value={order.costStatus}
                    onChange={(e) => patchStatus({ costStatus: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm outline-none transition focus:border-gray-400">
                    {COST_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Approval Status */}
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">Approval Status</p>
                  <select value={order.approvalStatus}
                    onChange={(e) => patchStatus({ approvalStatus: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm outline-none transition focus:border-gray-400">
                    {APPROVAL_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Invoice Status */}
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">Invoice Status</p>
                  <select value={order.invoiceStatus}
                    onChange={(e) => patchStatus({ invoiceStatus: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm outline-none transition focus:border-gray-400">
                    {INVOICE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Assigned Artisan</p>
                    <p className="text-sm font-medium text-gray-800">{order.artisanAssignment || "—"}</p>
                  </div>

                  {/* Production Mode toggle */}
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Production Mode</p>
                    <div className="flex flex-col gap-1">
                      {PROD_MODES.map((m) => (
                        <button key={m} type="button"
                          onClick={() => patchStatus({ productionMode: m })}
                          className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                            order.productionMode === m
                              ? "bg-gray-900 text-[#C9B45C]"
                              : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                          }`}>
                          {m === "in-house" ? "In-house" : m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Last Updated</p>
                    <p className="text-xs text-gray-600">{formatDate(order.updatedAt ?? order.createdAt)}</p>
                    {order.updatedBy && <p className="text-xs text-gray-400">{order.updatedBy}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT MODALS */}

      {/* Overview Edit */}
      <EditModal
        title="Edit Order Overview"
        open={editSection === "overview"}
        onClose={() => setEditSection(null)}
        onSave={() => save(overviewForm)}
        saving={saving}
      >
        <InputField label="Client" required value={overviewForm.client}
          onChange={(e) => setOverviewForm((f) => ({ ...f, client: e.target.value }))} />
        <SelectField label="Priority" value={overviewForm.priority}
          onChange={(v) => setOverviewForm((f) => ({ ...f, priority: v }))} options={PRIORITIES} />
        <InputField label="Assigned To" value={overviewForm.assignedTo}
          onChange={(e) => setOverviewForm((f) => ({ ...f, assignedTo: e.target.value }))} />
        <InputField label="Delivery Date" type="date" value={overviewForm.deliveryDate}
          onChange={(e) => setOverviewForm((f) => ({ ...f, deliveryDate: e.target.value }))} />
        <TextareaField label="Remarks" value={overviewForm.remarks}
          onChange={(v) => setOverviewForm((f) => ({ ...f, remarks: v }))}
          placeholder="Any special notes..." />
      </EditModal>

      {/* Making Process Edit */}
      <EditModal
        title="Edit Making Process"
        open={editSection === "making"}
        onClose={() => setEditSection(null)}
        onSave={() => save(makingForm)}
        saving={saving}
      >
        <TextareaField label="Fabric / Materials" value={makingForm.materials}
          onChange={(v) => setMakingForm((f) => ({ ...f, materials: v }))}
          placeholder="e.g. Silk base, Zari thread, Sequins" />
        <InputField label="Consumption" value={makingForm.consumption}
          onChange={(e) => setMakingForm((f) => ({ ...f, consumption: e.target.value }))}
          placeholder="e.g. 2.5 meters per piece" />
        <InputField label="Artisan Assignment" value={makingForm.artisanAssignment}
          onChange={(e) => setMakingForm((f) => ({ ...f, artisanAssignment: e.target.value }))}
          placeholder="e.g. Kamala Devi" />
        <InputField label="Outsource Assignment" value={makingForm.outsourceAssignment}
          onChange={(e) => setMakingForm((f) => ({ ...f, outsourceAssignment: e.target.value }))}
          placeholder="e.g. ABC Embroidery Works" />
      </EditModal>

      {/* Artwork Edit */}
      <EditModal
        title="Edit Artwork"
        open={editSection === "artwork"}
        onClose={() => setEditSection(null)}
        onSave={() => save(artworkForm)}
        saving={saving}
      >
        <InputField label="Artwork Hours" type="number" value={artworkForm.artworkHours}
          onChange={(e) => setArtworkForm((f) => ({ ...f, artworkHours: e.target.value }))}
          placeholder="e.g. 8" />
        <InputField label="Rate (₹/hr)" type="number" value={artworkForm.artworkRate}
          onChange={(e) => setArtworkForm((f) => ({ ...f, artworkRate: e.target.value }))}
          placeholder="e.g. 500" />
        <SelectField label="Feedback Status" value={artworkForm.artworkFeedback || "Pending"}
          onChange={(v) => setArtworkForm((f) => ({ ...f, artworkFeedback: v }))}
          options={["Pending", "Under Review", "Approved", "Revision Required"]} />
      </EditModal>

      {/* Costing Edit */}
      <EditModal
        title="Edit Costing"
        open={editSection === "costing"}
        onClose={() => setEditSection(null)}
        onSave={() => save(costingForm)}
        saving={saving}
      >
        <InputField label="Material Cost (₹)" type="number" value={costingForm.materialCost}
          onChange={(e) => setCostingForm((f) => ({ ...f, materialCost: e.target.value }))} placeholder="e.g. 5000" />
        <InputField label="Artisan Cost (₹)" type="number" value={costingForm.artisanCost}
          onChange={(e) => setCostingForm((f) => ({ ...f, artisanCost: e.target.value }))} placeholder="e.g. 3000" />
        <InputField label="Outsource Cost (₹)" type="number" value={costingForm.outsourceCost}
          onChange={(e) => setCostingForm((f) => ({ ...f, outsourceCost: e.target.value }))} placeholder="e.g. 2000" />
        <InputField label="Custom Charges (₹)" type="number" value={costingForm.customCharges}
          onChange={(e) => setCostingForm((f) => ({ ...f, customCharges: e.target.value }))} placeholder="e.g. 500" />
        <InputField label="Total Cost (₹)" type="number" value={costingForm.totalCost}
          onChange={(e) => setCostingForm((f) => ({ ...f, totalCost: e.target.value }))} placeholder="e.g. 10500" />
      </EditModal>

      {/* Client Centre Edit */}
      <EditModal
        title="Edit Client Centre"
        open={editSection === "client"}
        onClose={() => setEditSection(null)}
        onSave={() => save(clientForm)}
        saving={saving}
      >
        <TextareaField label="Client Comments" value={clientForm.clientComments}
          onChange={(v) => setClientForm((f) => ({ ...f, clientComments: v }))}
          placeholder="Client feedback, requirements, approvals..." />
      </EditModal>

      {/* Invoice Edit */}
      <EditModal
        title="Edit Invoice"
        open={editSection === "invoice"}
        onClose={() => setEditSection(null)}
        onSave={() => patchMutation.mutateAsync({ id: orderId!, patch: invoiceForm }).then(() => { toast({ title: "Saved" }); setEditSection(null); }).catch(() => { toast({ title: "Error", variant: "destructive" }); })}
        saving={patchMutation.isPending}
      >
        <SelectField label="Invoice Status" value={invoiceForm.invoiceStatus}
          onChange={(v) => setInvoiceForm((f) => ({ ...f, invoiceStatus: v }))} options={INVOICE_OPTIONS} />
        <InputField label="Invoice Number" value={invoiceForm.invoiceNumber}
          onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
          placeholder="e.g. INV-2024-001" />
        <SelectField label="Payment Status" value={invoiceForm.paymentStatus}
          onChange={(v) => setInvoiceForm((f) => ({ ...f, paymentStatus: v }))} options={PAYMENT_OPTIONS} />
      </EditModal>
    </AppLayout>
  );
}
