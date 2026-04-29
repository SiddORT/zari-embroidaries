import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Package, Plus, Search, X, Eye, Trash2, FileText,
  ChevronLeft, ChevronRight, Layers, MapPin
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";

const G = "#C6AF4B";

interface PL {
  id: number;
  pl_number: string;
  client_name: string;
  delivery_address_label: string | null;
  address_line1: string | null;
  city: string | null;
  addr_country: string | null;
  shipment_tracking: string | null;
  destination_country: string | null;
  total_packages: string | null;
  total_net_weight: string | null;
  total_gross_weight: string | null;
  total_items: string | null;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  Draft:     "bg-gray-50 text-gray-600 border-gray-200",
  Ready:     "bg-blue-50 text-blue-700 border-blue-200",
  Shipped:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-red-50 text-red-600 border-red-200",
};

const STATUSES = ["Draft", "Ready", "Shipped", "Cancelled"];

const card = "bg-white rounded-2xl border border-gray-200 shadow-sm";

export default function PackingLists() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("zarierp_token");
  const { data: user, isError } = useGetMe({ query: { enabled: !!token } as any });
  const logoutMutation = useLogout();

  const [records, setRecords] = useState<PL[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [clients, setClients] = useState<{ id: number; brandName: string }[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const LIMIT = 10;

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSettled: () => { localStorage.removeItem("zarierp_token"); qc.clear(); setLocation("/login"); },
    });
  }

  useEffect(() => {
    if (!token || isError) { localStorage.removeItem("zarierp_token"); setLocation("/login"); }
  }, [token, isError]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterClient ? { client_id: filterClient } : {}),
      });
      const res = await customFetch<any>(`/api/packing-lists?${params}`);
      let rows: PL[] = res.data ?? [];
      if (search.trim()) {
        const q = search.toLowerCase();
        rows = rows.filter(r =>
          [r.pl_number, r.client_name, r.delivery_address_label, r.shipment_tracking, r.status, r.destination_country]
            .some(v => (v ?? "").toLowerCase().includes(q))
        );
      }
      setRecords(rows);
      setTotal(res.total ?? rows.length);
    } catch {
      toast({ title: "Error", description: "Failed to load packing lists", variant: "destructive" });
    } finally { setLoading(false); }
  }, [page, filterStatus, filterClient, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    customFetch<any>("/api/clients/all")
      .then(res => setClients(res ?? []))
      .catch(() => {});
  }, []);

  async function handlePrintPdf(id: number) {
    try {
      const token = localStorage.getItem("zarierp_token");
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const response = await fetch(`${base}/api/packing-lists/${id}/pdf-html`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const win = window.open("", "_blank");
      if (!win) {
        toast({ title: "Popup blocked", description: "Please allow popups and try again", variant: "destructive" });
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 600);
    } catch (err: any) {
      toast({ title: "Failed to load PDF", description: err?.message ?? "Unknown error", variant: "destructive" });
    }
  }

  async function handleDelete(id: number, pl_number: string) {
    if (!confirm(`Delete packing list ${pl_number}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await customFetch(`/api/packing-lists/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: `${pl_number} deleted` });
      load();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    } finally { setDeletingId(null); }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  if (!user && !isError) return null;

  return (
    <AppLayout
      username={user?.username ?? ""}
      role={user?.role ?? ""}
      onLogout={handleLogout}
      isLoggingOut={logoutMutation.isPending}
    >
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(198,175,75,0.12)" }}>
              <Package className="h-5 w-5" style={{ color: G }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Packing Lists</h1>
              <p className="text-sm text-gray-900">Manage packing lists per client, delivery address and shipment</p>
            </div>
          </div>
          <button
            onClick={() => setLocation("/logistics/packing-lists/new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
            style={{ backgroundColor: G }}
          >
            <Plus className="h-4 w-4" />
            New Packing List
          </button>
        </div>

        {/* Filters */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search PL number, client, shipment..."
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-200"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select
              value={filterClient}
              onChange={e => { setFilterClient(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            >
              <option value="">All Clients</option>
              {clients.map(c => <option key={c.id} value={String(c.id)}>{c.brandName}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className={card}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="h-6 w-6 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: G }} />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-gray-50">
                <Layers className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">No packing lists found</p>
              <button
                onClick={() => setLocation("/logistics/packing-lists/new")}
                className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all hover:opacity-90"
                style={{ backgroundColor: G }}
              >
                Create First Packing List
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {["#", "PL Number", "Client", "Delivery Address", "Shipment", "Destination", "Packages", "Net Wt", "Gross Wt", "Status", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-900 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {records.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-900 text-xs font-medium whitespace-nowrap">{(page - 1) * LIMIT + idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{r.pl_number}</td>
                        <td className="px-4 py-3 text-gray-900">{r.client_name}</td>
                        <td className="px-4 py-3">
                          {r.delivery_address_label ? (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
                              <div>
                                <div className="font-medium text-gray-900">{r.delivery_address_label}</div>
                                <div className="text-xs text-gray-900">{[r.city, r.addr_country].filter(Boolean).join(", ")}</div>
                              </div>
                            </div>
                          ) : <span className="text-gray-900">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-mono text-xs">{r.shipment_tracking ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-900">{r.destination_country ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-900 font-semibold">{r.total_packages ?? "0"}</td>
                        <td className="px-4 py-3 text-gray-900 text-xs">{r.total_net_weight ? `${Number(r.total_net_weight).toFixed(2)} kg` : "—"}</td>
                        <td className="px-4 py-3 text-gray-900 text-xs">{r.total_gross_weight ? `${Number(r.total_gross_weight).toFixed(2)} kg` : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[r.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setLocation(`/logistics/packing-lists/${r.id}`)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handlePrintPdf(r.id)}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                              title="Print PDF"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id, r.pl_number)}
                              disabled={deletingId === r.id}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <span className="text-sm text-gray-900">
                    {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-900 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2).map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          p === page ? "text-white" : "text-gray-900 hover:bg-gray-100"
                        }`}
                        style={p === page ? { backgroundColor: G } : {}}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-900 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
