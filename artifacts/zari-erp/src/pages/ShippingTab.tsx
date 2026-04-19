import { useState, useEffect, useCallback } from "react";
import { Truck, Plus, Edit2, ExternalLink, Package, Loader2, Save, X, RefreshCw } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import ZariButton from "@/components/ui/ZariButton";
import ConfirmModal from "@/components/ui/ConfirmModal";

const G = "#C6AF4B";

const STATUSES = ["Pending","Dispatched","In Transit","Delivered","Returned","Cancelled"];
const STATUS_COLORS: Record<string, string> = {
  Pending:     "bg-gray-50 text-gray-600 border-gray-200",
  Dispatched:  "bg-blue-50 text-blue-700 border-blue-200",
  "In Transit":"bg-amber-50 text-amber-700 border-amber-200",
  Delivered:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Returned:    "bg-orange-50 text-orange-700 border-orange-200",
  Cancelled:   "bg-red-50 text-red-600 border-red-200",
};

interface Vendor {
  id: number;
  vendor_name: string;
  weight_rate_per_kg: string;
  minimum_charge: string;
}

interface ShippingRecord {
  id: number;
  reference_type: string;
  reference_id: number;
  client_name: string | null;
  shipping_vendor_id: number | null;
  vendor_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipment_weight: string;
  rate_per_kg: string;
  calculated_shipping_amount: string;
  manual_shipping_amount_override: string | null;
  final_shipping_amount: string;
  shipment_status: string;
  shipment_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  remarks: string | null;
}

const EMPTY_FORM = {
  shipping_vendor_id: "",
  tracking_number: "",
  tracking_url: "",
  shipment_weight: "",
  manual_shipping_amount_override: "",
  shipment_status: "Pending",
  shipment_date: "",
  expected_delivery_date: "",
  actual_delivery_date: "",
  remarks: "",
};

interface Props {
  referenceType: "Swatch" | "Style";
  referenceId: number;
  clientName?: string;
  orderStatus: string;
  isAdmin: boolean;
}

export default function ShippingTab({ referenceType, referenceId, clientName, orderStatus, isAdmin }: Props) {
  const { toast } = useToast();
  const [records, setRecords] = useState<ShippingRecord[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShippingRecord | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<number | null>(null);

  // Auto-calculated preview
  const selectedVendor = vendors.find(v => String(v.id) === form.shipping_vendor_id);
  const weight = parseFloat(form.shipment_weight) || 0;
  const ratePerKg = parseFloat(selectedVendor?.weight_rate_per_kg ?? "0");
  const minCharge = parseFloat(selectedVendor?.minimum_charge ?? "0");
  const calcAmount = selectedVendor && weight > 0 ? Math.max(weight * ratePerKg, minCharge) : 0;
  const override = parseFloat(form.manual_shipping_amount_override) || 0;
  const finalAmount = override > 0 ? override : calcAmount;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detailsRes, vendorRes] = await Promise.all([
        customFetch<any>(`/api/shipping/details/by-reference?referenceType=${referenceType}&referenceId=${referenceId}`),
        customFetch<any>(`/api/shipping/vendors`),
      ]);
      setRecords(detailsRes.data);
      setVendors(vendorRes.data);
    } catch (err: any) {
      toast({ title: "Error loading shipping", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [referenceType, referenceId]);

  useEffect(() => { load(); }, [load]);

  const canAdd = orderStatus === "Approved" || orderStatus === "Completed";

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(r: ShippingRecord) {
    setEditing(r);
    setForm({
      shipping_vendor_id: r.shipping_vendor_id ? String(r.shipping_vendor_id) : "",
      tracking_number: r.tracking_number ?? "",
      tracking_url: r.tracking_url ?? "",
      shipment_weight: r.shipment_weight,
      manual_shipping_amount_override: r.manual_shipping_amount_override ?? "",
      shipment_status: r.shipment_status,
      shipment_date: r.shipment_date ?? "",
      expected_delivery_date: r.expected_delivery_date ?? "",
      actual_delivery_date: r.actual_delivery_date ?? "",
      remarks: r.remarks ?? "",
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.shipping_vendor_id) e.shipping_vendor_id = "Shipping vendor is required";
    if (!form.shipment_weight || parseFloat(form.shipment_weight) <= 0) e.shipment_weight = "Weight must be greater than 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        reference_type: referenceType,
        reference_id: referenceId,
        client_name: clientName ?? null,
        shipping_vendor_id: parseInt(form.shipping_vendor_id),
        shipment_weight: parseFloat(form.shipment_weight),
        manual_shipping_amount_override: form.manual_shipping_amount_override ? parseFloat(form.manual_shipping_amount_override) : null,
      };
      if (editing) {
        await customFetch(`/api/shipping/details/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast({ title: "Shipping details updated successfully" });
      } else {
        await customFetch(`/api/shipping/details`, { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Shipping details added successfully" });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      const clean = err.message?.replace(/^HTTP \d{3}[^:]*:\s*/, "") ?? err.message;
      toast({ title: "Error", description: clean, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusUpdate(id: number, status: string) {
    setStatusUpdating(id);
    try {
      await customFetch(`/api/shipping/details/${id}/status`, { method: "PATCH", body: JSON.stringify({ shipment_status: status }) });
      toast({ title: "Shipment status updated successfully" });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setStatusUpdating(null);
    }
  }

  async function handleDelete(id: number) {
    try {
      await customFetch(`/api/shipping/details/${id}`, { method: "DELETE" });
      toast({ title: "Shipping record deleted" });
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const fmt = (n: string | number) => parseFloat(String(n)).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
  const inp = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20 transition";
  const sel = inp + " appearance-none cursor-pointer";

  return (
    <div className="space-y-5 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={18} style={{ color: G }} />
          <h3 className="font-bold text-gray-900">Shipping Details</h3>
          {!canAdd && (
            <span className="ml-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Available after order is Approved
            </span>
          )}
        </div>
        {canAdd && (
          <ZariButton onClick={openCreate}>
            <Plus size={14} /> Add Shipping Details
          </ZariButton>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
      ) : records.length === 0 ? (
        <div className={`${card} p-10 text-center`}>
          <Package size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No shipping details yet</p>
          {canAdd && <p className="text-xs text-gray-400 mt-1">Click "Add Shipping Details" to log a shipment</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(r => (
            <div key={r.id} className={`${card} p-5`}>
              {/* Card header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl" style={{ background: `${G}18` }}>
                    <Truck size={16} style={{ color: G }} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{r.vendor_name ?? "Unknown Vendor"}</p>
                    {r.tracking_number && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-mono text-xs text-gray-500">{r.tracking_number}</span>
                        {r.tracking_url && (
                          <a href={r.tracking_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Status dropdown */}
                  <select
                    value={r.shipment_status}
                    onChange={e => handleStatusUpdate(r.id, e.target.value)}
                    disabled={statusUpdating === r.id}
                    className={`text-xs font-semibold rounded-full px-3 py-1 border cursor-pointer appearance-none focus:outline-none ${STATUS_COLORS[r.shipment_status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  {isAdmin && (
                    <button onClick={() => setDeleteTarget(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-300 hover:text-red-500 transition" title="Delete">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                  { label: "Weight", value: `${parseFloat(r.shipment_weight).toFixed(3)} kg` },
                  { label: "Rate/KG", value: `₹${fmt(r.rate_per_kg)}` },
                  { label: "Calculated Cost", value: `₹${fmt(r.calculated_shipping_amount)}` },
                  { label: "Final Cost", value: `₹${fmt(r.final_shipping_amount)}`, highlight: true },
                  { label: "Shipment Date", value: fmtDate(r.shipment_date) },
                  { label: "Expected Delivery", value: fmtDate(r.expected_delivery_date) },
                  { label: "Actual Delivery", value: fmtDate(r.actual_delivery_date) },
                  ...(r.manual_shipping_amount_override ? [{ label: "Override Amount", value: `₹${fmt(r.manual_shipping_amount_override)}` }] : []),
                ].map(({ label, value, highlight }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
                    <p className={`text-sm mt-0.5 ${highlight ? "font-bold" : "text-gray-700"}`} style={highlight ? { color: G } : undefined}>{value}</p>
                  </div>
                ))}
              </div>

              {r.remarks && (
                <p className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-3">{r.remarks}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Shipment"
          message="Are you sure you want to delete this shipping record? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className={`${card} w-full max-w-lg my-6`}>
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Shipping Details" : "Add Shipping Details"}</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Vendor */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Shipping Vendor *</label>
                <select value={form.shipping_vendor_id} onChange={e => setForm(f => ({ ...f, shipping_vendor_id: e.target.value }))} className={sel}>
                  <option value="">Select vendor…</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name} (₹{parseFloat(v.weight_rate_per_kg).toFixed(2)}/kg)</option>)}
                </select>
                {errors.shipping_vendor_id && <p className="text-red-500 text-xs mt-1">{errors.shipping_vendor_id}</p>}
              </div>

              {/* Tracking */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tracking Number</label>
                  <input value={form.tracking_number} onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))} className={inp} placeholder="AWB / Docket no." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tracking URL</label>
                  <input value={form.tracking_url} onChange={e => setForm(f => ({ ...f, tracking_url: e.target.value }))} className={inp} placeholder="https://..." />
                </div>
              </div>

              {/* Weight & cost */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Shipment Weight (kg) *</label>
                  <input value={form.shipment_weight} onChange={e => setForm(f => ({ ...f, shipment_weight: e.target.value }))} className={inp} type="number" step="0.001" placeholder="0.000" />
                  {errors.shipment_weight && <p className="text-red-500 text-xs mt-1">{errors.shipment_weight}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Manual Override (₹)</label>
                  <input value={form.manual_shipping_amount_override} onChange={e => setForm(f => ({ ...f, manual_shipping_amount_override: e.target.value }))} className={inp} type="number" step="0.01" placeholder="Leave blank to auto-calculate" />
                </div>
              </div>

              {/* Cost preview */}
              {selectedVendor && weight > 0 && (
                <div className="rounded-xl bg-[#C6AF4B]/8 border border-[#C6AF4B]/20 px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cost Calculation</p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><p className="text-xs text-gray-400">Calculated</p><p className="font-medium text-gray-700">₹{calcAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p></div>
                    <div><p className="text-xs text-gray-400">Override</p><p className="font-medium text-gray-700">{override > 0 ? `₹${override.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}</p></div>
                    <div><p className="text-xs text-gray-400">Final Amount</p><p className="font-bold" style={{ color: G }}>₹{finalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p></div>
                  </div>
                  {minCharge > 0 && calcAmount === minCharge && <p className="text-xs text-amber-600 mt-1">Minimum charge of ₹{minCharge.toLocaleString("en-IN")} applied</p>}
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Shipment Status</label>
                <select value={form.shipment_status} onChange={e => setForm(f => ({ ...f, shipment_status: e.target.value }))} className={sel}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Shipment Date", key: "shipment_date" },
                  { label: "Expected Delivery", key: "expected_delivery_date" },
                  { label: "Actual Delivery", key: "actual_delivery_date" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
                    <input type="date" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className={inp} />
                  </div>
                ))}
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Remarks</label>
                <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={inp + " resize-none"} rows={2} placeholder="Optional notes…" />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-gray-100">
              <ZariButton variant="secondary" onClick={() => setModalOpen(false)}>Cancel</ZariButton>
              <ZariButton loading={saving} onClick={handleSave}>
                <Save size={14} /> {editing ? "Update" : "Save Shipping Details"}
              </ZariButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
