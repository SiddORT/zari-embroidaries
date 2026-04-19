import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Plus, Trash2, Save, CheckCircle2, XCircle, Clock,
  ShoppingCart, PackageCheck, Building2, CreditCard,
  Phone, Mail, MapPin, BadgePercent,
} from "lucide-react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

const G     = "#C6AF4B";
const G_DIM = "#A8943E";
const card  = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";

const STATUS_MAP: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  Draft:               { label: "Draft",             color: "bg-gray-100 text-gray-700",   Icon: Clock },
  Approved:            { label: "Approved",           color: "bg-blue-100 text-blue-700",   Icon: CheckCircle2 },
  "Partially Received":{ label: "Partially Received", color: "bg-amber-100 text-amber-700", Icon: PackageCheck },
  Closed:              { label: "Closed",             color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  Cancelled:           { label: "Cancelled",          color: "bg-red-100 text-red-700",     Icon: XCircle },
};

interface InventoryOption {
  id: number;
  item_name: string;
  item_code: string;
  source_type: string;
  unit_type: string | null;
  available_stock: string;
  average_price: string;
  hsn_code: string | null;
  gst_percent: string | null;
}

interface Vendor {
  id: number;
  brandName: string;
  vendorCode: string;
  contactName: string | null;
  email: string | null;
  contactNo: string | null;
  hasGst: boolean;
  gstNo: string | null;
  bankName: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  bankAccounts: Array<{ bankName: string; accountNo: string; ifscCode?: string }> | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

type ItemCategory = "all" | "fabric" | "material" | "packaging";

interface LineItem {
  key: string;
  itemCategory: ItemCategory;
  inventoryItemId: number | null;
  itemName: string;
  itemCode: string;
  unitType: string;
  availableStock: string;
  hsnCode: string;
  gstPercent: string;
  orderedQuantity: string;
  targetPrice: string;
  remarks: string;
}

interface POItem {
  id: number;
  inventory_item_id: number;
  item_name: string;
  item_code: string;
  ordered_quantity: string;
  received_quantity: string;
  pending_quantity: string;
  unit_price: string;
  unit_type: string | null;
  warehouse_location: string | null;
}

interface PODetail {
  id: number;
  po_number: string;
  vendor_id: number;
  vendor_name: string;
  po_date: string;
  status: string;
  reference_type: string;
  reference_id: number | null;
  notes: string | null;
  created_by: string;
  items: POItem[];
}

function mkKey() { return Math.random().toString(36).slice(2); }

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseOrderForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const poId = isNew ? null : parseInt(params.id ?? "0");

  const { data: me, isError } = useGetMe();
  const token = localStorage.getItem("zarierp_token");
  const queryClient = useQueryClient();
  const { mutateAsync: logoutMutate } = useLogout();
  const { toast } = useToast();

  const handleLogout = async () => {
    await logoutMutate(undefined).catch(() => {});
    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
    localStorage.removeItem("zarierp_token");
    navigate("/login");
  };

  const [po, setPo] = useState<PODetail | null>(null);
  const [loadingPo, setLoadingPo] = useState(!isNew);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryOption[]>([]);

  // Form state
  const [vendorId, setVendorId]           = useState<number | "">("");
  const [poDate, setPoDate]               = useState(new Date().toISOString().slice(0, 10));
  const [referenceType, setReferenceType] = useState("Inventory");
  const [referenceId, setReferenceId]     = useState("");
  const [notes, setNotes]                 = useState("");
  const [includeGst, setIncludeGst]       = useState(false);
  const [lineItems, setLineItems]         = useState<LineItem[]>([
    { key: mkKey(), itemCategory: "all", inventoryItemId: null, itemName: "", itemCode: "", unitType: "", availableStock: "0", hsnCode: "", gstPercent: "0", orderedQuantity: "", targetPrice: "", remarks: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning]   = useState(false);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  useEffect(() => {
    if (!token) return;
    customFetch(`/api/vendors?limit=500&_t=${Date.now()}`)
      .then((r: unknown) => setVendors((r as { data: Vendor[] }).data ?? []))
      .catch(() => {});
    customFetch(`/api/inventory/items?limit=500&sort=item_name&order=asc&_t=${Date.now()}`)
      .then((r: unknown) => setInventoryItems((r as { data: InventoryOption[] }).data ?? []))
      .catch(() => {});
  }, [token]);

  const loadPo = useCallback(() => {
    if (!poId || !token) return;
    setLoadingPo(true);
    customFetch(`/api/procurement/purchase-orders/${poId}`)
      .then((r: unknown) => setPo(r as PODetail))
      .catch(() => toast({ title: "Failed to load PO", variant: "destructive" }))
      .finally(() => setLoadingPo(false));
  }, [poId, token, toast]);

  useEffect(() => { if (!isNew) loadPo(); }, [isNew, loadPo]);

  const addLine = () => setLineItems(ls => [
    ...ls,
    { key: mkKey(), itemCategory: "all", inventoryItemId: null, itemName: "", itemCode: "", unitType: "", availableStock: "0", hsnCode: "", gstPercent: "0", orderedQuantity: "", targetPrice: "", remarks: "" },
  ]);

  const removeLine = (key: string) => setLineItems(ls => ls.filter(l => l.key !== key));

  const updateLine = (key: string, field: keyof LineItem, value: string | number | null) =>
    setLineItems(ls => ls.map(l => l.key === key ? { ...l, [field]: value } : l));

  const selectItem = (key: string, item: InventoryOption | null) => {
    setLineItems(ls => ls.map(l => l.key === key ? {
      ...l,
      inventoryItemId: item?.id ?? null,
      itemName: item?.item_name ?? "",
      itemCode: item?.item_code ?? "",
      unitType: item?.unit_type ?? "",
      availableStock: item?.available_stock ?? "0",
      targetPrice: item ? parseFloat(item.average_price).toFixed(2) : "",
      hsnCode: item?.hsn_code ?? "",
      gstPercent: item?.gst_percent ?? "0",
    } : l));
  };

  const itemsForCategory = (cat: ItemCategory) => {
    if (cat === "all") return inventoryItems;
    return inventoryItems.filter(i => i.source_type === cat);
  };

  // Totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalGst = 0;
    let itemCount = 0;
    for (const l of lineItems) {
      const qty   = parseFloat(l.orderedQuantity) || 0;
      const price = parseFloat(l.targetPrice) || 0;
      const gst   = parseFloat(l.gstPercent) || 0;
      const lineAmt = qty * price;
      if (qty > 0 && price > 0) itemCount++;
      subtotal += lineAmt;
      if (includeGst) totalGst += lineAmt * gst / 100;
    }
    return { subtotal, totalGst, grand: subtotal + totalGst, itemCount };
  }, [lineItems, includeGst]);

  const handleApprove = async () => {
    if (!po) return;
    setActioning(true);
    try {
      await customFetch(`/api/procurement/purchase-orders/${po.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });
      toast({ title: "Purchase Order approved" });
      loadPo();
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to approve", variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const handleCreatePr = () => {
    if (!po) return;
    navigate(`/procurement/purchase-receipts/new?poId=${po.id}`);
  };

  const handleSubmit = async () => {
    if (!vendorId) { toast({ title: "Select a vendor", variant: "destructive" }); return; }
    const validItems = lineItems.filter(l => l.inventoryItemId && parseFloat(l.orderedQuantity) > 0);
    if (!validItems.length) { toast({ title: "Add at least one item with quantity", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const body = {
        vendorId: Number(vendorId),
        vendorName: selectedVendor?.brandName ?? "",
        poDate,
        referenceType,
        notes: referenceType === "Swatch" || referenceType === "Style"
          ? `${referenceType} Ref: ${referenceId}`
          : notes,
        includeGst,
        items: validItems.map(l => ({
          inventoryItemId: l.inventoryItemId,
          itemName: l.itemName,
          itemCode: l.itemCode,
          orderedQuantity: parseFloat(l.orderedQuantity),
          unitPrice: parseFloat(l.targetPrice) || 0,
          hsnCode: l.hsnCode || null,
          gstPercent: parseFloat(l.gstPercent) || 0,
          remarks: l.remarks || null,
        })),
      };
      const r = await customFetch("/api/procurement/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }) as { data: { id: number } };
      toast({ title: "Purchase Order created" });
      navigate(`/procurement/purchase-orders/${r.data.id}`);
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to create PO", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── VIEW mode ─────────────────────────────────────────────────────────────

  if (!isNew) {
    if (loadingPo) {
      return (
        <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
          <TopNavbar username={(me as any)?.name ?? ""} role={(me as any)?.role ?? ""} onLogout={handleLogout} isLoggingOut={false} />
          <div className="flex items-center justify-center h-64">
            <div className="h-8 w-8 rounded-full border-2 border-[#C6AF4B] border-t-transparent animate-spin" />
          </div>
        </div>
      );
    }
    if (!po) return null;

    const statusInfo = STATUS_MAP[po.status] ?? STATUS_MAP.Draft;
    const canApprove  = po.status === "Draft";
    const canCreatePr = ["Approved", "Partially Received"].includes(po.status);
    const totalOrdered  = po.items.reduce((s, i) => s + parseFloat(i.ordered_quantity), 0);
    const totalReceived = po.items.reduce((s, i) => s + parseFloat(i.received_quantity), 0);
    const totalPending  = Math.max(0, totalOrdered - totalReceived);

    return (
      <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
        <TopNavbar username={(me as any)?.name ?? ""} role={(me as any)?.role ?? ""} onLogout={handleLogout} isLoggingOut={false} />
        <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/procurement/purchase-orders")}
                className="p-2 rounded-xl hover:bg-[#C6AF4B]/10 transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-gray-900">{po.po_number}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusInfo.color}`}>
                    <statusInfo.Icon className="h-3 w-3" /> {statusInfo.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{po.vendor_name} · {po.reference_type}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canApprove && (
                <button onClick={handleApprove} disabled={actioning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
                  <CheckCircle2 className="h-4 w-4" /> {actioning ? "Approving…" : "Approve PO"}
                </button>
              )}
              {canCreatePr && (
                <button onClick={handleCreatePr}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#059669,#047857)" }}>
                  <PackageCheck className="h-4 w-4" /> Create Receipt
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Ordered", value: totalOrdered.toFixed(3), color: "text-gray-900" },
              { label: "Total Received", value: totalReceived.toFixed(3), color: "text-green-700" },
              { label: "Total Pending", value: totalPending.toFixed(3), color: totalPending > 0 ? "text-amber-600" : "text-gray-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`${card} p-4`}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className={`${card} p-5`}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Order Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                ["PO Number", po.po_number],
                ["Vendor", po.vendor_name],
                ["Source", po.reference_type],
                ["Date", new Date(po.po_date).toLocaleDateString("en-IN")],
                ["Created By", po.created_by],
                ["Notes", po.notes ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-gray-900 mt-0.5 font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={card}>
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Order Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F8F6F0]">
                  <tr>
                    {["#","Item","Code","Unit","Ordered","Received","Pending","Target Price"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {po.items.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No items on this PO (costing-linked PO)</td></tr>
                  ) : po.items.map((item, i) => {
                    const pct = parseFloat(item.ordered_quantity) > 0
                      ? Math.min(100, (parseFloat(item.received_quantity) / parseFloat(item.ordered_quantity)) * 100)
                      : 0;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-xs text-gray-400">{i+1}</td>
                        <td className="px-3 py-3 text-sm font-medium text-gray-900">{item.item_name}</td>
                        <td className="px-3 py-3 text-xs font-mono text-gray-500">{item.item_code}</td>
                        <td className="px-3 py-3 text-xs text-gray-500">{item.unit_type ?? "—"}</td>
                        <td className="px-3 py-3 text-sm font-mono">{parseFloat(item.ordered_quantity).toFixed(3)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-green-700">{parseFloat(item.received_quantity).toFixed(3)}</span>
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: G }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-sm font-mono font-semibold ${parseFloat(item.pending_quantity) > 0 ? "text-amber-600" : "text-gray-400"}`}>
                            {Math.max(0, parseFloat(item.pending_quantity)).toFixed(3)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs font-mono text-gray-500">₹{parseFloat(item.unit_price).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── CREATE mode ────────────────────────────────────────────────────────────

  const inputCls = "w-full px-2.5 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30";

  return (
    <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
      <TopNavbar username={(me as any)?.name ?? ""} role={(me as any)?.role ?? ""} onLogout={handleLogout} isLoggingOut={false} />
      <div className="max-w-[1280px] mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/procurement/purchase-orders")}
            className="p-2 rounded-xl hover:bg-[#C6AF4B]/10 transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" style={{ color: G }} />
              <h1 className="text-xl font-bold text-gray-900">New Purchase Order</h1>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Create a procurement purchase order</p>
          </div>
        </div>

        {/* Order Info */}
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Order Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">

            {/* Vendor */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor <span className="text-red-500">*</span></label>
              <select value={vendorId}
                onChange={e => {
                  const id = Number(e.target.value);
                  setVendorId(id || "");
                  const v = vendors.find(v => v.id === id) ?? null;
                  setSelectedVendor(v);
                }}
                className={`${inputCls} bg-white appearance-none`}>
                <option value="">Select vendor…</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.brandName}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">PO Date</label>
              <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reference Type</label>
              <select value={referenceType} onChange={e => { setReferenceType(e.target.value); setReferenceId(""); }}
                className={`${inputCls} bg-white appearance-none`}>
                <option value="Inventory">Inventory</option>
                <option value="Swatch">Swatch</option>
                <option value="Style">Style</option>
                <option value="Manual">Manual</option>
              </select>
            </div>

            {(referenceType === "Swatch" || referenceType === "Style") ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {referenceType} ID <span className="text-red-500">*</span>
                </label>
                <input type="text" value={referenceId} onChange={e => setReferenceId(e.target.value)}
                  placeholder={`Enter ${referenceType} ID…`} className={inputCls} />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Optional notes…" className={inputCls} />
              </div>
            )}
          </div>

          {/* GST toggle */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
            <BadgePercent className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700 font-medium">GST Applicable?</span>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button type="button"
                onClick={() => setIncludeGst(false)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  !includeGst ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                Without GST
              </button>
              <button type="button"
                onClick={() => setIncludeGst(true)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  includeGst ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                With GST (as per HSN)
              </button>
            </div>
            {includeGst && (
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                GST will be calculated per item based on its HSN code
              </span>
            )}
          </div>
        </div>

        {/* Vendor Details Card */}
        {selectedVendor && (
          <div className={`${card} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-4 w-4" style={{ color: G }} />
              <h3 className="text-sm font-semibold text-gray-700">Vendor Details</h3>
              <span className="text-xs text-gray-400 font-mono">{selectedVendor.vendorCode}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Business Name</p>
                <p className="text-sm font-semibold text-gray-900">{selectedVendor.brandName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Contact Person</p>
                <p className="text-sm text-gray-800">{selectedVendor.contactName ?? "—"}</p>
              </div>
              {selectedVendor.gstNo && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">GSTIN</p>
                  <p className="text-sm font-mono text-gray-800">{selectedVendor.gstNo}</p>
                </div>
              )}
              {!selectedVendor.hasGst && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">GST</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">Unregistered</span>
                </div>
              )}
              {(selectedVendor.contactNo || selectedVendor.email) && (
                <div className="flex flex-col gap-1">
                  {selectedVendor.contactNo && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <Phone className="h-3.5 w-3.5 text-gray-400" /> {selectedVendor.contactNo}
                    </div>
                  )}
                  {selectedVendor.email && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <Mail className="h-3.5 w-3.5 text-gray-400" /> {selectedVendor.email}
                    </div>
                  )}
                </div>
              )}
              {(selectedVendor.address1 || selectedVendor.city) && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700">
                    {[selectedVendor.address1, selectedVendor.city, selectedVendor.state, selectedVendor.pincode]
                      .filter(Boolean).join(", ")}
                  </p>
                </div>
              )}
              {selectedVendor.bankName && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Bank</p>
                  <div className="flex items-center gap-1.5 text-sm text-gray-700">
                    <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                    <span>{selectedVendor.bankName}</span>
                    {selectedVendor.accountNo && <span className="font-mono text-xs">· {selectedVendor.accountNo}</span>}
                  </div>
                  {selectedVendor.ifscCode && (
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">IFSC: {selectedVendor.ifscCode}</p>
                  )}
                </div>
              )}
              {selectedVendor.bankAccounts?.length && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-1">Bank Accounts</p>
                  {selectedVendor.bankAccounts.map((ba, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-sm text-gray-700 mt-0.5">
                      <CreditCard className="h-3 w-3 text-gray-400" />
                      <span>{ba.bankName}</span>
                      <span className="font-mono text-xs">· {ba.accountNo}</span>
                      {ba.ifscCode && <span className="text-xs text-gray-400">{ba.ifscCode}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Line Items */}
        <div className={card}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Order Items</h3>
            <button onClick={addLine}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8F6F0]">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-8">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-32">Category</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 min-w-[200px]">Item</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-20">Unit</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">Ordered Qty</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">Target Price (₹)</th>
                  {includeGst && <>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-24">HSN Code</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-20">GST %</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">GST Amt</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">Total</th>
                  </>}
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lineItems.map((line, idx) => {
                  const qty   = parseFloat(line.orderedQuantity) || 0;
                  const price = parseFloat(line.targetPrice) || 0;
                  const gstPct = parseFloat(line.gstPercent) || 0;
                  const lineAmt = qty * price;
                  const gstAmt  = includeGst ? lineAmt * gstPct / 100 : 0;
                  const lineTotal = lineAmt + gstAmt;

                  return (
                    <tr key={line.key}>
                      <td className="px-3 py-2 text-xs text-gray-400">{idx+1}</td>

                      {/* Category */}
                      <td className="px-3 py-2">
                        <select
                          value={line.itemCategory}
                          onChange={e => {
                            updateLine(line.key, "itemCategory", e.target.value as ItemCategory);
                            selectItem(line.key, null);
                          }}
                          className={`${inputCls} bg-white appearance-none text-xs`}>
                          <option value="all">All</option>
                          <option value="fabric">Fabric</option>
                          <option value="material">Material</option>
                          <option value="packaging">Item Master</option>
                        </select>
                      </td>

                      {/* Item */}
                      <td className="px-3 py-2">
                        <select
                          value={line.inventoryItemId ?? ""}
                          onChange={e => {
                            const id = parseInt(e.target.value);
                            const item = inventoryItems.find(i => i.id === id) ?? null;
                            selectItem(line.key, item);
                          }}
                          className={`${inputCls} bg-white appearance-none`}>
                          <option value="">— Select item —</option>
                          {itemsForCategory(line.itemCategory).map(item => (
                            <option key={item.id} value={item.id}>{item.item_name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{line.unitType || "—"}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.001"
                          value={line.orderedQuantity}
                          onChange={e => updateLine(line.key, "orderedQuantity", e.target.value)}
                          className={`${inputCls} text-right`} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01"
                          value={line.targetPrice}
                          onChange={e => updateLine(line.key, "targetPrice", e.target.value)}
                          className={`${inputCls} text-right`} />
                      </td>
                      {includeGst && <>
                        <td className="px-3 py-2">
                          <input type="text"
                            value={line.hsnCode}
                            onChange={e => updateLine(line.key, "hsnCode", e.target.value)}
                            placeholder="HSN…"
                            className={inputCls} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" max="100" step="0.01"
                            value={line.gstPercent}
                            onChange={e => updateLine(line.key, "gstPercent", e.target.value)}
                            className={`${inputCls} text-right`} />
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-amber-600 text-right pr-4">
                          {gstAmt > 0 ? `₹${fmt(gstAmt)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs font-mono font-semibold text-gray-900 text-right pr-4">
                          {lineTotal > 0 ? `₹${fmt(lineTotal)}` : "—"}
                        </td>
                      </>}
                      <td className="px-3 py-2">
                        {lineItems.length > 1 && (
                          <button onClick={() => removeLine(line.key)}
                            className="p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          {(totals.subtotal > 0 || lineItems.length > 1) && (
            <div className="border-t border-gray-100 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    {totals.itemCount} item{totals.itemCount !== 1 ? "s" : ""}
                  </span>
                  <span>with quantity entered</span>
                </div>
                <div className="flex flex-col items-end gap-1 text-sm min-w-[200px]">
                  <div className="flex items-center justify-between w-full gap-6">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-mono font-semibold text-gray-900">₹{fmt(totals.subtotal)}</span>
                  </div>
                  {includeGst && totals.totalGst > 0 && (
                    <div className="flex items-center justify-between w-full gap-6">
                      <span className="text-amber-600">Total GST</span>
                      <span className="font-mono font-semibold text-amber-600">₹{fmt(totals.totalGst)}</span>
                    </div>
                  )}
                  {includeGst && (
                    <div className="flex items-center justify-between w-full gap-6 pt-1 border-t border-gray-200">
                      <span className="text-gray-900 font-semibold">Grand Total</span>
                      <span className="font-mono font-bold text-gray-900 text-base">₹{fmt(totals.grand)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={() => navigate("/procurement/purchase-orders")}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
            <Save className="h-4 w-4" />
            {submitting ? "Creating…" : "Create Purchase Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
