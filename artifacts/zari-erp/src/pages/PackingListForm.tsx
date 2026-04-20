import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  Package, Save, ArrowLeft, Plus, X, MapPin, Truck,
  Search, AlertCircle, CheckCircle, Trash2
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";

const G = "#C6AF4B";
const card = "bg-white rounded-2xl border border-gray-200 shadow-sm";

interface Client { id: number; brand_name: string; client_code: string; }
interface DeliveryAddress {
  id: number; client_id: number; label: string;
  address_line1: string | null; address_line2: string | null;
  city: string | null; state: string | null; country: string | null; pincode: string | null; is_default: boolean;
}
interface Shipment { id: number; reference_type: string; tracking_number: string | null; shipment_date: string | null; shipment_status: string; client_name: string | null; }
interface EligibleOrder { id: number; order_code: string; name: string; client_name: string; delivery_address_id: number | null; order_status: string; quantity: string | null; already_added: boolean; }
interface PackingListItem { id?: number; item_type: "Swatch" | "Style"; item_id: number; order_code: string; description: string; qty: string; unit: string; }

const STATUSES = ["Draft", "Ready", "Shipped", "Cancelled"];

function AddrText({ a }: { a: DeliveryAddress }) {
  const parts = [a.address_line1, a.address_line2, a.city, a.state, a.country, a.pincode].filter(Boolean);
  return <span className="text-xs text-gray-400">{parts.join(", ") || "No address details"}</span>;
}

export default function PackingListForm() {
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id && params.id !== "new";
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("zarierp_token");
  const { data: user, isError } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();

  // Form state
  const [clientId, setClientId] = useState<number | "">("");
  const [deliveryAddressId, setDeliveryAddressId] = useState<number | "">("");
  const [shipmentId, setShipmentId] = useState<number | "">("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [packageCount, setPackageCount] = useState("");
  const [packageType, setPackageType] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState("Draft");
  const [items, setItems] = useState<PackingListItem[]>([]);

  // Lookup data
  const [clients, setClients] = useState<Client[]>([]);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [eligibleOrders, setEligibleOrders] = useState<{ swatches: EligibleOrder[]; styles: EligibleOrder[] }>({ swatches: [], styles: [] });
  const [plId, setPlId] = useState<number | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [showAddrModal, setShowAddrModal] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderTab, setOrderTab] = useState<"Swatch" | "Style">("Swatch");

  // New delivery address form
  const [newAddr, setNewAddr] = useState({ label: "", address_line1: "", address_line2: "", city: "", state: "", country: "", pincode: "", is_default: false });
  const [savingAddr, setSavingAddr] = useState(false);

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSettled: () => { localStorage.removeItem("zarierp_token"); qc.clear(); setLocation("/login"); },
    });
  }

  useEffect(() => {
    if (!token || isError) { localStorage.removeItem("zarierp_token"); setLocation("/login"); }
  }, [token, isError]);

  // Load clients
  useEffect(() => {
    customFetch<any>("/api/clients?limit=500").then(j => setClients(j.data ?? [])).catch(() => {});
  }, []);

  // Load shipments
  useEffect(() => {
    customFetch<any>("/api/shipping?limit=500").then(j => setShipments(j.data ?? [])).catch(() => {});
  }, []);

  // Load existing PL if editing
  useEffect(() => {
    if (!isEdit) return;
    customFetch<any>(`/api/packing-lists/${params.id}`).then(j => {
      const pl = j.data;
      setPlId(pl.id);
      setClientId(pl.client_id);
      setDeliveryAddressId(pl.delivery_address_id ?? "");
      setShipmentId(pl.shipment_id ?? "");
      setDestinationCountry(pl.destination_country ?? "");
      setPackageCount(pl.package_count ?? "");
      setPackageType(pl.package_type ?? "");
      setDimensions(pl.dimensions ?? "");
      setNetWeight(pl.net_weight ?? "");
      setGrossWeight(pl.gross_weight ?? "");
      setRemarks(pl.remarks ?? "");
      setStatus(pl.status ?? "Draft");
      setItems((pl.items ?? []).map((i: any) => ({
        id: i.id, item_type: i.item_type, item_id: i.item_id,
        order_code: i.order_code ?? "", description: i.description ?? "",
        qty: i.qty ?? "", unit: i.unit ?? "",
      })));
    }).catch(() => toast({ title: "Error", description: "Failed to load packing list", variant: "destructive" }));
  }, [isEdit, params.id]);

  // Load addresses when client changes
  useEffect(() => {
    if (!clientId) { setAddresses([]); setDeliveryAddressId(""); return; }
    setLoadingAddresses(true);
    customFetch<any>(`/api/delivery-addresses?client_id=${clientId}`)
      .then(j => setAddresses(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingAddresses(false));
  }, [clientId]);

  // Load eligible orders when client + delivery address are set (for new PL, or edit)
  useEffect(() => {
    const id = plId ?? (isEdit ? null : null);
    if (!clientId || !deliveryAddressId || !id) return;
    setLoadingEligible(true);
    customFetch<any>(`/api/packing-lists/${id}/eligible-orders`)
      .then(j => setEligibleOrders({ swatches: j.swatches ?? [], styles: j.styles ?? [] }))
      .catch(() => {})
      .finally(() => setLoadingEligible(false));
  }, [plId, clientId, deliveryAddressId]);

  async function handleSaveAddr() {
    if (!clientId) return;
    setSavingAddr(true);
    try {
      const res = await customFetch<any>("/api/delivery-addresses", {
        method: "POST",
        body: JSON.stringify({ client_id: clientId, ...newAddr }),
      });
      const created = res.data;
      setAddresses(prev => [...prev, created]);
      setDeliveryAddressId(created.id);
      setShowAddrModal(false);
      setNewAddr({ label: "", address_line1: "", address_line2: "", city: "", state: "", country: "", pincode: "", is_default: false });
      toast({ title: "Address saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save address", variant: "destructive" });
    } finally { setSavingAddr(false); }
  }

  function addItem(order: EligibleOrder, type: "Swatch" | "Style") {
    if (items.some(i => i.item_type === type && i.item_id === order.id)) {
      toast({ title: "Already added", description: `${order.order_code} is already in the list` });
      return;
    }
    setItems(prev => [...prev, {
      item_type: type,
      item_id: order.id,
      order_code: order.order_code,
      description: order.name,
      qty: order.quantity ?? "",
      unit: type === "Swatch" ? "pcs" : "pcs",
    }]);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof PackingListItem, value: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function handleSubmit() {
    if (!clientId) { toast({ title: "Select a client", variant: "destructive" }); return; }
    if (!deliveryAddressId) { toast({ title: "Select a delivery address", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const body = {
        client_id: clientId,
        delivery_address_id: deliveryAddressId,
        shipment_id: shipmentId || null,
        destination_country: destinationCountry || null,
        package_count: packageCount ? parseInt(packageCount) : null,
        package_type: packageType || null,
        dimensions: dimensions || null,
        net_weight: netWeight || null,
        gross_weight: grossWeight || null,
        remarks: remarks || null,
        status,
        items: items.map(i => ({
          item_type: i.item_type, item_id: i.item_id,
          order_code: i.order_code, description: i.description,
          qty: i.qty || null, unit: i.unit || null,
        })),
      };

      if (isEdit) {
        await customFetch(`/api/packing-lists/${params.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast({ title: "Saved", description: "Packing list updated" });
      } else {
        const res = await customFetch<any>("/api/packing-lists", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Created", description: res.message ?? "Packing list created for selected delivery address successfully" });
        setLocation(`/logistics/packing-lists/${res.data.id}`);
        return;
      }
      setLocation("/logistics/packing-lists");
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  }

  const selectedAddr = addresses.find(a => a.id === deliveryAddressId);
  const selectedClient = clients.find(c => c.id === clientId);

  const filteredOrders = (orderTab === "Swatch" ? eligibleOrders.swatches : eligibleOrders.styles)
    .filter(o => !orderSearch || o.order_code.toLowerCase().includes(orderSearch.toLowerCase()) || (o.name ?? "").toLowerCase().includes(orderSearch.toLowerCase()));

  if (!user && !isError) return null;

  return (
    <AppLayout
      username={user?.data?.username ?? ""}
      role={user?.data?.role ?? ""}
      onLogout={handleLogout}
      isLoggingOut={logoutMutation.isPending}
    >
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setLocation("/logistics/packing-lists")}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(198,175,75,0.12)" }}>
              <Package className="h-5 w-5" style={{ color: G }} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{isEdit ? "Edit Packing List" : "New Packing List"}</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setLocation("/logistics/packing-lists")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: G }}
            >
              {saving ? <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "Update" : "Create Packing List"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT — Header details */}
          <div className="lg:col-span-2 space-y-6">

            {/* Client + Delivery Address */}
            <div className={`${card} p-6`}>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Grouping</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Client */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client *</label>
                  <select
                    value={clientId}
                    onChange={e => { setClientId(e.target.value ? parseInt(e.target.value) : ""); setDeliveryAddressId(""); setItems([]); }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                    disabled={isEdit}
                  >
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.brand_name}</option>)}
                  </select>
                </div>

                {/* Delivery Address */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-600">Delivery Address *</label>
                    {clientId && (
                      <button
                        onClick={() => setShowAddrModal(true)}
                        className="flex items-center gap-1 text-xs font-medium hover:underline"
                        style={{ color: G }}
                      >
                        <Plus className="h-3 w-3" /> Add New
                      </button>
                    )}
                  </div>
                  {loadingAddresses ? (
                    <div className="text-sm text-gray-400 py-2">Loading…</div>
                  ) : (
                    <select
                      value={deliveryAddressId}
                      onChange={e => { setDeliveryAddressId(e.target.value ? parseInt(e.target.value) : ""); setItems([]); }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                      disabled={!clientId}
                    >
                      <option value="">Select delivery address…</option>
                      {addresses.map(a => (
                        <option key={a.id} value={a.id}>{a.label}{a.city ? ` — ${a.city}` : ""}{a.country ? `, ${a.country}` : ""}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Address preview */}
              {selectedAddr && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-700">
                    <div className="font-semibold">{selectedAddr.label}</div>
                    <AddrText a={selectedAddr} />
                  </div>
                </div>
              )}

              {/* Delivery address validation notice */}
              {deliveryAddressId && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    Only orders whose delivery address matches this selection can be added to this packing list. Mismatched orders will be blocked.
                  </p>
                </div>
              )}
            </div>

            {/* Shipment + Package Details */}
            <div className={`${card} p-6`}>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Shipment &amp; Package Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Linked Shipment</label>
                  <select
                    value={shipmentId}
                    onChange={e => setShipmentId(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  >
                    <option value="">No shipment linked</option>
                    {shipments.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.reference_type} — {s.tracking_number ?? `#${s.id}`} ({s.shipment_status})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Destination Country</label>
                  <input
                    value={destinationCountry}
                    onChange={e => setDestinationCountry(e.target.value)}
                    placeholder="e.g. France"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Package Count</label>
                  <input
                    type="number" min="1"
                    value={packageCount}
                    onChange={e => setPackageCount(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Package Type</label>
                  <input
                    value={packageType}
                    onChange={e => setPackageType(e.target.value)}
                    placeholder="e.g. Carton, Bag"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Net Weight (kg)</label>
                  <input
                    type="number" step="0.001" min="0"
                    value={netWeight}
                    onChange={e => setNetWeight(e.target.value)}
                    placeholder="0.000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Gross Weight (kg)</label>
                  <input
                    type="number" step="0.001" min="0"
                    value={grossWeight}
                    onChange={e => setGrossWeight(e.target.value)}
                    placeholder="0.000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Dimensions</label>
                  <input
                    value={dimensions}
                    onChange={e => setDimensions(e.target.value)}
                    placeholder="e.g. 60cm × 40cm × 30cm"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="Any additional notes…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className={`${card} p-6`}>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                Packed Items ({items.length})
              </h2>
              {items.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  {deliveryAddressId ? "Select orders from the panel on the right →" : "Select a client and delivery address first, then add orders."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {["#", "Type", "Order Code", "Description", "Qty", "Unit", ""].map(h => (
                          <th key={h} className="text-left pb-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-2 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-2 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.item_type === "Swatch" ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"}`}>
                              {item.item_type}
                            </span>
                          </td>
                          <td className="px-2 py-2 font-mono text-xs text-gray-700">{item.order_code}</td>
                          <td className="px-2 py-2">
                            <input
                              value={item.description}
                              onChange={e => updateItem(idx, "description", e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-200"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={item.qty}
                              onChange={e => updateItem(idx, "qty", e.target.value)}
                              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-200"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={item.unit}
                              onChange={e => updateItem(idx, "unit", e.target.value)}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-200"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Status + Order picker */}
          <div className="space-y-4">
            {/* Status */}
            <div className={`${card} p-5`}>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Status</h2>
              <div className="flex flex-col gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                      status === s ? "border-yellow-400 bg-yellow-50 text-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`h-2 w-2 rounded-full ${
                      s === "Draft" ? "bg-gray-400" :
                      s === "Ready" ? "bg-blue-500" :
                      s === "Shipped" ? "bg-emerald-500" : "bg-red-400"
                    }`} />
                    {s}
                    {status === s && <CheckCircle className="h-4 w-4 ml-auto text-yellow-500" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Order picker */}
            <div className={`${card} p-5`}>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Add Orders</h2>

              {!deliveryAddressId ? (
                <div className="text-xs text-gray-400 text-center py-6">
                  Select a client and delivery address first
                </div>
              ) : !plId && !isEdit ? (
                <div className="text-xs text-gray-400 text-center py-6">
                  Orders can be added here after the packing list is saved. Select them from the table above for now.
                </div>
              ) : loadingEligible ? (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: G }} />
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg">
                    {(["Swatch", "Style"] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setOrderTab(tab)}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          orderTab === tab ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {tab} ({tab === "Swatch" ? eligibleOrders.swatches.length : eligibleOrders.styles.length})
                      </button>
                    ))}
                  </div>
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      value={orderSearch}
                      onChange={e => setOrderSearch(e.target.value)}
                      placeholder="Filter orders…"
                      className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-200"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {filteredOrders.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No eligible orders found</p>
                    ) : filteredOrders.map(order => {
                      const alreadyIn = items.some(i => i.item_type === orderTab && i.item_id === order.id);
                      return (
                        <button
                          key={order.id}
                          onClick={() => !alreadyIn && addItem(order, orderTab)}
                          disabled={alreadyIn}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-all text-left ${
                            alreadyIn
                              ? "bg-green-50 border-green-200 text-green-700 cursor-default"
                              : "bg-white border-gray-200 hover:border-yellow-300 hover:bg-yellow-50 text-gray-700"
                          }`}
                        >
                          <div>
                            <div className="font-semibold">{order.order_code}</div>
                            <div className="text-gray-500 truncate max-w-[160px]">{order.name}</div>
                          </div>
                          {alreadyIn
                            ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            : <Plus className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Delivery Address Modal */}
      {showAddrModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">New Delivery Address</h2>
              <button onClick={() => setShowAddrModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-xs text-gray-500">Adding address for <strong>{selectedClient?.brand_name}</strong></p>
              {[
                { label: "Label / Name *", field: "label", placeholder: "e.g. Warehouse, Showroom" },
                { label: "Address Line 1", field: "address_line1", placeholder: "Street address" },
                { label: "Address Line 2", field: "address_line2", placeholder: "Apt, suite, etc." },
                { label: "City", field: "city", placeholder: "" },
                { label: "State", field: "state", placeholder: "" },
                { label: "Country", field: "country", placeholder: "" },
                { label: "Pincode / ZIP", field: "pincode", placeholder: "" },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    value={(newAddr as any)[field]}
                    onChange={e => setNewAddr(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAddr.is_default}
                  onChange={e => setNewAddr(prev => ({ ...prev, is_default: e.target.checked }))}
                  className="rounded"
                />
                Set as default address
              </label>
            </div>
            <div className="px-6 pb-6 flex gap-2 justify-end">
              <button
                onClick={() => setShowAddrModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAddr}
                disabled={savingAddr || !newAddr.label}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: G }}
              >
                {savingAddr ? "Saving…" : "Save Address"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
