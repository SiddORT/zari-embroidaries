import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, PackageCheck,
  AlertTriangle, Save, ChevronDown, Edit2, X, FileDown, TrendingUp,
} from "lucide-react";
import { downloadPrPdf } from "@/utils/pdfExport";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

const G     = "#C6AF4B";
const G_DIM = "#A8943E";
const card  = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";

const STATUS_MAP: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  Open:      { label: "OPEN",      color: "bg-gray-100 text-gray-700",   Icon: Clock },
  Received:  { label: "RECEIVED",  color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  Cancelled: { label: "CANCELLED", color: "bg-red-100 text-red-700",     Icon: XCircle },
};

interface ApprovedPO {
  id: number;
  po_number: string;
  vendor_name: string;
  reference_type: string;
  status: string;
  pending_items: number;
}

interface POItem {
  id: number;
  inventory_item_id: number;
  item_name: string;
  item_code: string;
  ordered_quantity: string;
  received_quantity: string;
  pending_quantity: string;
  unit_price: string;
  unit_type: string | null;
  warehouse_location: string | null;
}

interface PODetail {
  id: number;
  po_number: string;
  vendor_name: string;
  reference_type: string;
  items: POItem[];
}

interface ReceiptLine {
  poItemId: number;
  inventoryItemId: number;
  itemName: string;
  itemCode: string;
  unitType: string;
  pendingQty: string;
  orderedQty: string;
  receivedSoFar: string;
  quantity: string;
  unitPrice: string;
  targetPrice: string;
  warehouseLocation: string;
  remarks: string;
}

interface PRItem {
  id: number;
  po_item_id: number | null;
  inventory_item_id: number;
  item_name: string;
  item_code: string;
  quantity: string;
  unit_price: string;
  unit_type: string | null;
  warehouse_location: string | null;
  po_ordered_qty: string;
  po_received_qty: string;
}

interface PRDetail {
  id: number;
  pr_number: string;
  vendor_name: string;
  received_date: string;
  status: string;
  po_id: number | null;
  po_number: string | null;
  reference_type: string | null;
  items: PRItem[];
}

export default function PurchaseReceiptForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const prId = isNew ? null : parseInt(params.id ?? "0");

  const { data: me, isError } = useGetMe();
  const token = localStorage.getItem("zarierp_token");
  const queryClient = useQueryClient();
  const { mutateAsync: logoutMutate } = useLogout();
  const { toast } = useToast();

  const handleLogout = async () => {
    await logoutMutate(undefined).catch(() => {});
    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
    localStorage.removeItem("zarierp_token");
    navigate("/login");
  };

  const urlPoId = isNew ? new URLSearchParams(window.location.search).get("poId") : null;

  const [pr, setPr] = useState<PRDetail | null>(null);
  const [loadingPr, setLoadingPr] = useState(!isNew);

  // Create mode state
  const [approvedPos, setApprovedPos] = useState<ApprovedPO[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | "">(urlPoId ? parseInt(urlPoId) : "");
  const [poDetail, setPoDetail] = useState<PODetail | null>(null);
  const [loadingPo, setLoadingPo] = useState(false);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning] = useState(false);

  // Edit mode for existing Open PR
  const [editMode, setEditMode] = useState(false);
  const [editLines, setEditLines] = useState<ReceiptLine[]>([]);
  const [editDate, setEditDate] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState(false);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  useEffect(() => {
    if (!token || !isNew) return;
    customFetch(`/api/procurement/approved-pos?_t=${Date.now()}`)
      .then((r: unknown) => setApprovedPos(r as ApprovedPO[]))
      .catch(() => {});
  }, [token, isNew]);

  useEffect(() => {
    if (!selectedPoId || !token) return;
    setLoadingPo(true);
    customFetch(`/api/procurement/purchase-orders/${selectedPoId}?_t=${Date.now()}`)
      .then((r: unknown) => {
        const po = r as PODetail;
        setPoDetail(po);
        const ls: ReceiptLine[] = po.items
          .filter(i => parseFloat(i.pending_quantity) > 0)
          .map(i => ({
            poItemId: i.id,
            inventoryItemId: i.inventory_item_id,
            itemName: i.item_name,
            itemCode: i.item_code,
            unitType: i.unit_type ?? "",
            pendingQty: i.pending_quantity,
            orderedQty: i.ordered_quantity,
            receivedSoFar: i.received_quantity,
            quantity: "",
            targetPrice: i.unit_price,
            unitPrice: i.unit_price,
            warehouseLocation: i.warehouse_location ?? "",
            remarks: "",
          }));
        setLines(ls);
      })
      .catch(() => toast({ title: "Failed to load PO details", variant: "destructive" }))
      .finally(() => setLoadingPo(false));
  }, [selectedPoId, token, toast]);

  const loadPr = useCallback(() => {
    if (!prId || !token) return;
    setLoadingPr(true);
    customFetch(`/api/procurement/purchase-receipts/${prId}?_t=${Date.now()}`)
      .then((r: unknown) => setPr(r as PRDetail))
      .catch(() => toast({ title: "Failed to load receipt", variant: "destructive" }))
      .finally(() => setLoadingPr(false));
  }, [prId, token, toast]);

  useEffect(() => { if (!isNew) loadPr(); }, [isNew, loadPr]);

  const updateLine = (idx: number, field: keyof ReceiptLine, value: string) =>
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  const updateEditLine = (idx: number, field: keyof ReceiptLine, value: string) =>
    setEditLines(ls => ls.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  const handleSubmit = async (confirmNow: boolean) => {
    if (!selectedPoId) { toast({ title: "Select a purchase order", variant: "destructive" }); return; }
    const validLines = lines.filter(l => parseFloat(l.quantity) > 0);
    if (!validLines.length) { toast({ title: "Enter at least one received quantity", variant: "destructive" }); return; }
    for (const l of validLines) {
      if (parseFloat(l.quantity) > parseFloat(l.pendingQty) + 0.001) {
        toast({ title: `Quantity for "${l.itemName}" exceeds pending (${parseFloat(l.pendingQty).toFixed(3)})`, variant: "destructive" }); return;
      }
    }
    setSubmitting(true);
    try {
      const body = {
        poId: Number(selectedPoId),
        receivedDate,
        confirmNow,
        items: validLines.map(l => ({
          poItemId: l.poItemId,
          inventoryItemId: l.inventoryItemId,
          itemName: l.itemName,
          itemCode: l.itemCode,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice) || 0,
          warehouseLocation: l.warehouseLocation || null,
          remarks: l.remarks || null,
        })),
      };
      const r = await customFetch("/api/procurement/purchase-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }) as { data: { id: number } };
      toast({ title: confirmNow ? "Inventory updated successfully" : "Receipt saved as draft" });
      navigate(`/procurement/purchase-receipts/${r.data.id}`);
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to create receipt", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!pr) return;
    setActioning(true);
    try {
      await customFetch(`/api/procurement/purchase-receipts/${pr.id}/confirm`, { method: "POST" });
      toast({ title: "Inventory updated successfully" });
      loadPr();
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to confirm", variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const handleCancel = async () => {
    if (!pr) return;
    setActioning(true);
    try {
      await customFetch(`/api/procurement/purchase-receipts/${pr.id}/cancel`, { method: "POST" });
      toast({ title: "Purchase receipt cancelled" });
      setCancelConfirm(false);
      loadPr();
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to cancel", variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const enterEditMode = () => {
    if (!pr) return;
    setEditDate(pr.received_date ? new Date(pr.received_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    // Build edit lines from current PR items
    setEditLines(pr.items.map(item => ({
      poItemId: item.po_item_id ?? 0,
      inventoryItemId: item.inventory_item_id,
      itemName: item.item_name,
      itemCode: item.item_code,
      unitType: item.unit_type ?? "",
      pendingQty: item.po_ordered_qty,
      orderedQty: item.po_ordered_qty,
      receivedSoFar: item.po_received_qty,
      quantity: parseFloat(item.quantity).toFixed(3),
      unitPrice: parseFloat(item.unit_price).toFixed(2),
      warehouseLocation: item.warehouse_location ?? "",
      remarks: "",
    })));
    setEditMode(true);
  };

  const handleSaveEdit = async (confirmAfter = false) => {
    if (!pr) return;
    const validLines = editLines.filter(l => parseFloat(l.quantity) > 0);
    if (!validLines.length) { toast({ title: "Enter at least one received quantity", variant: "destructive" }); return; }
    setActioning(true);
    try {
      await customFetch(`/api/procurement/purchase-receipts/${pr.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivedDate: editDate,
          items: validLines.map(l => ({
            poItemId: l.poItemId,
            inventoryItemId: l.inventoryItemId,
            itemName: l.itemName,
            itemCode: l.itemCode,
            quantity: parseFloat(l.quantity),
            unitPrice: parseFloat(l.unitPrice) || 0,
            warehouseLocation: l.warehouseLocation || null,
            remarks: l.remarks || null,
          })),
        }),
      });
      if (confirmAfter) {
        await customFetch(`/api/procurement/purchase-receipts/${pr.id}/confirm`, { method: "POST" });
        toast({ title: "Inventory updated successfully" });
      } else {
        toast({ title: "Receipt updated successfully" });
      }
      setEditMode(false);
      loadPr();
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to update receipt", variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  // ── VIEW mode ─────────────────────────────────────────────────────────────

  if (!isNew) {
    if (loadingPr) {
      return (
        <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
          <TopNavbar username={(me as any)?.name ?? ""} role={(me as any)?.role ?? ""} onLogout={handleLogout} isLoggingOut={false} />
          <div className="flex items-center justify-center h-64">
            <div className="h-8 w-8 rounded-full border-2 border-[#C6AF4B] border-t-transparent animate-spin" />
          </div>
        </div>
      );
    }
    if (!pr) return null;

    const statusInfo = STATUS_MAP[pr.status] ?? STATUS_MAP.Open;
    const isOpen = pr.status === "Open";

    return (
      <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
        <TopNavbar username={(me as any)?.name ?? ""} role={(me as any)?.role ?? ""} onLogout={handleLogout} isLoggingOut={false} />
        <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/procurement/purchase-receipts")}
                className="p-2 rounded-xl hover:bg-[#C6AF4B]/10 transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-gray-900">{pr.pr_number}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusInfo.color}`}>
                    <statusInfo.Icon className="h-3 w-3" /> {statusInfo.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {pr.vendor_name} · PO: {pr.po_number ?? "—"} · {pr.reference_type ?? "—"}
                </p>
              </div>
            </div>

            {/* Download PDF — always visible */}
            {!editMode && (
              <button
                onClick={() => downloadPrPdf({
                  pr_number: pr.pr_number,
                  po_number: pr.po_number,
                  status: pr.status,
                  vendor_name: pr.vendor_name,
                  received_date: pr.received_date,
                  reference_type: pr.reference_type,
                  items: pr.items.map(item => ({
                    item_name: item.item_name,
                    item_code: item.item_code,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    unit_type: item.unit_type,
                    warehouse_location: item.warehouse_location,
                  })),
                })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
                <FileDown className="h-4 w-4" /> Download PDF
              </button>
            )}

            {/* Action buttons for Open receipts */}
            {isOpen && !editMode && (
              <div className="flex items-center gap-2">
                <button onClick={enterEditMode}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
                  <Edit2 className="h-4 w-4" /> Edit
                </button>
                <button onClick={() => setCancelConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
                  <XCircle className="h-4 w-4" /> Cancel Receipt
                </button>
                <button onClick={handleConfirm} disabled={actioning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#059669,#047857)" }}>
                  <CheckCircle2 className="h-4 w-4" />
                  {actioning ? "Confirming…" : "Confirm & Update Inventory"}
                </button>
              </div>
            )}

            {/* Edit mode buttons */}
            {isOpen && editMode && (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditMode(false)} disabled={actioning}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
                  <X className="h-4 w-4" /> Discard
                </button>
                <button onClick={() => handleSaveEdit(false)} disabled={actioning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-gray-900 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {actioning ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => handleSaveEdit(true)} disabled={actioning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#059669,#047857)" }}>
                  <CheckCircle2 className="h-4 w-4" />
                  {actioning ? "Confirming…" : "Save & Confirm"}
                </button>
              </div>
            )}
          </div>

          {/* Info card */}
          <div className={`${card} p-5`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                ["PR Number", pr.pr_number],
                ["PO Number", pr.po_number ?? "—"],
                ["Vendor", pr.vendor_name],
                ["Source", pr.reference_type ?? "—"],
                ["Received Date", editMode
                  ? undefined
                  : new Date(pr.received_date).toLocaleDateString("en-IN")],
                ["Status", pr.status],
              ].map(([label, value]) => (
                label === "Received Date" && editMode ? (
                  <div key={label}>
                    <p className="text-xs text-gray-400 font-medium">{label}</p>
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                      className="mt-0.5 w-full px-2 py-1 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                  </div>
                ) : (
                  <div key={label}>
                    <p className="text-xs text-gray-400 font-medium">{label}</p>
                    <p className="text-gray-900 mt-0.5 font-medium">{value}</p>
                  </div>
                )
              ))}
            </div>
            {editMode && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200">
                <Edit2 className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">You are editing this receipt. Changes apply only to draft quantities — inventory is not yet updated.</p>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className={card}>
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">
                {editMode ? "Edit Received Items" : "Received Items"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F8F6F0]">
                  <tr>
                    {editMode
                      ? ["#","Item","Code","Unit","Now Receiving","Unit Price (₹)","Location"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                        ))
                      : ["#","Item","Code","Unit","Received Qty","Unit Price","Location"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                        ))
                    }
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {editMode
                    ? editLines.map((line, i) => {
                        const nowNum = parseFloat(line.quantity) || 0;
                        const maxQty = parseFloat(line.orderedQty);
                        const isOver = nowNum > maxQty + 0.001;
                        return (
                          <tr key={line.poItemId} className="hover:bg-gray-50">
                            <td className="px-3 py-3 text-xs text-gray-400">{i+1}</td>
                            <td className="px-3 py-3">
                              <div className="text-sm font-medium text-gray-900">{line.itemName}</div>
                              <div className="text-xs text-gray-400">{line.itemCode}</div>
                            </td>
                            <td className="px-3 py-3 text-xs font-mono text-gray-500">{line.itemCode}</td>
                            <td className="px-3 py-3 text-xs text-gray-500">{line.unitType || "—"}</td>
                            <td className="px-3 py-3">
                              <input type="number" min="0.001" step="0.001"
                                value={line.quantity}
                                onChange={e => updateEditLine(i, "quantity", e.target.value)}
                                className={`w-24 px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 text-right
                                  ${isOver ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:ring-[#C6AF4B]/30"}`} />
                              {isOver && <p className="text-[10px] text-red-500 mt-0.5">Exceeds ordered</p>}
                            </td>
                            <td className="px-3 py-3">
                              <input type="number" min="0" step="0.01"
                                value={line.unitPrice}
                                onChange={e => updateEditLine(i, "unitPrice", e.target.value)}
                                className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 text-right" />
                            </td>
                            <td className="px-3 py-3">
                              <input type="text"
                                value={line.warehouseLocation}
                                onChange={e => updateEditLine(i, "warehouseLocation", e.target.value)}
                                placeholder="Bin / shelf…"
                                className="w-32 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                            </td>
                          </tr>
                        );
                      })
                    : pr.items.map((item, i) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-xs text-gray-400">{i+1}</td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900">{item.item_name}</td>
                          <td className="px-3 py-3 text-xs font-mono text-gray-500">{item.item_code}</td>
                          <td className="px-3 py-3 text-xs text-gray-500">{item.unit_type ?? "—"}</td>
                          <td className="px-3 py-3 text-sm font-mono font-semibold text-green-700">{parseFloat(item.quantity).toFixed(3)}</td>
                          <td className="px-3 py-3 text-xs font-mono text-gray-500">₹{parseFloat(item.unit_price).toFixed(2)}</td>
                          <td className="px-3 py-3 text-xs text-gray-500">{item.warehouse_location ?? "—"}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Cancel confirmation modal */}
        {cancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className={`${card} w-full max-w-sm p-6`}>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Cancel Purchase Receipt?</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Cancel <span className="font-semibold">{pr.pr_number}</span>?
                    {pr.status === "Received" && (
                      <span className="block mt-1 text-red-600">This receipt is already confirmed. Cancelling will reverse the inventory update.</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setCancelConfirm(false)} disabled={actioning}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">Keep</button>
                <button onClick={handleCancel} disabled={actioning}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                  {actioning ? "Cancelling…" : "Yes, Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── CREATE mode ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
      <TopNavbar username={(me as any)?.name ?? ""} role={(me as any)?.role ?? ""} onLogout={handleLogout} isLoggingOut={false} />
      <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/procurement/purchase-receipts")}
            className="p-2 rounded-xl hover:bg-[#C6AF4B]/10 transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" style={{ color: G }} />
              <h1 className="text-xl font-bold text-gray-900">New Purchase Receipt</h1>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Record goods received against a purchase order</p>
          </div>
        </div>

        {/* PO Selection */}
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Receipt Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Order <span className="text-red-500">*</span></label>
              <div className="relative">
                <select value={selectedPoId}
                  onChange={e => setSelectedPoId(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full appearance-none pl-3 pr-8 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 bg-white">
                  <option value="">Select open PO with pending items…</option>
                  {approvedPos.map(po => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} — {po.vendor_name} · {po.pending_items} pending item{po.pending_items !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              </div>
              {approvedPos.length === 0 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> No open POs with pending items. Approve a PO or check pending quantities.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Received Date</label>
              <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
            </div>
          </div>

          {poDetail && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">Vendor:</span>
              <span className="text-xs font-semibold text-gray-900">{poDetail.vendor_name}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500">Source:</span>
              <span className="text-xs font-semibold text-gray-900">{poDetail.reference_type}</span>
            </div>
          )}
        </div>

        {/* Line Items */}
        {selectedPoId && (
          <div className={card}>
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Items to Receive</h3>
              <p className="text-xs text-gray-500 mt-0.5">Enter quantities for items you are receiving in this delivery</p>
            </div>
            {loadingPo ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 rounded-full border-2 border-[#C6AF4B] border-t-transparent animate-spin" />
              </div>
            ) : lines.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-700 font-medium">All items fully received</p>
                <p className="text-xs text-gray-400">This PO has no pending quantities</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F8F6F0]">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-8">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Item</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-20">Unit</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-24">Ordered</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-24">Received</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-24">Pending</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">Now Receiving</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-amber-700 w-28">Target Price (₹)</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">Received Rate (₹)</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lines.map((line, idx) => {
                      const pendingNum = parseFloat(line.pendingQty);
                      const nowNum = parseFloat(line.quantity) || 0;
                      const receivedRate = parseFloat(line.unitPrice) || 0;
                      const targetRate = parseFloat(line.targetPrice) || 0;
                      const variance = receivedRate - targetRate;
                      const isOver = nowNum > pendingNum + 0.001;
                      return (
                        <tr key={line.poItemId} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-xs text-gray-400">{idx+1}</td>
                          <td className="px-3 py-3">
                            <div className="text-sm font-medium text-gray-900">{line.itemName}</div>
                            <div className="text-xs text-gray-400">{line.itemCode}</div>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">{line.unitType || "—"}</td>
                          <td className="px-3 py-3 text-xs font-mono text-gray-600">{parseFloat(line.orderedQty).toFixed(3)}</td>
                          <td className="px-3 py-3 text-xs font-mono text-green-700">{parseFloat(line.receivedSoFar).toFixed(3)}</td>
                          <td className="px-3 py-3 text-xs font-mono font-semibold text-amber-600">{pendingNum.toFixed(3)}</td>
                          <td className="px-3 py-3">
                            <input type="number" min="0" step="0.001" max={pendingNum}
                              value={line.quantity}
                              onChange={e => updateLine(idx, "quantity", e.target.value)}
                              placeholder="0.000"
                              className={`w-full px-2 py-1.5 text-sm text-gray-900 border rounded-lg focus:outline-none focus:ring-2 text-right
                                ${isOver ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:ring-[#C6AF4B]/30"}`} />
                            {isOver && <p className="text-[10px] text-red-500 mt-0.5">Exceeds pending</p>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-sm font-mono text-amber-700 font-semibold text-right pr-1">₹{targetRate.toFixed(2)}</div>
                          </td>
                          <td className="px-3 py-3">
                            <input type="number" min="0" step="0.01"
                              value={line.unitPrice}
                              onChange={e => updateLine(idx, "unitPrice", e.target.value)}
                              className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 text-right
                                ${variance > 0.005 ? "border-red-300 text-red-700 focus:ring-red-200" : variance < -0.005 ? "border-green-300 text-green-700 focus:ring-green-200" : "border-gray-200 text-gray-900 focus:ring-[#C6AF4B]/30"}`} />
                            {Math.abs(variance) > 0.005 && nowNum > 0 && (
                              <p className={`text-[10px] mt-0.5 text-right ${variance > 0 ? "text-red-500" : "text-green-600"}`}>
                                {variance > 0 ? `+₹${variance.toFixed(2)}` : `-₹${Math.abs(variance).toFixed(2)}`}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <input type="text"
                              value={line.warehouseLocation}
                              onChange={e => updateLine(idx, "warehouseLocation", e.target.value)}
                              placeholder="Bin / shelf…"
                              className="w-full px-2 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pricing Summary */}
        {selectedPoId && lines.length > 0 && (() => {
          const validLines = lines.filter(l => parseFloat(l.quantity) > 0);
          const targetTotal    = validLines.reduce((s, l) => s + parseFloat(l.quantity) * (parseFloat(l.targetPrice) || 0), 0);
          const receivedTotal  = validLines.reduce((s, l) => s + parseFloat(l.quantity) * (parseFloat(l.unitPrice) || 0), 0);
          const variance       = receivedTotal - targetTotal;
          if (!validLines.length) return null;
          return (
            <div className={`${card} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4" style={{ color: G }} />
                <h3 className="text-sm font-semibold text-gray-700">Pricing Summary</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Items Receiving</p>
                  <p className="text-lg font-bold text-gray-900">{validLines.length}</p>
                </div>
                <div>
                  <p className="text-xs text-amber-600 font-medium">Target Value (₹)</p>
                  <p className="text-lg font-bold text-amber-700">₹{targetTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">Received Value (₹)</p>
                  <p className="text-lg font-bold text-gray-900">₹{receivedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className={`text-xs font-medium ${Math.abs(variance) < 0.01 ? "text-gray-500" : variance > 0 ? "text-red-600" : "text-green-600"}`}>
                    Price Variance (₹)
                  </p>
                  <p className={`text-lg font-bold ${Math.abs(variance) < 0.01 ? "text-gray-500" : variance > 0 ? "text-red-600" : "text-green-600"}`}>
                    {variance >= 0 ? "+" : ""}₹{variance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Actions */}
        {selectedPoId && lines.length > 0 && (
          <div className="flex justify-end gap-3">
            <button onClick={() => navigate("/procurement/purchase-receipts")}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={() => handleSubmit(false)} disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-900 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {submitting ? "Saving…" : "Save as Draft"}
            </button>
            <button onClick={() => handleSubmit(true)} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#059669,#047857)" }}>
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? "Confirming…" : "Confirm & Update Inventory"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
