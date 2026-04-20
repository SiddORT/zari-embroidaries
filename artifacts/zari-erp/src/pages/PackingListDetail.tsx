import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  Package, ArrowLeft, Edit2, Printer, MapPin, Truck,
  Trash2, Plus, CheckCircle, AlertCircle, Search, X
} from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";

const G = "#C6AF4B";
const card = "bg-white rounded-2xl border border-gray-200 shadow-sm";

const STATUS_COLORS: Record<string, string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Ready:     "bg-blue-100 text-blue-700",
  Shipped:   "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-red-100 text-red-600",
};

interface PLDetail {
  id: number; pl_number: string; client_id: number; client_name: string;
  delivery_address_id: number | null; delivery_address_label: string | null;
  address_line1: string | null; address_line2: string | null;
  city: string | null; state: string | null; addr_country: string | null; addr_pincode: string | null;
  shipment_id: number | null; shipment_tracking: string | null; shipment_date: string | null;
  shipment_status_val: string | null; shipping_vendor_name: string | null;
  destination_country: string | null; package_count: number | null;
  package_type: string | null; dimensions: string | null;
  net_weight: string | null; gross_weight: string | null;
  status: string; remarks: string | null; created_at: string;
  items: PLItem[];
}

interface PLItem {
  id: number; packing_list_id: number; item_type: string;
  item_id: number; order_code: string | null; description: string | null;
  qty: string | null; unit: string | null;
}

interface EligibleOrder {
  id: number; order_code: string; name: string;
  delivery_address_id: number | null; order_status: string;
  quantity: string | null; already_added: boolean;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm text-gray-800 font-medium">{value || "—"}</div>
    </div>
  );
}

export default function PackingListDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("zarierp_token");
  const { data: user, isError } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();

  const [pl, setPl] = useState<PLDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Add item panel
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [eligible, setEligible] = useState<{ swatches: EligibleOrder[]; styles: EligibleOrder[] }>({ swatches: [], styles: [] });
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [orderTab, setOrderTab] = useState<"Swatch" | "Style">("Swatch");
  const [orderSearch, setOrderSearch] = useState("");
  const [addingItem, setAddingItem] = useState<number | null>(null);

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSettled: () => { localStorage.removeItem("zarierp_token"); qc.clear(); setLocation("/login"); },
    });
  }

  useEffect(() => {
    if (!token || isError) { localStorage.removeItem("zarierp_token"); setLocation("/login"); }
  }, [token, isError]);

  async function loadPl() {
    setLoading(true);
    try {
      const res = await customFetch<any>(`/api/packing-lists/${params.id}`);
      setPl(res.data);
    } catch {
      toast({ title: "Error", description: "Failed to load packing list", variant: "destructive" });
    } finally { setLoading(false); }
  }

  useEffect(() => { loadPl(); }, [params.id]);

  async function loadEligible() {
    setLoadingEligible(true);
    try {
      const res = await customFetch<any>(`/api/packing-lists/${params.id}/eligible-orders`);
      setEligible({ swatches: res.swatches ?? [], styles: res.styles ?? [] });
    } catch {} finally { setLoadingEligible(false); }
  }

  function toggleAddPanel() {
    if (!showAddPanel) { setShowAddPanel(true); loadEligible(); }
    else setShowAddPanel(false);
  }

  async function handleAddItem(order: EligibleOrder, type: "Swatch" | "Style") {
    setAddingItem(order.id);
    try {
      await customFetch(`/api/packing-lists/${params.id}/items`, {
        method: "POST",
        body: JSON.stringify({
          item_type: type, item_id: order.id,
          order_code: order.order_code, description: order.name,
          qty: order.quantity, unit: "pcs",
        }),
      });
      await loadPl();
      await loadEligible();
    } catch (e: any) {
      toast({ title: "Cannot add", description: e?.message ?? "Item blocked due to delivery address mismatch", variant: "destructive" });
    } finally { setAddingItem(null); }
  }

  async function handleDeleteItem(itemId: number) {
    setDeleting(itemId);
    try {
      await customFetch(`/api/packing-lists/${params.id}/items/${itemId}`, { method: "DELETE" });
      setPl(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== itemId) } : prev);
      toast({ title: "Removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove item", variant: "destructive" });
    } finally { setDeleting(null); }
  }

  function printPdf() {
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    window.open(`${base}/api/packing-lists/${params.id}/pdf-html`, "_blank");
  }

  if (!user && !isError) return null;

  const addrParts = pl ? [pl.address_line1, pl.address_line2, pl.city, pl.state, pl.addr_country, pl.addr_pincode].filter(Boolean) : [];

  const filteredOrders = (orderTab === "Swatch" ? eligible.swatches : eligible.styles)
    .filter(o => !orderSearch || o.order_code.toLowerCase().includes(orderSearch.toLowerCase()) || (o.name ?? "").toLowerCase().includes(orderSearch.toLowerCase()));

  return (
    <AppLayout
      username={user?.data?.username ?? ""}
      role={user?.data?.role ?? ""}
      onLogout={handleLogout}
      isLoggingOut={logoutMutation.isPending}
    >
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button
            onClick={() => setLocation("/logistics/packing-lists")}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(198,175,75,0.12)" }}>
              <Package className="h-5 w-5" style={{ color: G }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{pl?.pl_number ?? "Loading…"}</h1>
              {pl && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[pl.status] ?? "bg-gray-100 text-gray-600"}`}>{pl.status}</span>}
            </div>
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={printPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print PDF
            </button>
            <button
              onClick={() => setLocation(`/logistics/packing-lists/${params.id}/edit`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
              style={{ backgroundColor: G }}
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="h-6 w-6 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: G }} />
          </div>
        ) : !pl ? (
          <div className="text-center py-20 text-gray-500">Packing list not found</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT — detail cards */}
            <div className="lg:col-span-2 space-y-5">

              {/* Client + Address + Shipment */}
              <div className={`${card} p-6`}>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Grouping</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <Field label="Client" value={pl.client_name} />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Delivery Address</div>
                    {pl.delivery_address_label ? (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-800">{pl.delivery_address_label}</div>
                          <div className="text-xs text-gray-400">{addrParts.join(", ")}</div>
                        </div>
                      </div>
                    ) : <div className="text-sm text-gray-400">—</div>}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Shipment</div>
                    {pl.shipment_tracking ? (
                      <div className="flex items-start gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-800 font-mono">{pl.shipment_tracking}</div>
                          {pl.shipment_date && <div className="text-xs text-gray-400">{new Date(pl.shipment_date).toLocaleDateString("en-IN")}</div>}
                        </div>
                      </div>
                    ) : <div className="text-sm text-gray-400">—</div>}
                  </div>
                </div>
              </div>

              {/* Package info */}
              <div className={`${card} p-6`}>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Package Details</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                  <Field label="Destination" value={pl.destination_country} />
                  <Field label="Packages" value={pl.package_count} />
                  <Field label="Package Type" value={pl.package_type} />
                  <Field label="Dimensions" value={pl.dimensions} />
                  <Field label="Net Weight" value={pl.net_weight ? `${pl.net_weight} kg` : null} />
                  <Field label="Gross Weight" value={pl.gross_weight ? `${pl.gross_weight} kg` : null} />
                  {pl.remarks && <div className="col-span-2 sm:col-span-4"><Field label="Remarks" value={pl.remarks} /></div>}
                </div>
              </div>

              {/* Items */}
              <div className={card}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-900">Packed Items ({pl.items.length})</h2>
                  <button
                    onClick={toggleAddPanel}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: G }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Orders
                  </button>
                </div>

                {pl.items.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-sm">No items yet. Click "Add Orders" to add.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {["#", "Type", "Order Code", "Description", "Qty", "Unit", ""].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pl.items.map((item, idx) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.item_type === "Swatch" ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"}`}>
                                {item.item_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.order_code ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-600">{item.description ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-600">{item.qty ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-500">{item.unit ?? "—"}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                disabled={deleting === item.id}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

            {/* RIGHT — Add orders panel */}
            <div>
              {showAddPanel && (
                <div className={`${card} p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add Orders</h2>
                    <button onClick={() => setShowAddPanel(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {!pl.delivery_address_id && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 mb-3">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700">No delivery address set. Edit the packing list to assign one before adding orders.</p>
                    </div>
                  )}

                  {loadingEligible ? (
                    <div className="flex justify-center py-8">
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
                            {tab} ({tab === "Swatch" ? eligible.swatches.length : eligible.styles.length})
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
                      <div className="max-h-72 overflow-y-auto space-y-1">
                        {filteredOrders.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-6">
                            {pl.delivery_address_id ? "No eligible orders for this client + delivery address" : "Set a delivery address to see eligible orders"}
                          </p>
                        ) : filteredOrders.map(order => {
                          const inList = pl.items.some(i => i.item_type === orderTab && i.item_id === order.id);
                          return (
                            <button
                              key={order.id}
                              onClick={() => !inList && handleAddItem(order, orderTab)}
                              disabled={inList || addingItem === order.id}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-all text-left ${
                                inList
                                  ? "bg-green-50 border-green-200 text-green-700 cursor-default"
                                  : "bg-white border-gray-200 hover:border-yellow-300 hover:bg-yellow-50 text-gray-700"
                              }`}
                            >
                              <div>
                                <div className="font-semibold">{order.order_code}</div>
                                <div className="text-gray-500 truncate max-w-[180px]">{order.name}</div>
                              </div>
                              {inList ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              ) : addingItem === order.id ? (
                                <div className="h-3.5 w-3.5 rounded-full border border-gray-300 animate-spin border-t-transparent" />
                              ) : (
                                <Plus className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {!showAddPanel && (
                <div className={`${card} p-5`}>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Info</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Created</span>
                      <span className="font-medium text-gray-800">{pl.created_at ? new Date(pl.created_at).toLocaleDateString("en-IN") : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Items</span>
                      <span className="font-bold text-gray-900">{pl.items.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Swatch Orders</span>
                      <span className="font-medium text-purple-700">{pl.items.filter(i => i.item_type === "Swatch").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Style Orders</span>
                      <span className="font-medium text-teal-700">{pl.items.filter(i => i.item_type === "Style").length}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={printPdf}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
                    >
                      <Printer className="h-4 w-4" />
                      Print Packing List PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
