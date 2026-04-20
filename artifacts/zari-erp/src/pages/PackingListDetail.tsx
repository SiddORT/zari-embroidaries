import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import {
  Package, ArrowLeft, Edit2, Printer, MapPin, Truck,
  Trash2, Plus, AlertCircle, Search, X, Camera, XCircle,
  Box, ChevronDown, ChevronUp, Save
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
  address_line1: string | null; city: string | null; state: string | null;
  addr_country: string | null; addr_pincode: string | null;
  shipment_id: number | null; shipment_tracking: string | null;
  shipment_date: string | null; shipment_status_val: string | null;
  destination_country: string | null;
  status: string; remarks: string | null; created_at: string;
  packages: PLPackage[];
}

interface PLPackage {
  id: number;
  packing_list_id: number;
  package_number: number;
  length: string | null; width: string | null; height: string | null;
  net_weight: string | null; gross_weight: string | null;
  item_count: string;
  items: PLPackageItem[];
  expanded?: boolean;
}

interface PLPackageItem {
  id: number; package_id: number;
  order_type: string; order_id: number;
  order_code: string | null; description: string | null;
  quantity: string | null; unit: string | null;
  item_weight: string | null; item_image_url: string | null;
}

interface EligibleOrder {
  id: number; order_code: string; name: string;
  delivery_address_id: number | null; order_status: string;
  quantity: string | null; already_added: boolean;
}

interface Shipment {
  id: number; reference_type: string; tracking_number: string | null;
  shipment_status: string; order_code: string | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm text-gray-900 font-medium">{value || "—"}</div>
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

  // Expanded state for packages
  const [expandedPkgs, setExpandedPkgs] = useState<Set<number>>(new Set());

  // Add order to package panel
  const [addingToPkg, setAddingToPkg] = useState<number | null>(null);
  const [eligible, setEligible] = useState<{ swatches: EligibleOrder[]; styles: EligibleOrder[] }>({ swatches: [], styles: [] });
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [orderTab, setOrderTab] = useState<"Swatch" | "Style">("Swatch");
  const [orderSearch, setOrderSearch] = useState("");
  const [addingItemId, setAddingItemId] = useState<number | null>(null);

  // Weight editing: itemId → draft
  const [itemWeights, setItemWeights] = useState<Record<number, string>>({});
  const [savingWeightId, setSavingWeightId] = useState<number | null>(null);

  // Package dimension editing
  const [editingPkg, setEditingPkg] = useState<number | null>(null);
  const [pkgDims, setPkgDims] = useState<Record<number, { length: string; width: string; height: string; net_weight: string; gross_weight: string }>>({});
  const [savingPkgId, setSavingPkgId] = useState<number | null>(null);

  // Image upload
  const [uploadingImageId, setUploadingImageId] = useState<number | null>(null);
  const [removingImageId, setRemovingImageId] = useState<number | null>(null);
  const [artworkImages, setArtworkImages] = useState<Record<number, { data: string; name: string } | null>>({});
  const imageTargetRef = useRef<{ pkgId: number; itemId: number } | null>(null);

  // Shipment linking
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [editingShipment, setEditingShipment] = useState(false);
  const [draftShipmentId, setDraftShipmentId] = useState<number | "">("");
  const [savingShipment, setSavingShipment] = useState(false);

  // Deleting
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [deletingPkgId, setDeletingPkgId] = useState<number | null>(null);
  const [addingPkg, setAddingPkg] = useState(false);

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
      const data = res.data;
      // Expand all packages by default
      const ids = new Set<number>((data.packages ?? []).map((p: PLPackage) => p.id));
      setExpandedPkgs(ids);
      setPl(data);
    } catch {
      toast({ title: "Error", description: "Failed to load packing list", variant: "destructive" });
    } finally { setLoading(false); }
  }

  useEffect(() => { loadPl(); }, [params.id]);

  // Load all shipments for linking
  useEffect(() => {
    customFetch<any>("/api/shipping/details?limit=500")
      .then(j => setShipments(j.data ?? []))
      .catch(() => {});
  }, []);

  async function handleSaveShipment() {
    setSavingShipment(true);
    try {
      await customFetch(`/api/packing-lists/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({ shipment_id: draftShipmentId || null }),
      });
      await loadPl();
      setEditingShipment(false);
      toast({ title: "Shipment linked", description: "Packing list updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.data?.error ?? e?.message ?? "Failed to update", variant: "destructive" });
    } finally { setSavingShipment(false); }
  }

  // Fetch artwork images for items without uploaded images
  useEffect(() => {
    if (!pl) return;
    for (const pkg of pl.packages) {
      for (const item of pkg.items) {
        if (item.item_image_url) continue;
        if (artworkImages[item.id] !== undefined) continue;
        fetch(`/api/packing-lists/order-artwork-image?type=${encodeURIComponent(item.order_type)}&item_id=${item.order_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.json())
          .then(json => setArtworkImages(prev => ({ ...prev, [item.id]: json.data ?? null })))
          .catch(() => setArtworkImages(prev => ({ ...prev, [item.id]: null })));
      }
    }
  }, [pl?.packages]);

  async function loadEligible() {
    setLoadingEligible(true);
    try {
      const res = await customFetch<any>(`/api/packing-lists/${params.id}/eligible-orders`);
      setEligible({ swatches: res.swatches ?? [], styles: res.styles ?? [] });
    } catch {} finally { setLoadingEligible(false); }
  }

  function openAddPanel(pkgId: number) {
    if (addingToPkg === pkgId) { setAddingToPkg(null); return; }
    setAddingToPkg(pkgId);
    setOrderSearch("");
    loadEligible();
  }

  async function handleAddItem(order: EligibleOrder, type: "Swatch" | "Style") {
    if (!addingToPkg) return;
    setAddingItemId(order.id);
    try {
      await customFetch(`/api/packing-lists/${params.id}/packages/${addingToPkg}/items`, {
        method: "POST",
        body: JSON.stringify({
          order_type: type, order_id: order.id,
          order_code: order.order_code, description: order.name,
          quantity: order.quantity, unit: "pcs",
        }),
      });
      await loadPl();
      await loadEligible();
      toast({ title: "Added", description: `${order.order_code} added to package` });
    } catch (e: any) {
      toast({ title: "Cannot add", description: e?.data?.error ?? e?.message ?? "Item blocked", variant: "destructive" });
    } finally { setAddingItemId(null); }
  }

  async function handleDeleteItem(pkgId: number, itemId: number) {
    setDeletingItemId(itemId);
    try {
      await customFetch(`/api/packing-lists/${params.id}/packages/${pkgId}/items/${itemId}`, { method: "DELETE" });
      setPl(prev => prev ? {
        ...prev,
        packages: prev.packages.map(p => p.id === pkgId
          ? { ...p, items: p.items.filter(i => i.id !== itemId) }
          : p
        )
      } : prev);
      toast({ title: "Removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove item", variant: "destructive" });
    } finally { setDeletingItemId(null); }
  }

  async function handleAddPackage() {
    setAddingPkg(true);
    try {
      const res = await customFetch<any>(`/api/packing-lists/${params.id}/packages`, {
        method: "POST", body: JSON.stringify({}),
      });
      const newPkg = { ...res.data, items: [] };
      setPl(prev => prev ? { ...prev, packages: [...prev.packages, newPkg] } : prev);
      setExpandedPkgs(prev => new Set([...prev, newPkg.id]));
      toast({ title: "Package added", description: `Package ${newPkg.package_number} created` });
    } catch {
      toast({ title: "Error", description: "Failed to add package", variant: "destructive" });
    } finally { setAddingPkg(false); }
  }

  async function handleDeletePackage(pkgId: number) {
    if (!confirm("Delete this package and all its items?")) return;
    setDeletingPkgId(pkgId);
    try {
      await customFetch(`/api/packing-lists/${params.id}/packages/${pkgId}`, { method: "DELETE" });
      setPl(prev => prev ? { ...prev, packages: prev.packages.filter(p => p.id !== pkgId) } : prev);
      if (addingToPkg === pkgId) setAddingToPkg(null);
      toast({ title: "Package deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete package", variant: "destructive" });
    } finally { setDeletingPkgId(null); }
  }

  function startEditPkg(pkg: PLPackage) {
    setEditingPkg(pkg.id);
    setPkgDims(prev => ({
      ...prev,
      [pkg.id]: {
        length: pkg.length ?? "",
        width: pkg.width ?? "",
        height: pkg.height ?? "",
        net_weight: pkg.net_weight ?? "",
        gross_weight: pkg.gross_weight ?? "",
      }
    }));
  }

  async function handleSavePkg(pkgId: number) {
    const dims = pkgDims[pkgId];
    if (!dims) return;
    setSavingPkgId(pkgId);
    try {
      const res = await customFetch<any>(`/api/packing-lists/${params.id}/packages/${pkgId}`, {
        method: "PUT",
        body: JSON.stringify({
          length: dims.length ? parseFloat(dims.length) : null,
          width:  dims.width  ? parseFloat(dims.width)  : null,
          height: dims.height ? parseFloat(dims.height) : null,
          net_weight:   dims.net_weight   ? parseFloat(dims.net_weight)   : null,
          gross_weight: dims.gross_weight ? parseFloat(dims.gross_weight) : null,
        }),
      });
      setPl(prev => prev ? {
        ...prev,
        packages: prev.packages.map(p => p.id === pkgId ? { ...p, ...res.data } : p)
      } : prev);
      setEditingPkg(null);
      toast({ title: "Package updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update package", variant: "destructive" });
    } finally { setSavingPkgId(null); }
  }

  async function handleSaveWeight(item: PLPackageItem, pkgId: number) {
    const raw = itemWeights[item.id];
    const val = raw !== undefined ? raw : (item.item_weight ?? "");
    setSavingWeightId(item.id);
    try {
      const parsed = val === "" ? null : parseFloat(val);
      await customFetch(`/api/packing-lists/${params.id}/packages/${pkgId}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ item_weight: parsed }),
      });
      setPl(prev => prev ? {
        ...prev,
        packages: prev.packages.map(p => p.id === pkgId
          ? { ...p, items: p.items.map(i => i.id === item.id ? { ...i, item_weight: parsed === null ? null : String(parsed) } : i) }
          : p
        )
      } : prev);
      setItemWeights(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      toast({ title: "Weight saved" });
    } catch {
      toast({ title: "Failed to save weight", variant: "destructive" });
    } finally { setSavingWeightId(null); }
  }

  function triggerImageUpload(pkgId: number, item: PLPackageItem) {
    imageTargetRef.current = { pkgId, itemId: item.id };
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploadingImageId(item.id);
      try {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch(`/api/packing-lists/${params.id}/packages/${pkgId}/items/${item.id}/image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setPl(prev => prev ? {
          ...prev,
          packages: prev.packages.map(p => p.id === pkgId
            ? { ...p, items: p.items.map(i => i.id === item.id ? { ...i, item_image_url: json.data?.item_image_url ?? null } : i) }
            : p
          )
        } : prev);
        setArtworkImages(prev => { const n = { ...prev }; delete n[item.id]; return n; });
        toast({ title: "Image uploaded" });
      } catch {
        toast({ title: "Failed to upload image", variant: "destructive" });
      } finally { setUploadingImageId(null); }
    };
    inp.click();
  }

  async function handleRemoveImage(pkgId: number, item: PLPackageItem) {
    setRemovingImageId(item.id);
    try {
      await customFetch(`/api/packing-lists/${params.id}/packages/${pkgId}/items/${item.id}/image`, { method: "DELETE" });
      setPl(prev => prev ? {
        ...prev,
        packages: prev.packages.map(p => p.id === pkgId
          ? { ...p, items: p.items.map(i => i.id === item.id ? { ...i, item_image_url: null } : i) }
          : p
        )
      } : prev);
      toast({ title: "Image removed" });
    } catch {
      toast({ title: "Failed to remove image", variant: "destructive" });
    } finally { setRemovingImageId(null); }
  }

  async function printPdf() {
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const response = await fetch(`${base}/api/packing-lists/${params.id}/pdf-html`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const win = window.open("", "_blank");
      if (!win) { toast({ title: "Popup blocked", variant: "destructive" }); return; }
      win.document.open(); win.document.write(html); win.document.close();
      win.focus(); setTimeout(() => win.print(), 600);
    } catch (e: any) {
      toast({ title: "Failed to load PDF", description: e?.message, variant: "destructive" });
    }
  }

  if (!user && !isError) return null;

  const addrParts = pl ? [pl.address_line1, pl.city, pl.state, pl.addr_country, pl.addr_pincode].filter(Boolean) : [];

  const totalNetWeight = pl?.packages.reduce((s, p) => s + parseFloat(p.net_weight ?? "0"), 0) ?? 0;
  const totalGrossWeight = pl?.packages.reduce((s, p) => s + parseFloat(p.gross_weight ?? "0"), 0) ?? 0;
  const totalItems = pl?.packages.reduce((s, p) => s + p.items.length, 0) ?? 0;

  const filteredOrders = (orderTab === "Swatch" ? eligible.swatches : eligible.styles)
    .filter(o => !o.already_added)
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
          <button onClick={() => setLocation("/logistics/packing-lists")} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(198,175,75,0.12)" }}>
              <Package className="h-5 w-5" style={{ color: G }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{pl?.pl_number ?? "Loading…"}</h1>
              {pl && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[pl.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {pl.status}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={printPdf} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-700">
              <Printer className="h-4 w-4" />
              Print PDF
            </button>
            <button
              onClick={() => setLocation(`/logistics/packing-lists/${params.id}/edit`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
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
          <div className="space-y-5">

            {/* Info Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Packages", value: pl.packages.length, color: "text-gray-900" },
                { label: "Total Items", value: totalItems, color: "text-gray-900" },
                { label: "Total Net Weight", value: totalNetWeight > 0 ? `${totalNetWeight.toFixed(3)} kg` : "—", color: "text-gray-900" },
                { label: "Total Gross Weight", value: totalGrossWeight > 0 ? `${totalGrossWeight.toFixed(3)} kg` : "—", color: "text-gray-900" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`${card} p-4`}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</div>
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Grouping + Shipment */}
            <div className={`${card} p-6`}>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Grouping &amp; Shipment</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
                <Field label="Client" value={pl.client_name} />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Delivery Address</div>
                  {pl.delivery_address_label ? (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{pl.delivery_address_label}</div>
                        <div className="text-xs text-gray-600">{addrParts.join(", ")}</div>
                      </div>
                    </div>
                  ) : <div className="text-sm text-gray-500">—</div>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Shipment</div>
                    {!editingShipment ? (
                      <button
                        onClick={() => { setEditingShipment(true); setDraftShipmentId(pl.shipment_id ?? ""); }}
                        className="text-[10px] font-semibold hover:underline"
                        style={{ color: G }}
                      >
                        {pl.shipment_id ? "Change" : "Link"}
                      </button>
                    ) : (
                      <button onClick={() => setEditingShipment(false)} className="text-[10px] text-gray-400 hover:text-gray-600">Cancel</button>
                    )}
                  </div>
                  {editingShipment ? (
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        value={draftShipmentId}
                        onChange={e => setDraftShipmentId(e.target.value ? parseInt(e.target.value) : "")}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-yellow-200"
                      >
                        <option value="">No shipment</option>
                        {shipments.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.reference_type} — {s.tracking_number ?? `#${s.id}`} ({s.shipment_status})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleSaveShipment}
                        disabled={savingShipment}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: G }}
                      >
                        {savingShipment
                          ? <div className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                          : <Save className="h-3 w-3" />}
                        Save
                      </button>
                    </div>
                  ) : pl.shipment_tracking ? (
                    <div className="flex items-start gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 font-mono">{pl.shipment_tracking}</div>
                        {pl.shipment_date && <div className="text-xs text-gray-600">{new Date(pl.shipment_date).toLocaleDateString("en-IN")}</div>}
                      </div>
                    </div>
                  ) : <div className="text-sm text-gray-500">—</div>}
                </div>
                <Field label="Destination" value={pl.destination_country} />
                {pl.remarks && <div className="sm:col-span-4"><Field label="Remarks" value={pl.remarks} /></div>}
              </div>
            </div>

            {/* Packages */}
            <div className={card}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4" style={{ color: G }} />
                  <h2 className="text-sm font-bold text-gray-900">Packages ({pl.packages.length})</h2>
                </div>
                <button
                  onClick={handleAddPackage}
                  disabled={addingPkg}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: G }}
                >
                  {addingPkg
                    ? <div className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    : <Plus className="h-3.5 w-3.5" />}
                  Add Package
                </button>
              </div>

              {pl.packages.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">
                  No packages yet. Click "Add Package" to create the first package.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {pl.packages.map((pkg) => {
                    const isExpanded = expandedPkgs.has(pkg.id);
                    const isEditingDims = editingPkg === pkg.id;
                    const dims = pkgDims[pkg.id];
                    const dimStr = [pkg.length, pkg.width, pkg.height].filter(Boolean).map(v => v + " cm").join(" × ");

                    return (
                      <div key={pkg.id}>
                        {/* Package header */}
                        <div
                          className="flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedPkgs(prev => {
                            const n = new Set(prev);
                            n.has(pkg.id) ? n.delete(pkg.id) : n.add(pkg.id);
                            return n;
                          })}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-xl text-white text-sm font-bold shrink-0" style={{ backgroundColor: G }}>
                            {pkg.package_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-gray-800 text-sm">Package {pkg.package_number}</span>
                            <div className="flex flex-wrap gap-3 mt-0.5">
                              {dimStr && <span className="text-xs text-gray-400">📦 {dimStr}</span>}
                              {pkg.net_weight && <span className="text-xs text-gray-400">Net: {Number(pkg.net_weight).toFixed(3)} kg</span>}
                              {pkg.gross_weight && <span className="text-xs text-gray-400">Gross: {Number(pkg.gross_weight).toFixed(3)} kg</span>}
                              <span className="text-xs text-gray-400">{pkg.items.length} item{pkg.items.length !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => openAddPanel(pkg.id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                addingToPkg === pkg.id
                                  ? "border-amber-300 bg-amber-100 text-amber-800"
                                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <Plus className="h-3 w-3" />
                              {addingToPkg === pkg.id ? "Selecting…" : "Add Orders"}
                            </button>
                            <button
                              onClick={() => isEditingDims ? setEditingPkg(null) : startEditPkg(pkg)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                              title="Edit dimensions"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePackage(pkg.id)}
                              disabled={deletingPkgId === pkg.id}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-6 pb-5 border-t border-gray-50">
                            {/* Dimension edit form */}
                            {isEditingDims && dims && (
                              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                                  {[
                                    { label: "L (cm)", key: "length" as const },
                                    { label: "W (cm)", key: "width" as const },
                                    { label: "H (cm)", key: "height" as const },
                                    { label: "Net Wt", key: "net_weight" as const },
                                    { label: "Gross Wt", key: "gross_weight" as const },
                                  ].map(({ label, key }) => (
                                    <div key={key}>
                                      <label className="block text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">{label}</label>
                                      <input
                                        type="number" step="0.01" min="0"
                                        value={dims[key]}
                                        onChange={e => setPkgDims(prev => ({ ...prev, [pkg.id]: { ...prev[pkg.id], [key]: e.target.value } }))}
                                        className="w-full border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                                        placeholder="0"
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSavePkg(pkg.id)}
                                    disabled={savingPkgId === pkg.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                                    style={{ backgroundColor: G }}
                                  >
                                    {savingPkgId === pkg.id
                                      ? <div className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                      : <Save className="h-3 w-3" />}
                                    Save
                                  </button>
                                  <button onClick={() => setEditingPkg(null)} className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-white border border-blue-200">Cancel</button>
                                </div>
                              </div>
                            )}

                            {/* Order add panel */}
                            {addingToPkg === pkg.id && (
                              <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Add Orders to Package {pkg.package_number}</span>
                                  <button onClick={() => setAddingToPkg(null)} className="text-amber-400 hover:text-amber-600">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                {loadingEligible ? (
                                  <div className="flex justify-center py-4">
                                    <div className="h-5 w-5 rounded-full border-2 border-amber-200 animate-spin" style={{ borderTopColor: G }} />
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex gap-1 mb-3 bg-amber-100 p-1 rounded-lg">
                                      {(["Swatch", "Style"] as const).map(tab => (
                                        <button
                                          key={tab}
                                          onClick={() => setOrderTab(tab)}
                                          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                            orderTab === tab ? "bg-white shadow text-gray-900" : "text-amber-700 hover:text-amber-900"
                                          }`}
                                        >
                                          {tab} ({tab === "Swatch" ? eligible.swatches.filter(o => !o.already_added).length : eligible.styles.filter(o => !o.already_added).length})
                                        </button>
                                      ))}
                                    </div>
                                    <div className="relative mb-2">
                                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                      <input
                                        value={orderSearch}
                                        onChange={e => setOrderSearch(e.target.value)}
                                        placeholder="Search orders…"
                                        className="w-full pl-7 py-1.5 border border-amber-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
                                      />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                      {filteredOrders.length === 0 ? (
                                        <div className="text-xs text-gray-400 text-center py-4">No available orders</div>
                                      ) : filteredOrders.map(order => (
                                        <button
                                          key={order.id}
                                          onClick={() => handleAddItem(order, orderTab)}
                                          disabled={addingItemId === order.id}
                                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white text-left border border-transparent hover:border-amber-200 transition-all group"
                                        >
                                          <Plus className="h-3.5 w-3.5 shrink-0 text-amber-400 group-hover:text-amber-600" />
                                          <div className="min-w-0">
                                            <div className="text-xs font-semibold text-gray-800 font-mono">{order.order_code}</div>
                                            <div className="text-[11px] text-gray-500 truncate">{order.name}</div>
                                          </div>
                                          {addingItemId === order.id && (
                                            <div className="ml-auto h-3 w-3 rounded-full border border-amber-400 border-t-transparent animate-spin" />
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Items table */}
                            {pkg.items.length === 0 ? (
                              <div className="mt-4 text-center py-8 text-xs text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                No items in this package. Click "Add Orders" to add.
                              </div>
                            ) : (
                              <div className="overflow-x-auto mt-4 rounded-xl border border-gray-100">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                      {["#", "Image", "Type", "Order Code", "Description", "Qty", "Unit", "Weight (kg)", ""].map(h => (
                                        <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {pkg.items.map((item, idx) => (
                                      <tr key={item.id}>
                                        <td className="px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                                        <td className="px-3 py-3">
                                          {item.item_image_url ? (
                                            <div className="relative group w-12 h-12">
                                              <img src={item.item_image_url} alt="item" className="w-12 h-12 object-cover rounded-lg border border-gray-200" />
                                              <button
                                                onClick={() => handleRemoveImage(pkg.id, item)}
                                                disabled={removingImageId === item.id}
                                                className="absolute -top-1 -right-1 bg-white rounded-full shadow text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                              >
                                                <XCircle className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          ) : artworkImages[item.id] !== undefined ? (
                                            artworkImages[item.id] !== null ? (
                                              <div className="relative group w-12 h-12">
                                                <img src={artworkImages[item.id]!.data} alt="artwork" className="w-12 h-12 object-cover rounded-lg border border-amber-200" />
                                                <button
                                                  onClick={() => triggerImageUpload(pkg.id, item)}
                                                  className="absolute -top-1 -right-1 bg-white rounded-full shadow text-amber-500 hover:text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  <Camera className="h-3 w-3" />
                                                </button>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => triggerImageUpload(pkg.id, item)}
                                                disabled={uploadingImageId === item.id}
                                                className="flex items-center justify-center w-12 h-12 rounded-lg border-2 border-dashed border-gray-200 text-gray-300 hover:border-amber-400 hover:text-amber-400 transition-colors"
                                              >
                                                {uploadingImageId === item.id ? <span className="text-[10px]">…</span> : <Camera className="h-4 w-4" />}
                                              </button>
                                            )
                                          ) : (
                                            <div className="flex items-center justify-center w-12 h-12 rounded-lg border border-gray-100 text-gray-200">
                                              <span className="text-[10px]">…</span>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-3 py-3">
                                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.order_type === "Swatch" ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"}`}>
                                            {item.order_type}
                                          </span>
                                        </td>
                                        <td className="px-3 py-3 font-mono text-xs text-gray-700">{item.order_code ?? "—"}</td>
                                        <td className="px-3 py-3 text-gray-600 text-xs max-w-[140px] truncate">{item.description ?? "—"}</td>
                                        <td className="px-3 py-3 text-gray-600 text-xs">{item.quantity ?? "—"}</td>
                                        <td className="px-3 py-3 text-gray-500 text-xs">{item.unit ?? "—"}</td>
                                        <td className="px-3 py-3">
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number" step="0.001" min="0"
                                              placeholder="—"
                                              value={itemWeights[item.id] !== undefined ? itemWeights[item.id] : (item.item_weight ?? "")}
                                              onChange={e => setItemWeights(prev => ({ ...prev, [item.id]: e.target.value }))}
                                              onBlur={() => { if (itemWeights[item.id] !== undefined) handleSaveWeight(item, pkg.id); }}
                                              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-yellow-200"
                                            />
                                            {savingWeightId === item.id && (
                                              <div className="h-3 w-3 rounded-full border border-gray-300 border-t-transparent animate-spin" />
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-3">
                                          <button
                                            onClick={() => handleDeleteItem(pkg.id, item.id)}
                                            disabled={deletingItemId === item.id}
                                            className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
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
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
