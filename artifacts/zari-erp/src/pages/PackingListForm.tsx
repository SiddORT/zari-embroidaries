import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  Package, Save, ArrowLeft, Plus, X, MapPin, Truck,
  Search, AlertCircle, CheckCircle, Trash2, Box, ChevronDown, ChevronUp, Info
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
  address_line1: string | null; city: string | null; state: string | null;
  country: string | null; pincode: string | null; is_default: boolean;
}
interface Shipment { id: number; reference_type: string; tracking_number: string | null; shipment_status: string; }
interface EligibleOrder {
  id: number; order_code: string; name: string;
  delivery_address_id: number | null; order_status: string; quantity: string | null;
}

interface PackageItem {
  order_type: "Swatch" | "Style";
  order_id: number;
  order_code: string;
  description: string;
  quantity: string;
  unit: string;
  item_weight: string;
}

interface PackageState {
  tempId: string;
  length: string;
  width: string;
  height: string;
  net_weight: string;
  gross_weight: string;
  items: PackageItem[];
  expanded: boolean;
}

const STATUSES = ["Draft", "Ready", "Shipped", "Cancelled"];

function AddrText({ a }: { a: DeliveryAddress }) {
  const parts = [a.address_line1, a.city, a.state, a.country, a.pincode].filter(Boolean);
  return <span className="text-xs text-gray-400">{parts.join(", ") || "No address details"}</span>;
}

function genId() { return Math.random().toString(36).slice(2, 10); }

export default function PackingListForm() {
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id && params.id !== "new";
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("zarierp_token");
  const { data: user, isError } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();

  // Header state
  const [clientId, setClientId] = useState<number | "">("");
  const [deliveryAddressId, setDeliveryAddressId] = useState<number | "">("");
  const [shipmentId, setShipmentId] = useState<number | "">("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState("Draft");

  // Packages state
  const [packages, setPackages] = useState<PackageState[]>([]);
  const [activePackageId, setActivePackageId] = useState<string | null>(null);

  // Lookup data
  const [clients, setClients] = useState<Client[]>([]);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [eligibleOrders, setEligibleOrders] = useState<{ swatches: EligibleOrder[]; styles: EligibleOrder[] }>({ swatches: [], styles: [] });
  const [totalReadyItems, setTotalReadyItems] = useState<number | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [showAddrModal, setShowAddrModal] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderTab, setOrderTab] = useState<"Swatch" | "Style">("Swatch");
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

  // Load clients + shipments
  useEffect(() => {
    customFetch<any>("/api/clients?limit=500").then(j => setClients(j.data ?? [])).catch(() => {});
    customFetch<any>("/api/shipping/details?limit=500").then(j => setShipments(j.data ?? [])).catch(() => {});
  }, []);

  // Load addresses when client changes
  useEffect(() => {
    if (!clientId) { setAddresses([]); setDeliveryAddressId(""); return; }
    setLoadingAddresses(true);
    customFetch<any>(`/api/delivery-addresses?client_id=${clientId}`)
      .then(j => setAddresses(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingAddresses(false));
  }, [clientId]);

  // Load eligible orders when client + address set
  useEffect(() => {
    if (!clientId || !deliveryAddressId) {
      setEligibleOrders({ swatches: [], styles: [] });
      setTotalReadyItems(null);
      return;
    }
    setLoadingEligible(true);
    customFetch<any>(`/api/eligible-orders-for-packing?client_id=${clientId}&delivery_address_id=${deliveryAddressId}`)
      .then(j => {
        const sw = j.swatches ?? [];
        const st = j.styles ?? [];
        setEligibleOrders({ swatches: sw, styles: st });
        setTotalReadyItems(sw.length + st.length);
      })
      .catch(() => {})
      .finally(() => setLoadingEligible(false));
  }, [clientId, deliveryAddressId]);

  // Load existing PL for edit
  useEffect(() => {
    if (!isEdit) return;
    customFetch<any>(`/api/packing-lists/${params.id}`).then(j => {
      const pl = j.data;
      setClientId(pl.client_id);
      setDeliveryAddressId(pl.delivery_address_id ?? "");
      setShipmentId(pl.shipment_id ?? "");
      setDestinationCountry(pl.destination_country ?? "");
      setRemarks(pl.remarks ?? "");
      setStatus(pl.status ?? "Draft");
      setPackages((pl.packages ?? []).map((pkg: any) => ({
        tempId: genId(),
        length: pkg.length ?? "",
        width: pkg.width ?? "",
        height: pkg.height ?? "",
        net_weight: pkg.net_weight ?? "",
        gross_weight: pkg.gross_weight ?? "",
        expanded: true,
        items: (pkg.items ?? []).map((i: any) => ({
          order_type: i.order_type,
          order_id: i.order_id,
          order_code: i.order_code ?? "",
          description: i.description ?? "",
          quantity: i.quantity ?? "",
          unit: i.unit ?? "",
          item_weight: i.item_weight ?? "",
        })),
      })));
    }).catch(() => toast({ title: "Error", description: "Failed to load packing list", variant: "destructive" }));
  }, [isEdit, params.id]);

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

  function createPackage() {
    const newPkg: PackageState = {
      tempId: genId(),
      length: "", width: "", height: "",
      net_weight: "", gross_weight: "",
      items: [], expanded: true,
    };
    setPackages(prev => [...prev, newPkg]);
    setActivePackageId(newPkg.tempId);
  }

  function removePackage(tempId: string) {
    setPackages(prev => prev.filter(p => p.tempId !== tempId));
    if (activePackageId === tempId) setActivePackageId(null);
  }

  function updatePackageField(tempId: string, field: keyof Omit<PackageState, "tempId" | "items" | "expanded">, value: string) {
    setPackages(prev => prev.map(p => p.tempId === tempId ? { ...p, [field]: value } : p));
  }

  function togglePackage(tempId: string) {
    setPackages(prev => prev.map(p => p.tempId === tempId ? { ...p, expanded: !p.expanded } : p));
  }

  function addItemToPackage(order: EligibleOrder, type: "Swatch" | "Style") {
    if (!activePackageId) {
      toast({ title: "Select a package", description: "Click 'Add Items' on a package first", variant: "destructive" });
      return;
    }
    const pkg = packages.find(p => p.tempId === activePackageId);
    if (!pkg) return;
    if (pkg.items.some(i => i.order_type === type && i.order_id === order.id)) {
      toast({ title: "Already added", description: `${order.order_code} is already in this package` });
      return;
    }
    // Check if order is in another package
    for (const p of packages) {
      if (p.items.some(i => i.order_type === type && i.order_id === order.id)) {
        toast({ title: "Already packed", description: `${order.order_code} is already in Package ${packages.indexOf(p) + 1}` });
        return;
      }
    }
    setPackages(prev => prev.map(p => p.tempId === activePackageId ? {
      ...p,
      items: [...p.items, {
        order_type: type, order_id: order.id,
        order_code: order.order_code,
        description: order.name ?? "",
        quantity: order.quantity ?? "",
        unit: "pcs",
        item_weight: "",
      }],
    } : p));
  }

  function removeItemFromPackage(pkgId: string, idx: number) {
    setPackages(prev => prev.map(p => p.tempId === pkgId
      ? { ...p, items: p.items.filter((_, i) => i !== idx) }
      : p
    ));
  }

  function updateItemField(pkgId: string, idx: number, field: keyof PackageItem, value: string) {
    setPackages(prev => prev.map(p => p.tempId === pkgId
      ? { ...p, items: p.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }
      : p
    ));
  }

  async function handleSubmit() {
    if (!clientId) { toast({ title: "Select a client", variant: "destructive" }); return; }
    if (!deliveryAddressId) { toast({ title: "Select a delivery address", variant: "destructive" }); return; }
    if (packages.length === 0) { toast({ title: "Add at least one package", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const body = {
        client_id: clientId,
        delivery_address_id: deliveryAddressId,
        shipment_id: shipmentId || null,
        destination_country: destinationCountry || null,
        remarks: remarks || null,
        status,
        packages: packages.map(pkg => ({
          length: pkg.length ? parseFloat(pkg.length) : null,
          width:  pkg.width  ? parseFloat(pkg.width)  : null,
          height: pkg.height ? parseFloat(pkg.height) : null,
          net_weight:   pkg.net_weight   ? parseFloat(pkg.net_weight)   : null,
          gross_weight: pkg.gross_weight ? parseFloat(pkg.gross_weight) : null,
          items: pkg.items.map(i => ({
            order_type: i.order_type,
            order_id:   i.order_id,
            order_code: i.order_code,
            description: i.description,
            quantity:   i.quantity ? parseFloat(i.quantity) : null,
            unit:       i.unit || null,
            item_weight: i.item_weight ? parseFloat(i.item_weight) : null,
          })),
        })),
      };

      if (isEdit) {
        await customFetch(`/api/packing-lists/${params.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast({ title: "Saved", description: "Packing list updated" });
        setLocation("/logistics/packing-lists");
      } else {
        const res = await customFetch<any>("/api/packing-lists", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Created", description: res.message ?? "Packing list created successfully with package details" });
        setLocation(`/logistics/packing-lists/${res.data.id}`);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e?.data?.error ?? e?.message ?? "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  }

  const selectedAddr = addresses.find(a => a.id === deliveryAddressId);
  const activePackage = packages.find(p => p.tempId === activePackageId);

  const allPackedOrderIds = new Set(packages.flatMap(p => p.items.map(i => `${i.order_type}-${i.order_id}`)));

  const filteredOrders = (orderTab === "Swatch" ? eligibleOrders.swatches : eligibleOrders.styles)
    .filter(o => !allPackedOrderIds.has(`${orderTab}-${o.id}`))
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
          <button onClick={() => setLocation("/logistics/packing-lists")} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(198,175,75,0.12)" }}>
              <Package className="h-5 w-5" style={{ color: G }} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{isEdit ? "Edit Packing List" : "New Packing List"}</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setLocation("/logistics/packing-lists")} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: G }}
            >
              {saving ? <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "Update" : "Create Packing List"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-6">

            {/* Grouping */}
            <div className={`${card} p-6`}>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Grouping</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client *</label>
                  <select
                    value={clientId}
                    onChange={e => { setClientId(e.target.value ? parseInt(e.target.value) : ""); setDeliveryAddressId(""); setPackages([]); setActivePackageId(null); }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                    disabled={isEdit}
                  >
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.brand_name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-600">Delivery Address *</label>
                    {clientId && (
                      <button onClick={() => setShowAddrModal(true)} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: G }}>
                        <Plus className="h-3 w-3" /> Add New
                      </button>
                    )}
                  </div>
                  {loadingAddresses ? (
                    <div className="text-sm text-gray-400 py-2">Loading…</div>
                  ) : (
                    <select
                      value={deliveryAddressId}
                      onChange={e => { setDeliveryAddressId(e.target.value ? parseInt(e.target.value) : ""); setPackages([]); setActivePackageId(null); }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                      disabled={!clientId || isEdit}
                    >
                      <option value="">Select delivery address…</option>
                      {addresses.map(a => <option key={a.id} value={a.id}>{a.label}{a.city ? ` — ${a.city}` : ""}{a.country ? `, ${a.country}` : ""}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {selectedAddr && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-700">
                    <div className="font-semibold">{selectedAddr.label}</div>
                    <AddrText a={selectedAddr} />
                  </div>
                </div>
              )}

              {/* Total ready-to-ship count */}
              {totalReadyItems !== null && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">
                    Total Ready-to-Ship Items: <span className="font-bold">{totalReadyItems}</span>
                    {" "}(Swatches: {eligibleOrders.swatches.length}, Styles: {eligibleOrders.styles.length})
                  </p>
                </div>
              )}

              {deliveryAddressId && (
                <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-500">
                    Only orders matching this delivery address can be packed. Shipped or cancelled orders are excluded.
                  </p>
                </div>
              )}
            </div>

            {/* Shipment + Details */}
            <div className={`${card} p-6`}>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Shipment &amp; Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Linked Shipment</label>
                  <select
                    value={shipmentId}
                    onChange={e => setShipmentId(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-200"
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
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="Any additional notes…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-200 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Packages */}
            <div className={card}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4" style={{ color: G }} />
                  <h2 className="text-sm font-bold text-gray-900">Packages ({packages.length})</h2>
                </div>
                <button
                  onClick={createPackage}
                  disabled={!deliveryAddressId}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: G }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Package
                </button>
              </div>

              {packages.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  {deliveryAddressId
                    ? 'Click "Create Package" to add a package box'
                    : "Select a client and delivery address first"}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {packages.map((pkg, pkgIdx) => (
                    <div key={pkg.tempId} className={`p-5 transition-colors ${activePackageId === pkg.tempId ? "bg-amber-50/40" : ""}`}>
                      {/* Package header row */}
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: G }}
                        >
                          {pkgIdx + 1}
                        </div>
                        <span className="font-semibold text-gray-800 text-sm">Package {pkgIdx + 1}</span>
                        <span className="text-xs text-gray-400">{pkg.items.length} item{pkg.items.length !== 1 ? "s" : ""}</span>
                        {pkg.net_weight && <span className="text-xs text-gray-400">· {pkg.net_weight} kg net</span>}
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => { setActivePackageId(pkg.tempId); togglePackage(pkg.tempId); if (!pkg.expanded) setActivePackageId(pkg.tempId); }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              activePackageId === pkg.tempId
                                ? "border-amber-300 bg-amber-100 text-amber-800"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {activePackageId === pkg.tempId ? "Adding Here" : "Add Items"}
                          </button>
                          <button onClick={() => togglePackage(pkg.tempId)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                            {pkg.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <button onClick={() => removePackage(pkg.tempId)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {pkg.expanded && (
                        <>
                          {/* Dimensions + Weights */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                            {[
                              { label: "Length (cm)", key: "length" as const },
                              { label: "Width (cm)",  key: "width" as const },
                              { label: "Height (cm)", key: "height" as const },
                              { label: "Net Wt (kg)", key: "net_weight" as const },
                              { label: "Gross Wt (kg)", key: "gross_weight" as const },
                            ].map(({ label, key }) => (
                              <div key={key}>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={pkg[key]}
                                  onChange={e => updatePackageField(pkg.tempId, key, e.target.value)}
                                  placeholder="0"
                                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-yellow-200"
                                />
                              </div>
                            ))}
                          </div>

                          {/* Items in this package */}
                          {pkg.items.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-gray-100">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-100">
                                    {["#", "Type", "Order Code", "Description", "Qty", "Unit", "Wt (kg)", ""].map(h => (
                                      <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {pkg.items.map((item, itemIdx) => (
                                    <tr key={itemIdx}>
                                      <td className="px-3 py-2 text-gray-400">{itemIdx + 1}</td>
                                      <td className="px-3 py-2">
                                        <span className={`px-1.5 py-0.5 rounded-full font-semibold ${item.order_type === "Swatch" ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"}`}>
                                          {item.order_type}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 font-mono text-gray-700">{item.order_code}</td>
                                      <td className="px-3 py-2">
                                        <input
                                          value={item.description}
                                          onChange={e => updateItemField(pkg.tempId, itemIdx, "description", e.target.value)}
                                          className="w-full border border-gray-100 rounded px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-yellow-200"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="number"
                                          value={item.quantity}
                                          onChange={e => updateItemField(pkg.tempId, itemIdx, "quantity", e.target.value)}
                                          className="w-16 border border-gray-100 rounded px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-yellow-200"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          value={item.unit}
                                          onChange={e => updateItemField(pkg.tempId, itemIdx, "unit", e.target.value)}
                                          className="w-14 border border-gray-100 rounded px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-yellow-200"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="number"
                                          step="0.001"
                                          value={item.item_weight}
                                          onChange={e => updateItemField(pkg.tempId, itemIdx, "item_weight", e.target.value)}
                                          className="w-16 border border-gray-100 rounded px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-yellow-200"
                                          placeholder="0.000"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <button onClick={() => removeItemFromPackage(pkg.tempId, itemIdx)} className="text-gray-300 hover:text-red-500">
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div
                              className={`text-center py-6 text-xs rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                                activePackageId === pkg.tempId
                                  ? "border-amber-300 text-amber-600 bg-amber-50/50"
                                  : "border-gray-200 text-gray-400"
                              }`}
                              onClick={() => setActivePackageId(pkg.tempId)}
                            >
                              {activePackageId === pkg.tempId
                                ? "Select orders from the panel →"
                                : 'Click "Add Items" to select orders for this package'}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT */}
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

            {/* Order Picker */}
            <div className={`${card} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add Orders</h2>
                {activePackage && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: G }}>
                    → Pkg {packages.indexOf(activePackage) + 1}
                  </span>
                )}
              </div>

              {!deliveryAddressId ? (
                <div className="text-xs text-gray-400 text-center py-6">Select a client and delivery address first</div>
              ) : packages.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-6">Create a package first, then add orders to it</div>
              ) : !activePackageId ? (
                <div className="text-xs text-amber-600 text-center py-6 bg-amber-50 rounded-xl">
                  Click "Add Items" on a package to start adding orders to it
                </div>
              ) : loadingEligible ? (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: G }} />
                </div>
              ) : (
                <>
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
                      placeholder="Search orders…"
                      className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-yellow-200"
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                    {filteredOrders.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-6">
                        {eligibleOrders.swatches.length + eligibleOrders.styles.length === 0
                          ? "No ready-to-ship orders for this client/address"
                          : "All orders have been packed"}
                      </div>
                    ) : filteredOrders.map(order => (
                      <button
                        key={order.id}
                        onClick={() => addItemToPackage(order, orderTab)}
                        className="w-full flex items-start gap-2 px-3 py-2 rounded-xl hover:bg-amber-50 text-left border border-transparent hover:border-amber-200 transition-all group"
                      >
                        <Plus className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-300 group-hover:text-amber-500" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-800 font-mono">{order.order_code}</div>
                          <div className="text-[11px] text-gray-500 truncate">{order.name}</div>
                          {order.quantity && <div className="text-[10px] text-gray-400">Qty: {order.quantity}</div>}
                        </div>
                        <span className={`ml-auto text-[10px] shrink-0 px-1.5 py-0.5 rounded font-medium ${
                          order.order_status === "Completed" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                        }`}>{order.order_status}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Address Modal */}
      {showAddrModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Add Delivery Address</h3>
              <button onClick={() => setShowAddrModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Label *", key: "label", placeholder: "e.g. Warehouse, Main Office" },
                { label: "Address Line 1", key: "address_line1", placeholder: "Street address" },
                { label: "Address Line 2", key: "address_line2", placeholder: "Apt, Suite…" },
                { label: "City", key: "city", placeholder: "City" },
                { label: "State", key: "state", placeholder: "State / Province" },
                { label: "Country", key: "country", placeholder: "Country" },
                { label: "Pincode", key: "pincode", placeholder: "Postal code" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    value={(newAddr as any)[key]}
                    onChange={e => setNewAddr(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newAddr.is_default} onChange={e => setNewAddr(prev => ({ ...prev, is_default: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">Set as default address</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAddrModal(false)} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
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
