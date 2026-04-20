import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Package, BarChart2, ShoppingCart, FileText,
  Users, User, TrendingUp, Scale,
  Download, RefreshCw, ChevronRight, CheckCircle2,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";

const G     = "#C6AF4B";
const G_DIM = "#A8943E";
const SLATE = "#3B3F5C";

const card = [
  "rounded-2xl bg-white",
  "border border-[#C6AF4B]/15",
  "shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]",
].join(" ");

const inp = "border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/40 min-w-[160px]";

const fmtCurr = (n: number | string) => "₹" + parseFloat(String(n ?? 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtNum  = (n: number | string) => parseFloat(String(n ?? 0)).toLocaleString("en-IN", { maximumFractionDigits: 3 });

type ReportId =
  | "stock-summary"
  | "stock-movement"
  | "purchase-summary"
  | "invoice-summary"
  | "vendor-ledger"
  | "client-ledger"
  | "order-profitability"
  | "purchase-vs-sales";

interface ReportCard {
  id: ReportId;
  name: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

const REPORT_CARDS: ReportCard[] = [
  { id: "stock-summary",       name: "Stock Summary",       desc: "Current stock levels, reservations & status per item",       icon: Package,     color: G,         bg: `${G}18`               },
  { id: "stock-movement",      name: "Stock Movement",      desc: "All ledger transactions — receipts, consumptions & wastage",  icon: BarChart2,   color: SLATE,     bg: "rgba(59,63,92,0.1)"  },
  { id: "purchase-summary",    name: "Purchase Summary",    desc: "PO amounts, receipt values & vendor billing per vendor",      icon: ShoppingCart,color: "#7C3AED", bg: "rgba(124,58,237,0.1)"},
  { id: "invoice-summary",     name: "Invoice Summary",     desc: "Client invoices with amount, received & pending status",      icon: FileText,    color: "#0891B2", bg: "rgba(8,145,178,0.1)" },
  { id: "vendor-ledger",       name: "Vendor Ledger",       desc: "Vendor invoice entries, payments & outstanding balances",     icon: Users,       color: "#D97706", bg: "rgba(217,119,6,0.1)" },
  { id: "client-ledger",       name: "Client Ledger",       desc: "Client payment entries against issued invoices",              icon: User,        color: "#059669", bg: "rgba(5,150,105,0.1)" },
  { id: "order-profitability", name: "Order Profitability", desc: "Invoice vs shipping cost per swatch & style order",           icon: TrendingUp,  color: "#DC2626", bg: "rgba(220,38,38,0.1)" },
  { id: "purchase-vs-sales",   name: "Purchase vs Sales",   desc: "Aggregate comparison — sales, purchases & other expenses",    icon: Scale,       color: G_DIM,     bg: `${G_DIM}18`          },
];

const REPORT_COLS: Record<ReportId, string[]> = {
  "stock-summary":       ["Item", "Category", "Unit", "Current Stock", "Reserved", "Available", "Reorder Level", "Status"],
  "stock-movement":      ["Date", "Item", "Unit", "Transaction Type", "Reference", "Qty In", "Qty Out", "Balance"],
  "purchase-summary":    ["Vendor", "PO Amount", "PR Value", "Vendor Bills", "Pending Payables"],
  "invoice-summary":     ["Invoice No", "Client", "Invoice Date", "Invoice Amount", "Received Amount", "Pending Amount", "Status"],
  "vendor-ledger":       ["Vendor", "Entry Type", "Reference", "Amount", "Paid", "Balance", "Date", "Status"],
  "client-ledger":       ["Client", "Entry Type", "Reference", "Amount", "Date", "Status"],
  "order-profitability": ["Order ID", "Client", "Type", "Invoice Amount", "Shipping Cost", "Net Profit"],
  "purchase-vs-sales":   ["Period", "Total Sales", "Total Purchases", "Other Expenses", "Net Revenue"],
};

function rowVal(id: ReportId, row: Record<string, unknown>, col: string): string {
  const currCols = new Set(["PO Amount","PR Value","Vendor Bills","Pending Payables","Invoice Amount","Received Amount","Pending Amount","Amount","Paid","Balance","Net Profit","Total Sales","Total Purchases","Other Expenses","Net Revenue"]);
  const key = col.toLowerCase().replace(/ /g, "_").replace(/\./g, "");
  const aliases: Record<string, string> = {
    "item":            "item_name",
    "category":        "category",
    "unit":            "unit_type",
    "current_stock":   "current_stock",
    "reorder_level":   "reorder_level",
    "status":          "stock_status",
    "date":            "date",
    "transaction_type":"transaction_type",
    "reference":       "reference",
    "qty_in":          "qty_in",
    "qty_out":         "qty_out",
    "invoice_no":      "invoice_no",
    "client":          "client",
    "invoice_date":    "invoice_date",
    "invoice_amount":  "invoice_amount",
    "received_amount": "received_amount",
    "pending_amount":  "pending_amount",
    "vendor":          "vendor",
    "entry_type":      "entry_type",
    "po_amount":       "po_amount",
    "pr_value":        "pr_value",
    "vendor_bills":    "vendor_bills",
    "pending_payables":"pending_payables",
    "paid":            "paid",
    "balance":         "balance",
    "order_id":        "order_id",
    "type":            "order_type",
    "shipping_cost":   "shipping_cost",
    "net_profit":      "net_profit",
    "period":          "period",
    "total_sales":     "total_sales",
    "total_purchases": "total_purchases",
    "other_expenses":  "other_expenses",
    "net_revenue":     "net_revenue",
    "client_name":     "client_name",
  };
  const fieldKey = aliases[key] ?? key;
  const val = row[fieldKey] ?? row[key] ?? "—";
  if (val === "—" || val === null || val === undefined) return "—";
  if (currCols.has(col)) return fmtCurr(val as string);
  if (col === "Current Stock" || col === "Reserved" || col === "Available" || col === "Reorder Level" || col === "Qty In" || col === "Qty Out" || col === "Balance") return fmtNum(val as string);
  return String(val);
}

function statusBadge(val: string) {
  const v = String(val ?? "").toLowerCase();
  const map: Record<string, string> = {
    "in stock":      "bg-emerald-50 text-emerald-700 border-emerald-200",
    "low stock":     "bg-amber-50 text-amber-700 border-amber-200",
    "out of stock":  "bg-red-50 text-red-700 border-red-200",
    "paid":          "bg-emerald-50 text-emerald-700 border-emerald-200",
    "pending":       "bg-amber-50 text-amber-700 border-amber-200",
    "draft":         "bg-gray-50 text-gray-600 border-gray-200",
    "cancelled":     "bg-red-50 text-red-700 border-red-200",
    "completed":     "bg-emerald-50 text-emerald-700 border-emerald-200",
    "processing":    "bg-blue-50 text-blue-700 border-blue-200",
    "final invoice": "bg-blue-50 text-blue-700 border-blue-200",
  };
  return map[v] ?? "bg-gray-50 text-gray-600 border-gray-200";
}

const STATUS_COLS = new Set(["Status", "stock_status"]);

interface FilterOptions {
  clients: { id: number; brand_name: string }[];
  vendors: { id: number; brand_name: string }[];
  items:   { id: number; item_name: string }[];
}

export default function Reports() {
  const [, navigate]     = useLocation();
  const { toast }        = useToast();
  const qc               = useQueryClient();
  const token            = localStorage.getItem("zarierp_token");

  const { data: user, isError } = useGetMe({
    query: { enabled: !!token, queryKey: getGetMeQueryKey(), retry: false },
  });
  const logoutMutation = useLogout();

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  const [selected,   setSelected]   = useState<ReportId | null>(null);
  const [rows,       setRows]       = useState<Record<string, unknown>[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const [opts,       setOpts]       = useState<FilterOptions>({ clients: [], vendors: [], items: [] });

  const today          = new Date().toISOString().slice(0, 10);
  const fyStart        = `${new Date().getFullYear()}-01-01`;
  const [dateFrom,     setDateFrom]    = useState(fyStart);
  const [dateTo,       setDateTo]      = useState(today);
  const [filterClient, setFilterClient] = useState("all");
  const [filterVendor, setFilterVendor] = useState("all");
  const [filterItem,   setFilterItem]   = useState("all");

  useEffect(() => {
    if (!token) return;
    customFetch<FilterOptions>("/api/reports/filter-options")
      .then(d => setOpts(d))
      .catch(() => {});
  }, [token]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => { localStorage.removeItem("zarierp_token"); qc.clear(); navigate("/login"); },
    });
  };

  const fetchReport = useCallback((id: ReportId) => {
    if (!token || !id) return;
    setLoading(true);
    setLoaded(false);
    const p = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (filterClient !== "all") p.set("client", filterClient);
    if (filterVendor !== "all") p.set("vendor", filterVendor);
    if (filterItem   !== "all") p.set("item",   filterItem);
    customFetch<{ data: Record<string, unknown>[] }>(`/api/reports/${id}?${p}`)
      .then(d => {
        setRows(d.data ?? []);
        setLoaded(true);
        toast({ title: "Report loaded successfully", description: `${d.data?.length ?? 0} records`, duration: 2500 });
      })
      .catch(() => toast({ title: "Failed to load report", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token, dateFrom, dateTo, filterClient, filterVendor, filterItem, toast]);

  const selectReport = (id: ReportId) => {
    setSelected(id);
    setRows([]);
    setLoaded(false);
    setTimeout(() => fetchReport(id), 0);
  };

  const refresh = () => { if (selected) fetchReport(selected); };

  function exportCSV() {
    if (!selected || rows.length === 0) return;
    const cols = REPORT_COLS[selected];
    const header = cols.join(",");
    const body = rows.map(row =>
      cols.map(col => {
        const v = rowVal(selected, row, col).replace(/₹/g, "").replace(/,/g, "");
        return `"${v}"`;
      }).join(",")
    ).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${selected}_${today.replace(/-/g, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const showDate    = !!selected && selected !== "stock-summary";
  const showClient  = !!selected && ["invoice-summary", "client-ledger"].includes(selected);
  const showVendor  = !!selected && ["purchase-summary", "vendor-ledger"].includes(selected);
  const showItem    = !!selected && ["stock-summary", "stock-movement"].includes(selected);

  const selectedCard = REPORT_CARDS.find(r => r.id === selected);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <div className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const isAllowed = ["admin", "accounts", "inventory"].includes(user.role ?? "");

  return (
    <AppLayout
      username={(user as { name?: string })?.name ?? user.email ?? ""}
      role={user.role ?? ""}
      onLogout={handleLogout}
      isLoggingOut={logoutMutation.isPending}
    >
      <div className="py-6 px-6 max-w-screen-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px w-6 rounded-full" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>SETTINGS · REPORTS</p>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">Select a report, apply filters, and export data</p>
          </div>
          {selected && (
            <div className="flex items-center gap-2">
              <button onClick={refresh} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Loading…" : "Refresh"}
              </button>
              {rows.length > 0 && (
                <button onClick={exportCSV}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:bg-gray-50"
                  style={{ borderColor: `${G}40`, color: G }}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              )}
            </div>
          )}
        </div>

        {!isAllowed ? (
          <div className={`${card} p-10 flex items-center justify-center`}>
            <p className="text-gray-400 text-sm">You do not have permission to access reports.</p>
          </div>
        ) : (
          <>
            {/* Report Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {REPORT_CARDS.map(rc => {
                const Icon    = rc.icon;
                const isActive = selected === rc.id;
                return (
                  <button
                    key={rc.id}
                    onClick={() => selectReport(rc.id)}
                    className={`${card} p-4 text-left transition-all hover:shadow-lg group relative ${
                      isActive ? "ring-2 ring-offset-1" : ""
                    }`}
                    style={isActive ? { ringColor: G } as React.CSSProperties : {}}
                  >
                    {isActive && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className="h-4 w-4" style={{ color: G }} />
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                        style={{ background: rc.bg }}>
                        <Icon className="h-4.5 w-4.5" style={{ color: rc.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 leading-tight">{rc.name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{rc.desc}</p>
                      </div>
                    </div>
                    {isActive && (
                      <div className="mt-3 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide" style={{ color: G }}>
                        <span>Viewing</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Report Viewer Panel */}
            {selected && (
              <div className={`${card} overflow-hidden`}>
                {/* Report title bar */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {selectedCard && (
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: selectedCard.bg }}>
                        <selectedCard.icon className="h-4 w-4" style={{ color: selectedCard.color }} />
                      </div>
                    )}
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: G }}>REPORT VIEWER</p>
                      <h2 className="text-sm font-bold text-gray-900">{selectedCard?.name}</h2>
                    </div>
                  </div>
                  {loaded && <span className="text-xs text-gray-400 font-medium">{rows.length} records</span>}
                </div>

                {/* Filter Row */}
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex flex-wrap gap-4 items-end">
                  {showDate && (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inp} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inp} />
                      </div>
                    </>
                  )}
                  {showClient && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Client</label>
                      <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={inp}>
                        <option value="all">All Clients</option>
                        {opts.clients.map(c => <option key={c.id} value={c.brand_name}>{c.brand_name}</option>)}
                      </select>
                    </div>
                  )}
                  {showVendor && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Vendor</label>
                      <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)} className={inp}>
                        <option value="all">All Vendors</option>
                        {opts.vendors.map(v => <option key={v.id} value={v.brand_name}>{v.brand_name}</option>)}
                      </select>
                    </div>
                  )}
                  {showItem && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Item</label>
                      <select value={filterItem} onChange={e => setFilterItem(e.target.value)} className={inp}>
                        <option value="all">All Items</option>
                        {opts.items.map(i => <option key={i.id} value={i.item_name}>{i.item_name}</option>)}
                      </select>
                    </div>
                  )}
                  <button onClick={refresh} disabled={loading}
                    className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60 self-end"
                    style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
                    {loading ? "Loading…" : "Apply"}
                  </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                      <FileText className="h-10 w-10 opacity-30" />
                      <p className="text-sm">No data found for the selected filters</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {REPORT_COLS[selected].map(col => (
                            <th key={col}
                              className="text-left text-[10px] font-black uppercase tracking-[0.12em] px-4 py-3 whitespace-nowrap"
                              style={{ color: G }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, ri) => (
                          <tr key={ri} className={`border-b border-gray-50 transition-colors ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-[${G}]/4`}>
                            {REPORT_COLS[selected].map((col, ci) => {
                              const val = rowVal(selected, row, col);
                              const isStatus = col === "Status" || col === "stock_status";
                              const isNeg = val.startsWith("₹-") || (col === "Net Revenue" && parseFloat(String((row as Record<string, unknown>)["net_revenue"] ?? 0)) < 0);
                              return (
                                <td key={ci} className="px-4 py-3 whitespace-nowrap">
                                  {isStatus ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(val)}`}>
                                      {val}
                                    </span>
                                  ) : (
                                    <span className={`text-sm ${isNeg ? "text-red-600 font-semibold" : ci === 0 ? "font-medium text-gray-900" : "text-gray-700"}`}>
                                      {val}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Footer with export */}
                {rows.length > 0 && (
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
                    <p className="text-xs text-gray-400">{rows.length} records · {new Date().toLocaleString("en-IN")}</p>
                    <button onClick={exportCSV}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all hover:bg-white"
                      style={{ borderColor: `${G}40`, color: G }}>
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
