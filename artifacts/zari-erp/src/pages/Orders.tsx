import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Trash2, Package, Scissors, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import InputField from "@/components/ui/InputField";

import {
  useOrderList,
  useCreateOrder,
  useDeleteOrder,
  type OrderRecord,
  type OrderFormData,
} from "@/hooks/useOrders";

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const PROD_MODES = ["in-house", "outsource", "hybrid"];

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-red-100 text-red-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};

const COST_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-500",
  Quoted: "bg-yellow-100 text-yellow-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Revised: "bg-purple-100 text-purple-700",
};

const APPROVAL_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

const INVOICE_COLORS: Record<string, string> = {
  "Not Issued": "bg-gray-100 text-gray-500",
  Draft: "bg-blue-100 text-blue-700",
  Issued: "bg-yellow-100 text-yellow-700",
  Paid: "bg-emerald-100 text-emerald-700",
};

function StatusPill({ label, colorMap }: { label: string; colorMap: Record<string, string> }) {
  const cls = colorMap[label] ?? "bg-gray-100 text-gray-600";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const EMPTY_FORM: OrderFormData = {
  orderType: "swatch",
  client: "",
  status: "Pending",
  priority: "Medium",
  assignedTo: "",
  deliveryDate: "",
  remarks: "",
  productionMode: "in-house",
  fabric: "",
  swatchLength: "",
  swatchWidth: "",
  quantity: "",
  referenceSwatchId: "",
  referenceStyleId: "",
  product: "",
  pattern: "",
  sizeBreakdown: "",
  colorVariants: "",
};

type FormErrors = Partial<Record<string, string>>;

export default function Orders() {
  const [, setLocation] = useLocation();
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

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useOrderList({ search: debouncedSearch, status: statusFilter, orderType: typeFilter, page, limit });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const createMutation = useCreateOrder();
  const deleteMutation = useDeleteOrder();

  const [step, setStep] = useState<1 | 2>(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<OrderFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<OrderRecord | null>(null);

  const openAdd = () => { setStep(1); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setStep(1); };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.client.trim()) e.client = "Client is required";
    if (form.orderType === "swatch" && !form.fabric?.trim()) e.fabric = "Fabric is required";
    if (form.orderType === "style" && !form.product?.trim()) e.product = "Product is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    try {
      await createMutation.mutateAsync(form);
      toast({ title: "Order Created", description: `New ${form.orderType} order created successfully.` });
      closeModal();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to create order.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: "Deleted", description: `Order ${deleteTarget.orderId} deleted.` });
      setDeleteTarget(null);
    } catch { toast({ title: "Error", description: "Failed to delete order.", variant: "destructive" }); }
  };

  const asOrd = (r: TableRow) => r as unknown as OrderRecord;

  const referenceItem = (r: OrderRecord) => {
    if (r.orderType === "swatch") return r.fabric ?? r.referenceSwatchId ?? "—";
    return r.product ?? "—";
  };

  const columns: Column[] = [
    {
      key: "srNo", label: "Sr No", className: "w-12 text-center",
      render: (r) => {
        const idx = rows.findIndex((row) => row.id === asOrd(r).id);
        return <span className="text-gray-400 text-xs font-medium">{(page - 1) * limit + (idx === -1 ? 0 : idx) + 1}</span>;
      },
    },
    {
      key: "orderId", label: "Order ID",
      render: (r) => <span className="font-mono font-semibold text-gray-900">{asOrd(r).orderId}</span>,
    },
    {
      key: "orderType", label: "Type",
      render: (r) => (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          asOrd(r).orderType === "swatch" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
        }`}>
          {asOrd(r).orderType === "swatch" ? <Package className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
          {asOrd(r).orderType === "swatch" ? "Swatch" : "Style"}
        </span>
      ),
    },
    { key: "client", label: "Client", render: (r) => <span className="text-gray-700 font-medium">{asOrd(r).client}</span> },
    { key: "referenceItem", label: "Reference Item", render: (r) => <span className="text-gray-600">{referenceItem(asOrd(r))}</span> },
    {
      key: "status", label: "Status",
      render: (r) => <StatusPill label={asOrd(r).status} colorMap={STATUS_COLORS} />,
    },
    {
      key: "priority", label: "Priority",
      render: (r) => <StatusPill label={asOrd(r).priority} colorMap={PRIORITY_COLORS} />,
    },
    { key: "assignedTo", label: "Assigned To", render: (r) => <span className="text-gray-600">{asOrd(r).assignedTo ?? "—"}</span> },
    { key: "deliveryDate", label: "Delivery Date", render: (r) => <span className="text-gray-600 whitespace-nowrap">{asOrd(r).deliveryDate ? formatDate(asOrd(r).deliveryDate) : "—"}</span> },
    {
      key: "costStatus", label: "Cost Status",
      render: (r) => <StatusPill label={asOrd(r).costStatus} colorMap={COST_STATUS_COLORS} />,
    },
    {
      key: "approvalStatus", label: "Approval",
      render: (r) => <StatusPill label={asOrd(r).approvalStatus} colorMap={APPROVAL_COLORS} />,
    },
    {
      key: "invoiceStatus", label: "Invoice",
      render: (r) => <StatusPill label={asOrd(r).invoiceStatus} colorMap={INVOICE_COLORS} />,
    },
    {
      key: "actions", label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLocation(`/orders/${asOrd(r).id}`)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => setLocation(`/orders/${asOrd(r).id}`)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(asOrd(r))}
            disabled={deleteMutation.isPending}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Orders" onAdd={openAdd} addLabel="+ Create Order" />

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by order ID, client, fabric, product..." />
          </div>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="sm:w-40 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
            <option value="all">All Types</option>
            <option value="swatch">Swatch</option>
            <option value="style">Style</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="sm:w-44 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <MasterTable
          columns={columns}
          rows={rows as unknown as TableRow[]}
          loading={isLoading}
          rowKey={(r) => asOrd(r).id}
          emptyText="No orders found. Click '+ Create Order' to create one."
          pagination={{
            page, limit, total,
            onPageChange: setPage,
            onLimitChange: (l) => { setLimit(l); setPage(1); },
          }}
        />
      </div>

      {/* Create Order Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${step >= 1 ? "bg-gray-900" : "bg-gray-200"}`} />
                  <span className={`h-2.5 w-2.5 rounded-full ${step >= 2 ? "bg-gray-900" : "bg-gray-200"}`} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {step === 1 ? "Select Order Type" : `Create ${form.orderType === "swatch" ? "Swatch" : "Style"} Order`}
                </h2>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-140px)]">

              {/* STEP 1 — type selection */}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-4">
                  {(["swatch", "style"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setForm((f) => ({ ...f, orderType: type })); setStep(2); }}
                      className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-all"
                    >
                      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-colors ${
                        type === "swatch" ? "bg-violet-100 group-hover:bg-violet-200" : "bg-sky-100 group-hover:bg-sky-200"
                      }`}>
                        {type === "swatch"
                          ? <Package className="h-7 w-7 text-violet-600" />
                          : <Scissors className="h-7 w-7 text-sky-600" />}
                      </div>
                      <div className="text-center">
                        <p className="text-base font-semibold text-gray-900 capitalize">{type}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {type === "swatch" ? "Fabric swatch with dimensions & references" : "Style order with products & patterns"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* STEP 2 — form */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* Common fields */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Order Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <InputField label="Client" required placeholder="e.g. Rajesh Fabrics" value={form.client}
                        onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} error={errors.client} />

                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">Priority</label>
                        <select value={form.priority}
                          onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                          className="rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
                          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>

                      <InputField label="Assigned To" placeholder="e.g. Kamala Devi" value={form.assignedTo ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} />

                      <InputField label="Delivery Date" type="date" value={form.deliveryDate ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))} />

                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">Production Mode</label>
                        <div className="flex gap-2">
                          {PROD_MODES.map((m) => (
                            <button key={m} type="button"
                              onClick={() => setForm((f) => ({ ...f, productionMode: m }))}
                              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all capitalize ${
                                form.productionMode === m
                                  ? "bg-gray-900 text-[#C9B45C] border-gray-900"
                                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                              }`}>
                              {m === "in-house" ? "In-house" : m.charAt(0).toUpperCase() + m.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Swatch-specific fields */}
                  {form.orderType === "swatch" && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Swatch Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <InputField label="Fabric" required placeholder="e.g. Silk, Cotton" value={form.fabric ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, fabric: e.target.value }))} error={errors.fabric} />
                        <InputField label="Quantity" placeholder="e.g. 10" type="number" value={form.quantity ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
                        <InputField label="Length (cm)" placeholder="e.g. 50" value={form.swatchLength ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, swatchLength: e.target.value }))} />
                        <InputField label="Width (cm)" placeholder="e.g. 30" value={form.swatchWidth ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, swatchWidth: e.target.value }))} />
                        <InputField label="Reference Swatch ID" placeholder="e.g. SW-001" value={form.referenceSwatchId ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, referenceSwatchId: e.target.value }))} />
                        <InputField label="Reference Style ID" placeholder="e.g. STY-001" value={form.referenceStyleId ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, referenceStyleId: e.target.value }))} />
                      </div>
                    </div>
                  )}

                  {/* Style-specific fields */}
                  {form.orderType === "style" && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Style Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <InputField label="Product" required placeholder="e.g. Lehenga Choli" value={form.product ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} error={errors.product} />
                        <InputField label="Pattern" placeholder="e.g. Floral Embroidery" value={form.pattern ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))} />
                        <div className="col-span-2">
                          <label className="text-sm font-medium text-gray-700 block mb-1.5">Size Breakdown</label>
                          <textarea rows={2} placeholder="e.g. S:2, M:3, L:2, XL:1"
                            value={form.sizeBreakdown ?? ""}
                            onChange={(e) => setForm((f) => ({ ...f, sizeBreakdown: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 resize-none" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-sm font-medium text-gray-700 block mb-1.5">Color Variants</label>
                          <textarea rows={2} placeholder="e.g. Royal Blue, Ivory White, Crimson Red"
                            value={form.colorVariants ?? ""}
                            onChange={(e) => setForm((f) => ({ ...f, colorVariants: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 resize-none" />
                        </div>
                        <InputField label="Reference Swatch ID" placeholder="e.g. SW-001" value={form.referenceSwatchId ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, referenceSwatchId: e.target.value }))} />
                      </div>
                    </div>
                  )}

                  {/* Remarks */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Remarks</label>
                    <textarea rows={2} placeholder="Any special notes..."
                      value={form.remarks ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 resize-none" />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {step === 2 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
                <button type="button" onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button type="button" onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {createMutation.isPending ? "Creating..." : "Create Order"}
                  {!createMutation.isPending && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Order"
        message={deleteTarget ? `Are you sure you want to delete order "${deleteTarget.orderId}"? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
