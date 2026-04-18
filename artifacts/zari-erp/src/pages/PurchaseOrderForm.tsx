import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Plus, Trash2, Save, CheckCircle2, XCircle, Clock,
  ShoppingCart, PackageCheck, AlertTriangle, Search,
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
  unit_type: string | null;
  available_stock: string;
  average_price: string;
  warehouse_location: string | null;
}

interface Vendor { id: number; brand_name: string; }

interface LineItem {
  key: string;
  inventoryItemId: number | null;
  itemName: string;
  itemCode: string;
  unitType: string;
  availableStock: string;
  orderedQuantity: string;
  unitPrice: string;
  warehouseLocation: string;
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
  available_stock: string;
  current_stock: string;
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
  const [inventoryItems, setInventoryItems] = useState<InventoryOption[]>([]);
  const [itemSearch, setItemSearch] = useState<Record<string, string>>({});

  // Form state
  const [vendorId, setVendorId]         = useState<number | "">("");
  const [vendorName, setVendorName]     = useState("");
  const [poDate, setPoDate]             = useState(new Date().toISOString().slice(0, 10));
  const [referenceType, setReferenceType] = useState("Inventory");
  const [notes, setNotes]               = useState("");
  const [lineItems, setLineItems]       = useState<LineItem[]>([
    { key: mkKey(), inventoryItemId: null, itemName: "", itemCode: "", unitType: "", availableStock: "0", orderedQuantity: "", unitPrice: "", warehouseLocation: "", remarks: "" },
  ]);
  const [submitting, setSubmitting]     = useState(false);
  const [actioning, setActioning]       = useState(false);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  useEffect(() => {
    if (!token) return;
    customFetch(`/api/vendors?limit=200&_t=${Date.now()}`)
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
      .then((r: unknown) => { setPo(r as PODetail); })
      .catch(() => toast({ title: "Failed to load PO", variant: "destructive" }))
      .finally(() => setLoadingPo(false));
  }, [poId, token, toast]);

  useEffect(() => { if (!isNew) loadPo(); }, [isNew, loadPo]);

  const addLine = () => setLineItems(ls => [
    ...ls,
    { key: mkKey(), inventoryItemId: null, itemName: "", itemCode: "", unitType: "", availableStock: "0", orderedQuantity: "", unitPrice: "", warehouseLocation: "", remarks: "" },
  ]);

  const removeLine = (key: string) => setLineItems(ls => ls.filter(l => l.key !== key));

  const updateLine = (key: string, field: keyof LineItem, value: string | number | null) =>
    setLineItems(ls => ls.map(l => l.key === key ? { ...l, [field]: value } : l));

  const selectItem = (key: string, item: InventoryOption) => {
    setLineItems(ls => ls.map(l => l.key === key ? {
      ...l,
      inventoryItemId: item.id,
      itemName: item.item_name,
      itemCode: item.item_code,
      unitType: item.unit_type ?? "",
      availableStock: item.available_stock,
      unitPrice: parseFloat(item.average_price).toFixed(2),
      warehouseLocation: item.warehouse_location ?? "",
    } : l));
    setItemSearch(s => ({ ...s, [key]: item.item_name }));
  };

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
        vendorName,
        poDate,
        referenceType,
        notes,
        items: validItems.map(l => ({
          inventoryItemId: l.inventoryItemId,
          itemName: l.itemName,
          itemCode: l.itemCode,
          orderedQuantity: parseFloat(l.orderedQuantity),
          unitPrice: parseFloat(l.unitPrice) || 0,
          warehouseLocation: l.warehouseLocation || null,
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

  // ── VIEW mode (existing PO) ───────────────────────────────────────────────

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

          {/* Header */}
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

          {/* Summary cards */}
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

          {/* Info */}
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

          {/* Items */}
          <div className={card}>
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Order Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F8F6F0]">
                  <tr>
                    {["#","Item","Code","Unit","Ordered","Received","Pending","Unit Price","Location"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {po.items.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">No items on this PO (costing-linked PO)</td></tr>
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
                        <td className="px-3 py-3 text-xs text-gray-500">{item.warehouse_location ?? "—"}</td>
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

  // ── CREATE mode ───────────────────────────────────────────────────────────

  const filteredItems = (key: string) => {
    const q = (itemSearch[key] ?? "").toLowerCase();
    if (!q) return inventoryItems.slice(0, 20);
    return inventoryItems.filter(i =>
      i.item_name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q)
    ).slice(0, 20);
  };

  return (
    <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
      <TopNavbar username={(me as any)?.name ?? ""} role={(me as any)?.role ?? ""} onLogout={handleLogout} isLoggingOut={false} />
      <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-5">

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor <span className="text-red-500">*</span></label>
              <select value={vendorId}
                onChange={e => {
                  const v = vendors.find(v => v.id === Number(e.target.value));
                  setVendorId(Number(e.target.value));
                  setVendorName(v?.brand_name ?? "");
                }}
                className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white">
                <option value="">Select vendor…</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.brand_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">PO Date</label>
              <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)}
                className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reference Type</label>
              <select value={referenceType} onChange={e => setReferenceType(e.target.value)}
                className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white">
                <option value="Inventory">Inventory</option>
                <option value="Manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes…"
                className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
            </div>
          </div>
        </div>

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
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 min-w-[220px]">Item</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-24">Unit</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">Ordered Qty</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">Unit Price (₹)</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-32">Location</th>
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lineItems.map((line, idx) => (
                  <tr key={line.key}>
                    <td className="px-3 py-2 text-xs text-gray-400">{idx+1}</td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <div className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
                          <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <input
                            className="flex-1 outline-none text-sm text-gray-900 min-w-0"
                            placeholder="Search item…"
                            value={itemSearch[line.key] ?? line.itemName}
                            onChange={e => {
                              setItemSearch(s => ({ ...s, [line.key]: e.target.value }));
                              if (!e.target.value) updateLine(line.key, "inventoryItemId", null);
                            }}
                          />
                        </div>
                        {(itemSearch[line.key] !== undefined && itemSearch[line.key] !== line.itemName) && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {filteredItems(line.key).length === 0 ? (
                              <div className="px-3 py-2 text-xs text-gray-400">No items found</div>
                            ) : filteredItems(line.key).map(item => (
                              <button key={item.id} type="button"
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                                onClick={() => selectItem(line.key, item)}>
                                <div className="font-medium text-gray-900">{item.item_name}</div>
                                <div className="text-xs text-gray-400">{item.item_code} · Stock: {parseFloat(item.available_stock).toFixed(3)}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-gray-500">{line.unitType || "—"}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.001"
                        value={line.orderedQuantity}
                        onChange={e => updateLine(line.key, "orderedQuantity", e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 text-right" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01"
                        value={line.unitPrice}
                        onChange={e => updateLine(line.key, "unitPrice", e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 text-right" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text"
                        value={line.warehouseLocation}
                        onChange={e => updateLine(line.key, "warehouseLocation", e.target.value)}
                        placeholder="Bin / shelf…"
                        className="w-full px-2 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                    </td>
                    <td className="px-3 py-2">
                      {lineItems.length > 1 && (
                        <button onClick={() => removeLine(line.key)}
                          className="p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save */}
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
