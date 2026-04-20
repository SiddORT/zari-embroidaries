import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Edit2, ChevronRight, RefreshCw, MessageSquare,
  Copy, Layers, ListOrdered, Plus, X, CheckCircle2,
  AlertCircle, Clock, FileText, Printer, FileDown,
} from "lucide-react";
import { downloadQuotationPdf } from "@/utils/generateQuotationPdf";
import { logActivity } from "@/utils/logActivity";
import ZariButton from "@/components/ui/ZariButton";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";

const G = "#C6AF4B";
const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 text-gray-900 bg-white";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

const STATUS_COLORS: Record<string, string> = {
  "Draft":                 "bg-gray-100 text-gray-600",
  "Sent":                  "bg-blue-100 text-blue-700",
  "Client Reviewing":      "bg-indigo-100 text-indigo-700",
  "Correction Requested":  "bg-yellow-100 text-yellow-700",
  "Revised":               "bg-amber-100 text-amber-700",
  "Approved":              "bg-emerald-100 text-emerald-700",
  "Rejected":              "bg-red-100 text-red-600",
  "Converted to Style":    "bg-purple-100 text-purple-700",
  "Converted to Swatch":   "bg-teal-100 text-teal-700",
};

const STATUS_BTN_STYLES: Record<string, string> = {
  "Draft":                 "border-gray-300   text-gray-700   hover:bg-gray-100",
  "Sent":                  "border-blue-300   text-blue-700   hover:bg-blue-50",
  "Client Reviewing":      "border-indigo-300 text-indigo-700 hover:bg-indigo-50",
  "Correction Requested":  "border-yellow-400 text-yellow-700 hover:bg-yellow-50",
  "Revised":               "border-amber-400  text-amber-700  hover:bg-amber-50",
  "Approved":              "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
  "Rejected":              "border-red-300    text-red-600    hover:bg-red-50",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  "Draft":               ["Sent"],
  "Sent":                ["Client Reviewing", "Approved", "Rejected"],
  "Client Reviewing":    ["Correction Requested", "Approved", "Rejected"],
  "Correction Requested":["Revised"],
  "Revised":             ["Sent"],
  "Approved":            [],
  "Rejected":            [],
  "Converted to Style":  [],
  "Converted to Swatch": [],
};

interface Design { id: number; design_name: string; hsn_code: string | null; design_image: string | null; remarks: string | null; }
interface Charge { id: number; charge_name: string; hsn_code: string | null; unit: string | null; quantity: string; price: string; amount: string; }
interface Feedback { id: number; feedback_text: string; feedback_by: string | null; feedback_date: string; revision_reference: string | null; created_at: string; }
interface Revision { id: number; quotation_number: string; revision_number: number; status: string; created_at: string; created_by: string | null; }

interface Quotation {
  id: number;
  quotation_number: string;
  client_id: number | null;
  client_name: string | null;
  client_state: string | null;
  requirement_summary: string | null;
  estimated_weight: string;
  estimated_shipping_charges: string;
  subtotal_amount: string;
  gst_type: string;
  gst_rate: string;
  gst_amount: string;
  total_amount: string;
  status: string;
  revision_number: number;
  parent_quotation_id: number | null;
  internal_notes: string | null;
  client_notes: string | null;
  cover_page: string;
  cover_page_image: string | null;
  converted_to: string | null;
  converted_reference_id: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  designs: Design[];
  charges: Charge[];
  feedback: Feedback[];
  revisions: Revision[];
}

export default function QuotationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();

  const isAdmin = user?.role === "admin";

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);

  // Status change
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  function extractApiError(err: any): string {
    const msg: string = err?.message ?? String(err);
    const match = msg.match(/^HTTP \d{3}[^:]*:\s*(.+)$/s);
    return match ? match[1].trim() : msg;
  }

  // Feedback
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRef, setFeedbackRef] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Revision
  const [revisingBusy, setRevisingBusy] = useState(false);

  // Convert
  const [convertBusy, setConvertBusy] = useState<"swatch" | "style" | null>(null);
  const [confirmConvert, setConfirmConvert] = useState<"swatch" | "style" | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const j = await customFetch<{ data: Quotation }>(`/api/quotations/${id}`);
      setQuotation(j.data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [id]);

  async function changeStatus(newStatus: string) {
    setStatusBusy(true);
    setStatusError(null);
    try {
      const j = await customFetch<{ message: string }>(`/api/quotations/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ newStatus }),
      });
      toast({ title: "Status Updated", description: j.message });
      fetchData();
    } catch (err: any) {
      const clean = extractApiError(err);
      if (clean.toLowerCase().includes("already approved") || clean.toLowerCase().includes("revision in this quotation chain")) {
        setStatusError(clean);
      } else {
        toast({ title: "Cannot change status", description: clean, variant: "destructive" });
      }
    } finally {
      setStatusBusy(false);
    }
  }

  async function submitFeedback() {
    if (!feedbackText.trim()) return;
    setSubmittingFeedback(true);
    try {
      const j = await customFetch<{ message: string }>(`/api/quotations/${id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ feedbackText, revisionReference: feedbackRef }),
      });
      toast({ title: "Feedback Added", description: j.message });
      setFeedbackText(""); setFeedbackRef(""); setFeedbackOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingFeedback(false);
    }
  }

  async function createRevision() {
    setRevisingBusy(true);
    try {
      const j = await customFetch<{ data: { id: number; quotationNumber: string; revisionNumber: number } }>(`/api/quotations/${id}/revise`, { method: "POST" });
      toast({ title: "Revision Created", description: `${j.data?.quotationNumber} (R${j.data?.revisionNumber})` });
      navigate(`/quotation/${j.data?.id}/edit`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRevisingBusy(false);
    }
  }

  async function doConvert(type: "swatch" | "style") {
    setConvertBusy(type);
    try {
      const j = await customFetch<{ message: string }>(`/api/quotations/${id}/convert-${type}`, { method: "POST" });
      toast({ title: "Converted", description: j.message });
      setConfirmConvert(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setConvertBusy(null);
    }
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("zarierp_token");
        qc.removeQueries({ queryKey: getGetMeQueryKey() });
        navigate("/login");
      },
    });
  }

  const fmt = (v: string | number | null) => {
    const n = parseFloat(String(v ?? 0));
    return isNaN(n) ? "₹0.00" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (loading || !user) {
    return (
      <AppLayout username={user?.username ?? ""} role={user?.role ?? ""} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C6AF4B]" />
        </div>
      </AppLayout>
    );
  }
  if (!quotation) return null;

  const q = quotation;
  const nextStatuses = STATUS_TRANSITIONS[q.status] ?? [];
  const canEdit = q.status === "Draft" || q.status === "Revised";
  const canRevise = q.status === "Correction Requested";
  const canConvertSwatch = q.status === "Approved" && q.converted_to !== "Swatch";
  const canConvertStyle = q.status === "Approved" && q.converted_to !== "Style";
  const swatchDisabled = q.status === "Approved" && q.converted_to === "Swatch";
  const styleDisabled = q.status === "Approved" && q.converted_to === "Style";

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <button onClick={() => navigate("/quotation")} className="p-2 rounded-xl hover:bg-gray-100 mt-0.5 transition">
              <ArrowLeft size={18} className="text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 font-mono">{q.quotation_number}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[q.status] ?? "bg-gray-100 text-gray-600"}`}>{q.status}</span>
                <span className="text-xs text-gray-400">R{q.revision_number}</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {q.client_name || "—"} · Created {fmtDate(q.created_at)} {q.created_by ? `by ${q.created_by}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <button
                onClick={() => navigate(`/quotation/${id}/edit`)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-700 transition"
              >
                <Edit2 size={14} /> Edit
              </button>
            )}
            <button
              onClick={() => setFeedbackOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-700 transition"
            >
              <MessageSquare size={14} /> Add Feedback
            </button>
            <button
              onClick={() => { downloadQuotationPdf(q); logActivity(`Downloaded PDF for Quotation ${q.quotation_number ?? ""} — ${q.client_name ?? ""}`); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition"
              style={{ background: "#C6AF4B" }}
              title="Download PDF"
            >
              <FileDown size={14} /> Download PDF
            </button>
          </div>
        </div>

        {/* Conversion + Status Actions */}
        <div className={`${card} p-4 mb-5`}>
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Transitions */}
            {nextStatuses.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Move to:</span>
                {nextStatuses.map((ns) => (
                  <button
                    key={ns}
                    disabled={statusBusy}
                    onClick={() => changeStatus(ns)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50 transition ${STATUS_BTN_STYLES[ns] ?? "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    {ns} {statusBusy && <span className="ml-1 animate-pulse">…</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Approval conflict inline alert */}
            {statusError && (
              <div className="w-full mt-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
                <div className="flex-1">
                  <p className="font-semibold">Approval Conflict</p>
                  <p className="mt-0.5 text-amber-800">{statusError}</p>
                </div>
                <button onClick={() => setStatusError(null)} className="text-amber-400 hover:text-amber-700 flex-shrink-0 mt-0.5">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Divider */}
            {nextStatuses.length > 0 && q.status === "Approved" && <div className="h-6 w-px bg-gray-200 hidden sm:block" />}

            {/* Revision */}
            {canRevise && (
              <button
                disabled={revisingBusy}
                onClick={createRevision}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-60 transition"
              >
                <Copy size={14} /> {revisingBusy ? "Creating…" : "Create Revision"}
              </button>
            )}

            {/* Conversion buttons */}
            {q.status === "Approved" && (
              <>
                <button
                  disabled={swatchDisabled || convertBusy !== null}
                  onClick={() => canConvertSwatch && setConfirmConvert("swatch")}
                  title={swatchDisabled ? "Already converted to Swatch" : ""}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    swatchDisabled
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "border border-teal-200 text-teal-700 hover:bg-teal-50"
                  }`}
                >
                  <Layers size={14} /> Convert to Swatch
                  {swatchDisabled && <CheckCircle2 size={13} className="ml-1 text-teal-500" />}
                </button>
                <button
                  disabled={styleDisabled || convertBusy !== null}
                  onClick={() => canConvertStyle && setConfirmConvert("style")}
                  title={styleDisabled ? "Already converted to Style" : ""}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    styleDisabled
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "border border-purple-200 text-purple-700 hover:bg-purple-50"
                  }`}
                >
                  <ListOrdered size={14} /> Convert to Style
                  {styleDisabled && <CheckCircle2 size={13} className="ml-1 text-purple-500" />}
                </button>
              </>
            )}

            {q.converted_to && q.converted_reference_id && (
              <span className="text-xs text-gray-500 ml-auto">
                Converted to {q.converted_to} #{q.converted_reference_id} on {fmtDate(q.converted_at!)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left — main info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Summary */}
            <div className={`${card} p-5`}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: G }}>Details</h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Client</p>
                  <p className="font-medium text-gray-800">{q.client_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">State</p>
                  <p className="font-medium text-gray-800">{q.client_state || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Requirement Summary</p>
                  <p className="text-gray-700">{q.requirement_summary || "—"}</p>
                </div>
                {q.internal_notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-0.5">Internal Notes</p>
                    <p className="text-gray-700">{q.internal_notes}</p>
                  </div>
                )}
                {q.client_notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-0.5">Client Notes</p>
                    <p className="text-gray-700">{q.client_notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Designs */}
            {q.designs.length > 0 && (
              <div className={`${card} p-5`}>
                <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: G }}>Designs ({q.designs.length})</h3>
                <div className="space-y-3">
                  {q.designs.map((d, i) => (
                    <div key={d.id} className="flex items-start gap-3 border border-gray-100 rounded-xl p-3">
                      {d.design_image ? (
                        <img src={d.design_image} alt={d.design_name} className="h-16 w-16 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                      ) : (
                        <div className="h-16 w-16 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
                          <FileText size={20} className="text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">{d.design_name}</p>
                        {d.hsn_code && <p className="text-xs text-gray-400">HSN: {d.hsn_code}</p>}
                        {d.remarks && <p className="text-xs text-gray-500 mt-1">{d.remarks}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charges */}
            {q.charges.length > 0 && (
              <div className={`${card} p-5`}>
                <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: G }}>Charges</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-400 pb-2">Charge</th>
                        <th className="text-left text-xs font-semibold text-gray-400 pb-2">HSN</th>
                        <th className="text-right text-xs font-semibold text-gray-400 pb-2">Qty</th>
                        <th className="text-right text-xs font-semibold text-gray-400 pb-2">Price</th>
                        <th className="text-right text-xs font-semibold text-gray-400 pb-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.charges.map((c) => (
                        <tr key={c.id} className="border-b border-gray-50">
                          <td className="py-2 font-medium text-gray-900">{c.charge_name}<br/><span className="text-xs text-gray-600">{c.unit}</span></td>
                          <td className="py-2 text-gray-900">{c.hsn_code || "—"}</td>
                          <td className="py-2 text-right text-gray-900">{parseFloat(c.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-2 text-right text-gray-900">{fmt(c.price)}</td>
                          <td className="py-2 text-right font-semibold text-gray-900">{fmt(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 border-t border-gray-100 pt-3 flex flex-col items-end gap-1 text-sm">
                  <div className="flex justify-between w-52"><span className="text-gray-500">Subtotal</span><span className="font-semibold text-gray-900">{fmt(q.subtotal_amount)}</span></div>
                  <div className="flex justify-between w-52"><span className="text-gray-500">GST ({q.gst_type} @ {q.gst_rate}%)</span><span className="font-semibold text-gray-900">{fmt(q.gst_amount)}</span></div>
                  <div className="flex justify-between w-52"><span className="text-gray-500">Shipping</span><span className="font-semibold text-gray-900">{fmt(q.estimated_shipping_charges)}</span></div>
                  <div className="flex justify-between w-52 border-t border-gray-200 pt-1 mt-1">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-[#C6AF4B] text-base">{fmt(q.total_amount)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback Timeline */}
            {q.feedback.length > 0 && (
              <div className={`${card} p-5`}>
                <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: G }}>Feedback Timeline</h3>
                <div className="space-y-3">
                  {q.feedback.map((f) => (
                    <div key={f.id} className="border-l-2 border-[#C6AF4B]/30 pl-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-500">{f.feedback_by || "System"}</span>
                        <span className="text-xs text-gray-400">{f.feedback_date}</span>
                      </div>
                      <p className="text-sm text-gray-700">{f.feedback_text}</p>
                      {f.revision_reference && <p className="text-xs text-gray-400 mt-0.5">Ref: {f.revision_reference}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Amounts Summary */}
            <div className={`${card} p-5`}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: G }}>Amount Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium text-gray-900">{fmt(q.subtotal_amount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">GST ({q.gst_type})</span><span className="font-medium text-gray-900">{fmt(q.gst_amount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span className="font-medium text-gray-900">{fmt(q.estimated_shipping_charges)}</span></div>
                <div className="flex justify-between pt-2 border-t border-gray-100">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-[#C6AF4B] text-base">{fmt(q.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Revision History */}
            {q.revisions.length > 1 && (
              <div className={`${card} p-5`}>
                <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: G }}>Revision History</h3>
                <div className="space-y-2">
                  {q.revisions.map((rev) => (
                    <div key={rev.id} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${rev.id === q.id ? "bg-[#C6AF4B]/10" : ""}`}>
                      <div>
                        <button
                          onClick={() => navigate(`/quotation/${rev.id}`)}
                          className={`text-sm font-mono ${rev.id === q.id ? "font-bold text-[#C6AF4B]" : "text-blue-600 hover:underline"}`}
                        >
                          {rev.quotation_number}
                        </button>
                        <span className="ml-2 text-xs text-gray-400">R{rev.revision_number}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[rev.status] ?? "bg-gray-100 text-gray-600"}`}>{rev.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className={`${card} p-5`}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: G }}>Info</h3>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-400 text-xs block">Created By</span><span className="text-gray-700">{q.created_by || "—"}</span></div>
                <div><span className="text-gray-400 text-xs block">Created At</span><span className="text-gray-700">{fmtDateTime(q.created_at)}</span></div>
                <div><span className="text-gray-400 text-xs block">Last Updated</span><span className="text-gray-700">{fmtDateTime(q.updated_at)}</span></div>
                {q.estimated_weight && parseFloat(q.estimated_weight) > 0 && (
                  <div><span className="text-gray-400 text-xs block">Est. Weight</span><span className="text-gray-700">{q.estimated_weight} kg</span></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {feedbackOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className={`${card} max-w-lg w-full p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Feedback</h3>
              <button onClick={() => setFeedbackOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Feedback / Comment *</label>
                <textarea
                  rows={4}
                  className={inputCls}
                  placeholder="Enter client feedback, correction notes, or remarks…"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Revision Reference (optional)</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Call on 19-Apr-2026"
                  value={feedbackRef}
                  onChange={(e) => setFeedbackRef(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setFeedbackOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button
                onClick={submitFeedback}
                disabled={submittingFeedback || !feedbackText.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: G }}
              >
                {submittingFeedback ? "Saving…" : "Save Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Confirm Modal */}
      {confirmConvert && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className={`${card} max-w-sm w-full p-6`}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Convert to {confirmConvert === "swatch" ? "Swatch" : "Style"}?</h3>
            <p className="text-sm text-gray-600 mb-5">
              This will create a new {confirmConvert === "swatch" ? "Swatch Order" : "Style Order"} from this quotation and mark it as converted.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <ZariButton variant="secondary" onClick={() => setConfirmConvert(null)}>Cancel</ZariButton>
              <ZariButton
                variant="primary"
                onClick={() => doConvert(confirmConvert)}
                disabled={convertBusy !== null}
                loading={convertBusy !== null}
              >
                {convertBusy ? "Converting…" : `Convert to ${confirmConvert === "swatch" ? "Swatch" : "Style"}`}
              </ZariButton>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
