import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Package, Truck, Search, X, ExternalLink, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";

const G = "#C6AF4B";

interface ShippingRecord {
  id: number;
  reference_type: string;
  reference_id: number;
  order_code: string | null;
  client_name: string | null;
  vendor_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipment_weight: string;
  final_shipping_amount: string;
  shipment_status: string;
  shipment_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
}

interface Vendor { id: number; vendor_name: string; }

const STATUS_COLORS: Record<string, string> = {
  Pending:      "bg-gray-50 text-gray-600 border-gray-200",
  Dispatched:   "bg-blue-50 text-blue-700 border-blue-200",
  "In Transit": "bg-amber-50 text-amber-700 border-amber-200",
  Delivered:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  Returned:     "bg-orange-50 text-orange-700 border-orange-200",
  Cancelled:    "bg-red-50 text-red-600 border-red-200",
};

const STATUSES = ["Pending", "Dispatched", "In Transit", "Delivered", "Returned", "Cancelled"];
const REF_TYPES = ["Swatch", "Style"];

export default function ShippingList() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("zarierp_token");
  const { data: user, isError } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();

  const [records, setRecords] = useState<ShippingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterRefType, setFilterRefType] = useState("");
  const [fromDate, setFromDate] = useState("");

  const LIMIT = 20;

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSettled: () => { localStorage.removeItem("zarierp_token"); qc.clear(); setLocation("/login"); },
    });
  }

  useEffect(() => {
    if (!token || isError) { localStorage.removeItem("zarierp_token"); setLocation("/login"); }
  }, [token, isError]);

  useEffect(() => {
    customFetch<any>("/api/shipping/vendors/all?limit=200").then(j => setVendors(j.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterVendor) params.set("vendorId", filterVendor);
      if (filterRefType) params.set("referenceType", filterRefType);
      if (fromDate) params.set("fromDate", fromDate);
      const j = await customFetch<any>(`/api/shipping/details?${params}`);
      setRecords(j.data);
      setTotal(j.total);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterVendor, filterRefType, fromDate]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(id: number, newStatus: string) {
    setUpdatingId(id);
    try {
      await customFetch(`/api/shipping/details/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ shipment_status: newStatus }),
      });
      toast({ title: "Status updated", description: `Shipment marked as ${newStatus}` });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  }

  const fmt = (n: string | number) => parseFloat(String(n)).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
  const sel = "rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#C6AF4B] bg-white";
  const inp = "rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#C6AF4B] bg-white";

  const totalPages = Math.ceil(total / LIMIT);
  const startIdx = (page - 1) * LIMIT;

  return (
    <AppLayout username={user?.name ?? user?.email ?? ""} role={user?.role ?? ""} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: `${G}20` }}>
            <Truck size={20} style={{ color: G }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
            <p className="text-sm text-gray-500">Track all outbound shipments across Swatch and Style orders</p>
          </div>
          <span className="ml-auto text-sm text-gray-400">{total} total</span>
        </div>

        {/* Filters */}
        <div className={`${card} p-4`}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="relative lg:col-span-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Track no, ref ID, client…" className={inp + " pl-8 w-full"} />
            </div>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className={sel}>
              <option value="">All Status</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterRefType} onChange={e => { setFilterRefType(e.target.value); setPage(1); }} className={sel}>
              <option value="">All Types</option>
              {REF_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filterVendor} onChange={e => { setFilterVendor(e.target.value); setPage(1); }} className={sel}>
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
            </select>
            <div className="flex gap-2 items-center">
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} className={inp + " flex-1 min-w-0"} title="From date" />
              {(search || filterStatus || filterVendor || filterRefType || fromDate) && (
                <button onClick={() => { setSearch(""); setFilterStatus(""); setFilterVendor(""); setFilterRefType(""); setFromDate(""); setPage(1); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition flex-shrink-0" title="Clear filters">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C6AF4B]/15">
                  {["Sr.", "Type", "Ref ID", "Client", "Vendor", "Tracking No.", "Weight", "Cost", "Status", "Ship Date", "EDD", "ADD", "Change Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 13 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : records.length === 0 ? (
                  <tr><td colSpan={13} className="py-16 text-center">
                    <Package size={40} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400 font-medium">No shipments found</p>
                    <p className="text-xs text-gray-300 mt-1">Add shipping details from approved Swatch or Style orders</p>
                  </td></tr>
                ) : records.map((r, idx) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-gray-400 text-xs font-medium">{startIdx + idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${r.reference_type === "Swatch" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-sky-50 text-sky-700 border-sky-200"}`}>{r.reference_type}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.order_code || `#${r.reference_id}`}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[120px] truncate">{r.client_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.vendor_name || "—"}</td>
                    <td className="px-4 py-3">
                      {r.tracking_number ? (
                        r.tracking_url ? (
                          <a href={r.tracking_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline font-mono text-xs">
                            {r.tracking_number} <ExternalLink size={10} />
                          </a>
                        ) : <span className="font-mono text-xs text-gray-700">{r.tracking_number}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{parseFloat(r.shipment_weight).toFixed(3)} kg</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">₹{fmt(r.final_shipping_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[r.shipment_status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>{r.shipment_status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.shipment_date)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.expected_delivery_date)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.actual_delivery_date)}</td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <select
                          value={r.shipment_status}
                          disabled={updatingId === r.id}
                          onChange={e => handleStatusChange(r.id, e.target.value)}
                          className="appearance-none pr-7 pl-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none focus:border-[#C6AF4B] disabled:opacity-50 cursor-pointer"
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Showing {startIdx + 1}–{Math.min(page * LIMIT, total)} of {total}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"><ChevronLeft size={14} /></button>
                <span className="text-sm text-gray-600 px-2">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
