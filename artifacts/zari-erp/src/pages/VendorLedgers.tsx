import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Wallet, Building2, TrendingDown, TrendingUp, ArrowRight,
  Search, Users, IndianRupee, Clock, CheckCircle2, ChevronRight,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const G     = "#C6AF4B";
const G_DIM = "#A8943E";

const card = [
  "rounded-2xl overflow-hidden bg-white",
  "border border-[#C6AF4B]/15",
  "shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]",
  "hover:shadow-[0_6px_28px_rgba(198,175,75,0.22),0_2px_6px_rgba(0,0,0,0.08)]",
  "hover:-translate-y-0.5 transition-all duration-300",
].join(" ");

interface VendorSummary {
  vendor_id: number;
  vendor_code: string;
  brand_name: string;
  contact_name: string;
  email: string;
  contact_no: string;
  is_active: boolean;
  total_debits: string;
  total_credits: string;
  total_entries: string;
}

function fmt(n: string | number) {
  const val = typeof n === "string" ? parseFloat(n) : n;
  return "₹" + val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
}

export default function VendorLedgers() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("zarierp_token");

  const { data: user, isLoading: userLoading, isError } = useGetMe({
    query: { enabled: !!token, queryKey: getGetMeQueryKey(), retry: false },
  });
  const logoutMutation = useLogout();

  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!token || isError) { localStorage.removeItem("zarierp_token"); setLocation("/login"); }
  }, [token, isError, setLocation]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    customFetch("/api/vendor-ledger/summary")
      .then((d: VendorSummary[]) => setVendors(d))
      .catch(() => toast({ title: "Failed to load vendor ledger", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { localStorage.removeItem("zarierp_token"); queryClient.clear(); setLocation("/login"); },
      onError:   () => { localStorage.removeItem("zarierp_token"); queryClient.clear(); setLocation("/login"); },
    });
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <div className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const filtered = vendors.filter(v =>
    v.brand_name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendor_code.toLowerCase().includes(search.toLowerCase()) ||
    (v.contact_name || "").toLowerCase().includes(search.toLowerCase()),
  );

  const totalDebit  = vendors.reduce((s, v) => s + parseFloat(v.total_debits || "0"), 0);
  const totalCredit = vendors.reduce((s, v) => s + parseFloat(v.total_credits || "0"), 0);
  const totalBalance = totalDebit - totalCredit;
  const vendorsWithBalance = vendors.filter(v => parseFloat(v.total_debits || "0") - parseFloat(v.total_credits || "0") > 0).length;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.45s ease both; }
      `}</style>

      <div className="space-y-6 pb-10">

        {/* Header */}
        <div className="fade-up flex items-end justify-between" style={{ animationDelay: "0ms" }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-px w-8 rounded-full" style={{ background: `linear-gradient(90deg, ${G}, transparent)` }} />
              <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: G }}>ACCOUNTS · VENDOR LEDGERS</p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vendor Ledgers</h1>
            <p className="text-xs text-gray-400 mt-0.5">{vendors.length} vendors · outstanding and payment history</p>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up" style={{ animationDelay: "60ms" }}>
          {[
            { label: "TOTAL VENDORS",    value: vendors.length.toString(), icon: Users,       color: SLATE_COLOR, sub: "in system"          },
            { label: "TOTAL OUTSTANDING", value: fmt(totalBalance),         icon: TrendingDown, color: "#EF4444",  sub: "balance due"        },
            { label: "TOTAL DEBITS",     value: fmt(totalDebit),           icon: TrendingDown, color: G,          sub: "outsource + charges" },
            { label: "TOTAL PAID",       value: fmt(totalCredit),          icon: TrendingUp,   color: "#10B981",  sub: "payments made"       },
          ].map((k) => (
            <div key={k.label} className={`${card}`}>
              <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: G }}>{k.label}</p>
                  <div className="h-7 w-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${k.color}15`, border: `1px solid ${k.color}30` }}>
                    <k.icon className="h-3.5 w-3.5" style={{ color: k.color }} />
                  </div>
                </div>
                <p className="text-xl font-black leading-none tracking-tight text-gray-900 mb-1">{k.value}</p>
                <p className="text-[10px] text-gray-400">{k.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div className="fade-up" style={{ animationDelay: "120ms" }}>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search vendor by name or code…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 focus:border-[#C6AF4B]/50 transition-all"
            />
          </div>
        </div>

        {/* Vendor Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((v, idx) => {
              const debit   = parseFloat(v.total_debits  || "0");
              const credit  = parseFloat(v.total_credits || "0");
              const balance = debit - credit;
              const pct     = debit > 0 ? Math.min(100, (credit / debit) * 100) : 100;
              const settled = balance <= 0;

              return (
                <button
                  key={v.vendor_id}
                  onClick={() => setLocation(`/accounts/ledgers/${v.vendor_id}`)}
                  className={`${card} fade-up text-left w-full`}
                  style={{ animationDelay: `${idx * 40}ms` }}>
                  <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${settled ? "#10B981" : G}, transparent)` }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-black text-white"
                          style={{ background: settled ? "#10B981" : G_DIM }}>
                          {initials(v.brand_name)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-tight">{v.brand_name}</p>
                          <p className="text-[10px] font-mono text-gray-400">{v.vendor_code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {settled
                          ? <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Settled</span>
                          : <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Outstanding</span>}
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center p-2 rounded-lg" style={{ background: `${G}08` }}>
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Debits</p>
                        <p className="text-xs font-black" style={{ color: G_DIM }}>{fmt(debit)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-emerald-50">
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Paid</p>
                        <p className="text-xs font-black text-emerald-700">{fmt(credit)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg" style={{ background: settled ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.07)" }}>
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Balance</p>
                        <p className="text-xs font-black" style={{ color: settled ? "#10B981" : "#EF4444" }}>{fmt(Math.abs(balance))}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-medium text-gray-400">Payment progress</span>
                        <span className="text-[9px] font-bold" style={{ color: G_DIM }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: settled ? "#10B981" : `linear-gradient(90deg, ${G_DIM}, ${G})` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <span className="text-[10px] text-gray-400">{v.contact_name}</span>
                      <span className="text-[9px] font-mono text-gray-300">{v.total_entries} entries</span>
                    </div>
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && !loading && (
              <div className="col-span-full text-center py-16 text-gray-400">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No vendors found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

const SLATE_COLOR = "#3B3F5C";
