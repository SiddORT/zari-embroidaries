import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Eye, Trash2, ChevronLeft, ChevronRight, Palette, Calendar, User, Hash, LayoutGrid, LayoutList } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useSwatchOrderList, useDeleteSwatchOrder, type SwatchOrderRecord } from "@/hooks/useSwatchOrders";

const ORDER_STATUSES = ["Draft", "Issued", "In Sampling", "In Artwork", "Pending Approval", "Completed", "Rejected", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const G = "#C6AF4B";
const CARD = "bg-white rounded-2xl border border-[#C6AF4B]/20 overflow-hidden shadow-[0_2px_16px_rgba(198,175,75,0.10),0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_24px_rgba(198,175,75,0.20),0_2px_6px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-300";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Issued: "bg-blue-50 text-blue-700 border-blue-200",
  "In Sampling": "bg-amber-50 text-amber-700 border-amber-200",
  "In Artwork": "bg-purple-50 text-purple-700 border-purple-200",
  "Pending Approval": "bg-orange-50 text-orange-700 border-orange-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Cancelled: "bg-gray-50 text-gray-500 border-gray-200",
};

const STATUS_BAR: Record<string, string> = {
  Draft: "bg-gray-300",
  Issued: "bg-blue-400",
  "In Sampling": "bg-amber-400",
  "In Artwork": "bg-purple-500",
  "Pending Approval": "bg-orange-400",
  Completed: "bg-emerald-500",
  Rejected: "bg-red-400",
  Cancelled: "bg-gray-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600",
  Medium: "bg-sky-100 text-sky-700",
  High: "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {status}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[priority] ?? "bg-gray-100 text-gray-600"}`}>
      {priority}
    </span>
  );
}

function OrderCard({ order, onView, onDelete }: {
  order: SwatchOrderRecord;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={CARD}>
      <div className={`h-1 w-full ${STATUS_BAR[order.orderStatus] ?? "bg-gray-200"}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{order.orderCode}</span>
              <PriorityDot priority={order.priority} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 truncate">{order.swatchName}</h3>
            {order.clientName && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <User className="h-3 w-3" />{order.clientName}
              </p>
            )}
          </div>
          <StatusBadge status={order.orderStatus} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4">
          {order.deliveryDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>Due {order.deliveryDate}</span>
            </div>
          )}
          {order.quantity && (
            <div className="flex items-center gap-1.5">
              <Hash className="h-3 w-3 shrink-0" />
              <span>Qty: {order.quantity}</span>
            </div>
          )}
          {order.fabricName && (
            <div className="flex items-center gap-1.5 col-span-2">
              <Palette className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.fabricName}</span>
            </div>
          )}
        </div>

        {order.isChargeable && (
          <div className="text-xs font-medium rounded-lg px-2.5 py-1 mb-3 inline-flex items-center gap-1" style={{ background: "rgba(198,175,75,0.10)", color: "#A8943E" }}>
            ⚡ Chargeable
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <button onClick={onView}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium bg-gray-900 hover:bg-black transition-colors"
            style={{ color: G }}>
            <Eye className="h-3.5 w-3.5" /> View / Edit
          </button>
          <button onClick={onDelete}
            className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-gray-100">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SwatchOrders() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [chargeableFilter, setChargeableFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [view, setView] = useState<"grid" | "table">("grid");

  const { data, isLoading } = useSwatchOrderList({ search, status: statusFilter, priority: priorityFilter, chargeable: chargeableFilter, page, limit: 24 });
  const deleteOrder = useDeleteSwatchOrder();

  const orders = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 24);

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("zarierp_token");
        qc.removeQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
      },
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteOrder.mutateAsync(deleteId);
      toast({ title: "Swatch order deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  if (loadingUser) return null;
  if (!user) { setLocation("/login"); return null; }

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Swatch Orders</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {total} order{total !== 1 ? "s" : ""} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => setView("grid")} title="Grid view"
                className={`p-2 transition-colors ${view === "grid" ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setView("table")} title="Table view"
                className={`p-2 transition-colors ${view === "table" ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setLocation("/swatch-orders/new")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-sm font-medium hover:bg-black transition-colors shadow-sm"
              style={{ color: G }}
            >
              <Plus className="h-4 w-4" /> New Swatch Order
            </button>
          </div>
        </div>

        {/* Status pills quick filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setStatusFilter("all"); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${statusFilter === "all" ? "bg-gray-900 border-gray-900 text-white" : "border-gray-200 text-gray-900 hover:border-gray-400"}`}>
            All
          </button>
          {ORDER_STATUSES.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${statusFilter === s ? `${STATUS_COLORS[s]} font-semibold` : "border-gray-200 text-gray-900 hover:border-gray-400"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Search + Priority + Chargeable */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search swatch name, client…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 focus:border-[#C6AF4B]/50"
            />
          </div>
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 focus:border-[#C6AF4B]/50">
            <option value="all">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={chargeableFilter} onChange={e => { setChargeableFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 focus:border-[#C6AF4B]/50">
            <option value="all">All (Chargeable)</option>
            <option value="yes">Chargeable</option>
            <option value="no">Not Chargeable</option>
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#C6AF4B]/15 h-48 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[#C6AF4B]/30">
            <Palette className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No swatch orders found</p>
            <p className="text-xs text-gray-400 mt-1">Create your first swatch order to get started</p>
            <button onClick={() => setLocation("/swatch-orders/new")}
              className="mt-4 px-4 py-2 rounded-xl bg-gray-900 text-sm font-medium hover:bg-black transition-colors"
              style={{ color: G }}>
              + New Swatch Order
            </button>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map(order => (
              <OrderCard key={order.id} order={order}
                onView={() => setLocation(`/swatch-orders/${order.id}`)}
                onDelete={() => setDeleteId(order.id)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#C6AF4B]/15 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Order Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Swatch Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Chargeable</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-[#C6AF4B]/04 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">{order.orderCode}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{order.swatchName}</td>
                    <td className="px-4 py-3 text-gray-600">{order.clientName ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.orderStatus} /></td>
                    <td className="px-4 py-3"><PriorityDot priority={order.priority} /></td>
                    <td className="px-4 py-3 text-gray-600">{order.quantity ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{order.deliveryDate ?? "—"}</td>
                    <td className="px-4 py-3">{order.isChargeable ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(198,175,75,0.12)", color: "#A8943E" }}>Yes</span> : <span className="text-xs text-gray-400">No</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setLocation(`/swatch-orders/${order.id}`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(order.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={deleteId !== null}
        title="Delete Swatch Order"
        message="This swatch order will be permanently deleted. Are you sure?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { void handleDelete(); }}
      />
    </AppLayout>
  );
}
