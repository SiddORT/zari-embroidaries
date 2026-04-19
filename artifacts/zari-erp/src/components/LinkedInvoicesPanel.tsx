import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { FileText, Plus, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const G = "#C6AF4B";

const STATUS_COLORS: Record<string, string> = {
  Draft:           "bg-gray-50 text-gray-600 border-gray-200",
  Generated:       "bg-blue-50 text-blue-700 border-blue-200",
  Sent:            "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Partially Paid":"bg-amber-50 text-amber-700 border-amber-200",
  Paid:            "bg-emerald-50 text-emerald-700 border-emerald-200",
  Overdue:         "bg-red-50 text-red-700 border-red-200",
  Cancelled:       "bg-gray-100 text-gray-400 border-gray-200",
};

function fmt(n: string | number | null | undefined) {
  const v = parseFloat(String(n ?? 0));
  return isNaN(v) ? "0.00" : v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

interface LinkedInvoice {
  id: number;
  invoiceNo: string;
  invoiceType: string;
  invoiceStatus: string;
  invoiceDirection: string;
  currencyCode: string;
  totalAmount: string | number;
  receivedAmount: string | number;
  pendingAmount: string | number;
  invoiceDate: string;
  dueDate?: string;
  clientName?: string;
  remarks?: string;
}

interface Props {
  type: "Swatch" | "Style";
  orderId: number;
  orderNo?: string;
}

export default function LinkedInvoicesPanel({ type, orderId, orderNo }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<LinkedInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("zarierp_token");
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = type === "Swatch"
        ? `${base}/api/invoices/swatch/${orderId}`
        : `${base}/api/invoices/style/${orderId}`;
      const r = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      setInvoices(j.data ?? []);
    } catch {
      toast({ title: "Failed to load invoices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [type, orderId, token]);

  useEffect(() => { load(); }, [load]);

  const totalValue   = invoices.reduce((s, i) => s + parseFloat(String(i.totalAmount ?? 0)), 0);
  const totalReceived = invoices.reduce((s, i) => s + parseFloat(String(i.receivedAmount ?? 0)), 0);
  const totalPending  = invoices.reduce((s, i) => s + parseFloat(String(i.pendingAmount ?? 0)), 0);
  const pendingCount  = invoices.filter(i => !["Paid", "Cancelled"].includes(i.invoiceStatus)).length;

  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Linked Invoices</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            All invoices raised against this {type} order
            {orderNo ? ` (${orderNo})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => navigate(`/accounts/invoices/new?refType=${type}&refId=${orderId}`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition"
            style={{ backgroundColor: G }}
          >
            <Plus size={14} /> New Invoice
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Invoices Raised",  val: invoices.length, isMoney: false, color: "text-gray-900" },
          { label: "Pending Invoices", val: pendingCount,     isMoney: false, color: "text-amber-600" },
          { label: "Total Billed",     val: totalValue,       isMoney: true,  color: "text-gray-900" },
          { label: "Amount Pending",   val: totalPending,     isMoney: true,  color: "text-red-600"  },
        ].map(c => (
          <div key={c.label} className={`${card} p-3`}>
            <p className="text-[11px] text-gray-400 mb-0.5">{c.label}</p>
            <p className={`text-base font-bold ${c.color}`}>
              {c.isMoney ? `₹${fmt(c.val)}` : c.val}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Invoice No", "Type", "Status", "Amount", "Received", "Pending", "Invoice Date", "Due Date", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <FileText size={36} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400 text-sm">No invoices raised yet for this order.</p>
                    <button
                      onClick={() => navigate(`/accounts/invoices/new?refType=${type}&refId=${orderId}`)}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                      style={{ backgroundColor: G }}
                    >
                      <Plus size={14} /> Create First Invoice
                    </button>
                  </td>
                </tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/accounts/invoices/${inv.id}`)}
                      className="font-mono font-bold text-sm hover:underline"
                      style={{ color: G }}
                    >
                      {inv.invoiceNo}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{inv.invoiceType}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[inv.invoiceStatus] ?? STATUS_COLORS.Draft}`}>
                      {inv.invoiceStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 text-xs">₹{fmt(inv.totalAmount)}</td>
                  <td className="px-4 py-3 text-emerald-600 font-medium text-xs">₹{fmt(inv.receivedAmount)}</td>
                  <td className="px-4 py-3 text-amber-600 font-medium text-xs">₹{fmt(inv.pendingAmount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(inv.dueDate)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/accounts/invoices/${inv.id}`)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                      title="View Invoice"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {invoices.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50/50">
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-gray-500">
                    {invoices.length} Invoice{invoices.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-bold text-gray-900">₹{fmt(totalValue)}</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-emerald-600">₹{fmt(totalReceived)}</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-amber-600">₹{fmt(totalPending)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
