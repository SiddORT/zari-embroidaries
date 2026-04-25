import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Loader2,
  ShoppingCart, FileText, CreditCard, X, CheckCircle2,
  ArrowRight, Paperclip, Package, Info, Download, Clock, Truck,
  Pencil, History, FileDown,
} from "lucide-react";
import { downloadCostingPoPdf } from "@/utils/pdfExport";
import { logActivity } from "@/utils/logActivity";
import { logDownload } from "@/utils/logDownload";
import CostingPaymentsPanel from "@/components/CostingPaymentsPanel";
import { useCostingPaymentTotals } from "@/hooks/useCostingPayments";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAllVendors } from "@/hooks/useVendors";
import { useAllMaterials } from "@/hooks/useMaterials";
import { useAllFabrics } from "@/hooks/useFabrics";
import { useStyleOrderProducts } from "@/hooks/useStyleOrderProducts";
import {
  useStyleBom, useAddStyleBomRow, useDeleteStyleBomRow, useUpdateBomQty, useBomChangeLog,
  useStylePOs, useCreateStylePO, useUpdateStylePO as useUpdatePO, useDeleteStylePO,
  useStylePRs, useCreateStylePR, useDeleteStylePR,
  usePrPayments, useAddPayment, useDeletePayment,
  useStyleConsumptionLog, useAddStyleConsumptionEntry, useDeleteStyleConsumptionEntry,
  useStyleArtisanTimesheets, useCreateStyleArtisanTimesheet, useDeleteStyleArtisanTimesheet,
  useStyleOutsourceJobs, useCreateStyleOutsourceJob, useDeleteStyleOutsourceJob,
  useStyleCustomCharges, useCreateStyleCustomCharge, useDeleteStyleCustomCharge,
  useVendorSearch, useHsnSearch,
  type BomRecord, type PurchaseOrderRecord, type PurchaseReceiptRecord,
  type PrPaymentRecord, type PoLineItem, type BomChangeLogEntry,
} from "@/hooks/useCosting";

const PO_STATUSES = ["Draft", "Pending Approval", "Approved", "In Process", "Closed"];
const PO_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  "Pending Approval": "bg-amber-100 text-amber-700",
  Approved: "bg-green-100 text-green-700",
  "In Process": "bg-blue-100 text-blue-700",
  Closed: "bg-gray-200 text-gray-500",
};
const PR_STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  Closed: "bg-gray-200 text-gray-500",
};

function computeRowMetrics(r: BomRecord, pos: PurchaseOrderRecord[], prs: PurchaseReceiptRecord[]) {
  const poLineItems = pos.flatMap(po => po.bomItems ?? []).filter(item => item.bomRowId === r.id);
  const posWithRow = pos.filter(po => (po.bomItems ?? []).some(item => item.bomRowId === r.id));
  const prsForRow = prs.filter(pr => {
    if (pr.bomRowId != null) return pr.bomRowId === r.id;
    return posWithRow.some(po => po.id === pr.poId);
  });
  const poTargetPrice = poLineItems.length > 0 ? parseFloat(poLineItems[poLineItems.length - 1].targetPrice || "0") : 0;
  const poQty = poLineItems.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
  const poTargetTotal = poLineItems.reduce((s, i) => s + (parseFloat(i.targetPrice) || 0) * (parseFloat(i.quantity) || 0), 0);
  const prQty = prsForRow.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);
  const prTotal = prsForRow.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0) * (parseFloat(pr.actualPrice) || 0), 0);
  const stockNum = parseFloat(r.currentStock || "0");
  const avgPriceNum = parseFloat(r.avgUnitPrice || "0");
  const weightedAvg = (stockNum + prQty) > 0 ? (stockNum * avgPriceNum + prTotal) / (stockNum + prQty) : avgPriceNum;
  const consumedQtyNum = parseFloat(r.consumedQty ?? "0");
  const consumedTotal = consumedQtyNum * weightedAvg;
  return { poTargetPrice, poQty, poTargetTotal, prQty, prTotal, weightedAvg, consumedQtyNum, consumedTotal, stockNum };
}

function SectionHeader({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-[#C9B45C]">{icon}</span>
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <tr><td colSpan={99} className="px-4 py-6 text-center text-xs text-gray-400 italic">{text}</td></tr>
  );
}

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  const cls = map[status] ?? "bg-gray-100 text-gray-600";
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

// ─── BOM Section ─────────────────────────────────────────────────────────────
function StyleBomSection({ styleOrderId, orderCode, styleName, clientName }: {
  styleOrderId: number;
  orderCode?: string;
  styleName?: string;
  clientName?: string;
}) {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useStyleBom(styleOrderId);
  const { data: pos = [] } = useStylePOs(styleOrderId);
  const { data: prs = [] } = useStylePRs(styleOrderId);
  const addRow = useAddStyleBomRow();
  const deleteRow = useDeleteStyleBomRow();
  const updateBomQty = useUpdateBomQty();
  const { data: allMaterials = [] } = useAllMaterials();
  const { data: allFabrics = [] } = useAllFabrics();

  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "material" | "fabric">("all");
  const [editRow, setEditRow] = useState<BomRecord | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [logRowId, setLogRowId] = useState<number | null>(null);
  const { data: bomChangeLog = [] } = useBomChangeLog(logRowId);
  const [form, setForm] = useState({
    materialType: "", materialId: 0, materialCode: "", materialName: "",
    currentStock: "", avgUnitPrice: "", unitType: "", warehouseLocation: "", requiredQty: "",
  });

  // Live inventory lookup for the currently-selected material/fabric
  const { data: selectedInv } = useQuery({
    queryKey: ["inv-by-source", form.materialType, form.materialId],
    queryFn: async () => {
      if (!form.materialType || !form.materialId) return null;
      const r = await customFetch<{ data: { current_stock: string; available_stock: string }[] }>(
        `/api/inventory/items?sourceType=${form.materialType}&search=${encodeURIComponent(form.materialCode)}&limit=5`
      );
      return r.data?.find(
        (i: any) => i.source_type === form.materialType && String(i.source_id) === String(form.materialId)
      ) ?? null;
    },
    enabled: !!form.materialType && form.materialId > 0,
    staleTime: 30_000,
  });

  const estimatedAmount = (parseFloat(form.requiredQty) || 0) * (parseFloat(form.avgUnitPrice) || 0);
  const selectedMaterialId = form.materialType === "material" ? String(form.materialId) : "";
  const selectedFabricId = form.materialType === "fabric" ? String(form.materialId) : "";

  function onMaterialChange(id: string) {
    if (!id) { setForm(f => ({ ...f, materialType: "", materialId: 0, materialCode: "", materialName: "", currentStock: "", avgUnitPrice: "", unitType: "", warehouseLocation: "" })); return; }
    const m = allMaterials.find(m => String(m.id) === id);
    if (!m) return;
    setForm(f => ({
      ...f, materialType: "material", materialId: m.id, materialCode: m.materialCode,
      materialName: [m.itemType, m.quality].filter(Boolean).join(" – "),
      currentStock: m.currentStock, avgUnitPrice: m.unitPrice, unitType: m.unitType, warehouseLocation: m.location ?? "",
    }));
  }

  function onFabricChange(id: string) {
    if (!id) { setForm(f => ({ ...f, materialType: "", materialId: 0, materialCode: "", materialName: "", currentStock: "", avgUnitPrice: "", unitType: "", warehouseLocation: "" })); return; }
    const fab = allFabrics.find(f => String(f.id) === id);
    if (!fab) return;
    setForm(prev => ({
      ...prev, materialType: "fabric", materialId: fab.id, materialCode: fab.fabricCode,
      materialName: [fab.fabricType, fab.quality].filter(Boolean).join(" – "),
      currentStock: fab.currentStock, avgUnitPrice: fab.pricePerMeter, unitType: fab.unitType, warehouseLocation: fab.location ?? "",
    }));
  }

  async function handleAdd() {
    if (!form.materialId) { toast({ title: "Select a material or fabric first", variant: "destructive" }); return; }
    if (!form.requiredQty || parseFloat(form.requiredQty) <= 0) { toast({ title: "Required quantity must be > 0", variant: "destructive" }); return; }
    const result = await addRow.mutateAsync({ ...form, styleOrderId, estimatedAmount: estimatedAmount.toFixed(2) });
    setForm({ materialType: "", materialId: 0, materialCode: "", materialName: "", currentStock: "", avgUnitPrice: "", unitType: "", warehouseLocation: "", requiredQty: "" });
    setShowForm(false);
    const resv = result?.reservation;
    if (resv?.status === "created") {
      toast({ title: "BOM row added — reservation created and inventory updated" });
    } else if (resv?.status === "updated") {
      toast({ title: "BOM row added — existing reservation updated" });
    } else if (resv?.status === "skipped" && resv?.reason) {
      toast({ title: "BOM row added", description: `Note: ${resv.reason}`, variant: "destructive" });
    } else {
      toast({ title: "BOM row added" });
    }
  }

  const filteredRows = typeFilter === "all" ? rows : rows.filter(r => r.materialType === typeFilter);

  function exportToExcel() {
    const today = new Date().toLocaleDateString("en-IN");
    const header = [
      ["ZARI EMBROIDERIES – Bill of Materials"],
      ["Order:", orderCode ?? "—", "Style:", styleName ?? "—", "Client:", clientName ?? "—", "Date:", today],
      [],
      ["Code", "Material/Fabric", "Type", "Stock", "Avg Price (₹)", "Req Qty", "PO Target Price (₹)", "PO Qty", "PR Qty", "PR Total (₹)", "Consumed Qty", "Consumed Total (₹)"],
    ];
    const dataRows = filteredRows.map(r => {
      const m = computeRowMetrics(r, pos, prs);
      return [
        r.materialCode, r.materialName, r.materialType === "fabric" ? "Fabric" : "Material",
        r.currentStock, parseFloat(r.avgUnitPrice).toFixed(2), r.requiredQty,
        m.poTargetPrice > 0 ? m.poTargetPrice.toFixed(2) : "—",
        m.poQty > 0 ? m.poQty : "—", m.prQty > 0 ? m.prQty : "—",
        m.prTotal > 0 ? m.prTotal.toFixed(2) : "—",
        m.consumedQtyNum > 0 ? m.consumedQtyNum : "—",
        m.consumedTotal > 0 ? m.consumedTotal.toFixed(2) : "—",
      ];
    });
    const aoa = [...header, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [12, 28, 10, 10, 14, 10, 18, 10, 10, 14, 14, 18].map(w => ({ wch: w }));
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOM");
    const bomXlsxName = `BOM_${orderCode ?? styleOrderId}_${today.replace(/\//g, "-")}.xlsx`;
    XLSX.writeFile(wb, bomXlsxName);
    logDownload({ file_type: "Excel", file_name: bomXlsxName, module: "Bill of Materials", reference: orderCode ?? String(styleOrderId ?? "") });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <SectionHeader icon={<FileText className="h-4 w-4" />} title="Bill of Materials (BOM)">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-[11px]">
            {(["all", "material", "fabric"] as const).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`px-2.5 py-1.5 font-medium transition-colors ${typeFilter === f ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {f === "all" ? "All" : f === "material" ? "MAT" : "FAB"}
              </button>
            ))}
          </div>
          {rows.length > 0 && (
            <button onClick={exportToExcel}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          )}
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Material/Fabric
          </button>
        </div>
      </SectionHeader>

      {showForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                Select Material
                {form.materialType === "fabric" && <span className="ml-1 text-[9px] text-amber-500 normal-case">(clear fabric first)</span>}
              </label>
              <select value={selectedMaterialId} disabled={form.materialType === "fabric"}
                onChange={e => onMaterialChange(e.target.value)}
                className={`w-full mt-0.5 text-xs text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white transition-opacity ${form.materialType === "fabric" ? "opacity-40 cursor-not-allowed" : ""}`}>
                <option value="">— Select material —</option>
                {allMaterials.map(m => (
                  <option key={m.id} value={m.id}>{[m.itemType, m.quality].filter(Boolean).join(" – ")} ({m.materialCode})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                Select Fabric
                {form.materialType === "material" && <span className="ml-1 text-[9px] text-amber-500 normal-case">(clear material first)</span>}
              </label>
              <select value={selectedFabricId} disabled={form.materialType === "material"}
                onChange={e => onFabricChange(e.target.value)}
                className={`w-full mt-0.5 text-xs text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white transition-opacity ${form.materialType === "material" ? "opacity-40 cursor-not-allowed" : ""}`}>
                <option value="">— Select fabric —</option>
                {allFabrics.map(f => (
                  <option key={f.id} value={f.id}>{[f.fabricType, f.quality].filter(Boolean).join(" – ")} ({f.fabricCode})</option>
                ))}
              </select>
            </div>
          </div>
          {form.materialId > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-[10px] text-gray-400 mb-1">Inventory Stock</p>
                {selectedInv ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-gray-400 w-10 shrink-0">Current</span>
                      <span className="font-semibold text-gray-800">{parseFloat(selectedInv.current_stock).toFixed(2)}</span>
                      <span className="text-[10px] text-gray-400">{form.unitType}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] text-gray-400 w-10 shrink-0">Avail</span>
                      <span className={`font-semibold ${parseFloat(selectedInv.available_stock) <= 0 ? "text-red-600" : "text-green-700"}`}>
                        {parseFloat(selectedInv.available_stock).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-400">{form.unitType}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-gray-400 italic">not in inventory</p>
                )}
              </div>
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-[10px] text-gray-400">Avg Price</p>
                <p className="font-semibold text-gray-800">₹{form.avgUnitPrice}/{form.unitType}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-[10px] text-gray-400">Unit</p>
                <p className="font-semibold text-gray-800">{form.unitType}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-[10px] text-gray-400">Location</p>
                <p className="font-semibold text-gray-800 truncate">{form.warehouseLocation || "—"}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 font-medium">Required / Reserved Qty</label>
              <input type="number" min="0" step="any" value={form.requiredQty}
                onChange={e => setForm(f => ({ ...f, requiredQty: e.target.value }))}
                className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="0" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 font-medium">Estimated Amount</label>
              <div className="mt-0.5 text-xs border border-gray-100 rounded-xl px-3 py-2 bg-gray-50 font-semibold text-gray-700">
                ₹{estimatedAmount.toFixed(2)}
              </div>
            </div>
            <button onClick={handleAdd} disabled={addRow.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors disabled:opacity-60">
              {addRow.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
            </button>
            <button onClick={() => setShowForm(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[1100px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Code</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Material / Fabric</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Current / Available Stock</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">
                <span className="flex items-center gap-1">Avg Price <span title="Weighted average of current stock price and all PR actual prices received" className="cursor-help text-gray-500 hover:text-gray-500"><Info className="h-3 w-3" /></span></span>
              </th>
              <th className="text-left text-[10px] font-semibold text-amber-500 px-3 py-2 whitespace-nowrap">
                <span className="flex items-center gap-1">PO Rate ₹ <span title="Target unit price agreed in the Purchase Order" className="cursor-help text-gray-500 hover:text-gray-500"><Info className="h-3 w-3" /></span></span>
              </th>
              <th className="text-left text-[10px] font-semibold text-violet-500 px-3 py-2 whitespace-nowrap">Req / Reserved Qty</th>
              <th className="text-left text-[10px] font-semibold text-amber-500 px-3 py-2 whitespace-nowrap">PO Total ₹</th>
              <th className="text-left text-[10px] font-semibold text-amber-500 px-3 py-2 whitespace-nowrap">PO Qty</th>
              <th className="text-left text-[10px] font-semibold text-blue-500 px-3 py-2 whitespace-nowrap">PR Qty</th>
              <th className="text-left text-[10px] font-semibold text-blue-500 px-3 py-2 whitespace-nowrap">PR Total</th>
              <th className="text-left text-[10px] font-semibold text-green-600 px-3 py-2 whitespace-nowrap">Consumed Qty</th>
              <th className="text-left text-[10px] font-semibold text-green-600 px-3 py-2 whitespace-nowrap">Consumed Total</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={12} className="px-4 py-6 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filteredRows.length === 0 ? (
              <EmptyRow text={rows.length === 0 ? "No BOM rows yet. Add a material above." : "No rows match the current filter."} />
            ) : filteredRows.map(r => {
              const m = computeRowMetrics(r, pos, prs);
              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">{r.materialCode}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1 py-0.5 rounded font-bold shrink-0 ${r.materialType === "fabric" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {r.materialType === "fabric" ? "FAB" : "MAT"}
                      </span>
                      <span className="text-gray-800 font-medium">{r.materialName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.liveCurrentStock != null ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-gray-400 w-10 shrink-0">Current</span>
                          <span className="font-semibold text-gray-800">{parseFloat(r.liveCurrentStock).toFixed(2)}</span>
                          <span className="text-gray-400 text-[10px]">{r.unitType}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-gray-400 w-10 shrink-0">Avail</span>
                          <span className={`font-semibold text-[11px] ${parseFloat(r.liveAvailableStock ?? "0") <= 0 ? "text-red-600" : "text-green-700"}`}>
                            {parseFloat(r.liveAvailableStock ?? "0").toFixed(2)}
                          </span>
                          <span className="text-gray-400 text-[10px]">{r.unitType}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-[10px] italic">not in inventory</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">₹{m.weightedAvg.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-amber-700 whitespace-nowrap">{m.poTargetPrice > 0 ? `₹${m.poTargetPrice.toFixed(2)}` : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-violet-700">{parseFloat(r.requiredQty).toFixed(2)}</span>
                    <span className="text-gray-400 ml-1 text-[10px]">{r.unitType}</span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-amber-700">{m.poTargetTotal > 0 ? `₹${m.poTargetTotal.toFixed(2)}` : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-amber-700">{m.poQty > 0 ? m.poQty : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-blue-700">{m.prQty > 0 ? m.prQty : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 font-semibold text-blue-700">{m.prTotal > 0 ? `₹${m.prTotal.toFixed(2)}` : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-green-700 font-semibold">{m.consumedQtyNum > 0 ? m.consumedQtyNum : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 font-semibold text-green-700">{m.consumedTotal > 0 ? `₹${m.consumedTotal.toFixed(2)}` : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditRow(r); setEditQty(""); setEditNotes(""); }}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Add to Req / Reserved Qty">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setLogRowId(r.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Change Log">
                        <History className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteRow.mutate(r.id)} disabled={deleteRow.isPending}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length > 0 && (
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={5} className="px-3 py-2 text-[10px] font-semibold text-gray-400">{filteredRows.length} item{filteredRows.length > 1 ? "s" : ""}</td>
                <td className="px-3 py-2 font-bold text-gray-700 text-xs">{filteredRows.reduce((s, r) => s + (parseFloat(r.requiredQty) || 0), 0)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 font-bold text-amber-700 text-xs">₹{filteredRows.reduce((s, r) => s + computeRowMetrics(r, pos, prs).poTargetTotal, 0).toFixed(2)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 font-bold text-blue-700 text-xs">{filteredRows.reduce((s, r) => s + computeRowMetrics(r, pos, prs).prQty, 0).toFixed(0)}</td>
                <td className="px-3 py-2 font-bold text-blue-700 text-xs">₹{filteredRows.reduce((s, r) => s + computeRowMetrics(r, pos, prs).prTotal, 0).toFixed(2)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 font-bold text-green-700 text-xs">₹{filteredRows.reduce((s, r) => s + computeRowMetrics(r, pos, prs).consumedTotal, 0).toFixed(2)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Edit BOM Qty Modal ── */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Edit Req / Reserved Qty</h3>
              <button onClick={() => setEditRow(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm">
              <div className="font-semibold text-gray-800">[{editRow.materialCode}] {editRow.materialName}</div>
              <div className="text-xs text-violet-700 mt-1">Current Req / Reserved: <span className="font-semibold">{editRow.requiredQty} {editRow.unitType}</span></div>
            </div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Add to Req / Reserved Qty *</label>
            <input type="number" min="0.001" step="any" value={editQty}
              onChange={e => setEditQty(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 mb-1" />
            {editQty && parseFloat(editQty) > 0 && (
              <p className="text-xs text-violet-700 mb-3">
                New total: <span className="font-bold">{(parseFloat(editRow.requiredQty) + parseFloat(editQty)).toFixed(2)} {editRow.unitType}</span>
                <span className="text-gray-400 ml-1">(current {editRow.requiredQty} + {parseFloat(editQty).toFixed(2)})</span>
              </p>
            )}
            {(!editQty || parseFloat(editQty) <= 0) && <div className="mb-3" />}
            <label className="block text-xs font-semibold text-gray-700 mb-1">Reason / Notes</label>
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
              placeholder="Why is the qty changing? (optional)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none h-20 mb-4" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditRow(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button disabled={updateBomQty.isPending || !editQty || parseFloat(editQty) <= 0}
                onClick={() => {
                  const newTotal = String(parseFloat(editRow!.requiredQty) + parseFloat(editQty));
                  updateBomQty.mutate(
                    { id: editRow!.id, requiredQty: newTotal, notes: editNotes || undefined },
                    {
                      onSuccess: (res) => {
                        toast({ title: res.changed ? "Req / Reserved qty updated" : "No change made" });
                        setEditRow(null);
                      },
                      onError: (err: any) => toast({ title: err?.message ?? "Failed to update qty", variant: "destructive" }),
                    }
                  );
                }}
                className="px-4 py-2 rounded-xl bg-violet-700 text-white text-sm font-semibold hover:bg-violet-800 disabled:opacity-50 flex items-center gap-1.5">
                {updateBomQty.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add Qty
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOM Change Log Modal ── */}
      {logRowId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><History className="h-4 w-4 text-indigo-600" /> BOM Change History</h3>
              <button onClick={() => setLogRowId(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            {bomChangeLog.length === 0 ? (
              <p className="text-center text-sm text-gray-400 italic py-8">No changes recorded for this row.</p>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-2">
                {bomChangeLog.map((entry: BomChangeLogEntry) => {
                  const delta = parseFloat(entry.delta);
                  return (
                    <div key={entry.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-800">{parseFloat(entry.old_qty).toFixed(2)} → {parseFloat(entry.new_qty).toFixed(2)} {entry.material_name}</span>
                        <span className={`font-bold ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}>{delta > 0 ? "+" : ""}{delta.toFixed(2)}</span>
                      </div>
                      {entry.reservation_delta && parseFloat(entry.reservation_delta) !== 0 && (
                        <div className="text-violet-700 mb-1">Reservation: {parseFloat(entry.reservation_delta) > 0 ? "+" : ""}{parseFloat(entry.reservation_delta).toFixed(2)}</div>
                      )}
                      {entry.notes && <div className="text-gray-600 mb-1 italic">"{entry.notes}"</div>}
                      <div className="text-gray-400">{entry.changed_by} · {new Date(entry.changed_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Payment Components ────────────────────────────────────────────────
const PAYMENT_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Processing: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
};

function StylePaymentRow({ pay, onDelete }: { pay: PrPaymentRecord; onDelete: () => void }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="px-3 py-2.5 text-gray-700 font-medium">{pay.paymentType}</td>
      <td className="px-3 py-2.5 text-gray-600">{pay.paymentMode || "—"}</td>
      <td className="px-3 py-2.5 font-semibold text-gray-900">₹{pay.amount}</td>
      <td className="px-3 py-2.5 text-gray-500">{pay.paymentDate ? new Date(pay.paymentDate).toLocaleDateString() : "—"}</td>
      <td className="px-3 py-2.5 text-gray-500">{pay.transactionStatus || "—"}</td>
      <td className="px-3 py-2.5"><StatusBadge status={pay.paymentStatus} map={PAYMENT_STATUS_COLORS} /></td>
      <td className="px-3 py-2.5">
        {pay.attachment ? (
          <a href={pay.attachment.data} download={pay.attachment.name} className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
            <Paperclip className="h-3 w-3" />{pay.attachment.name}
          </a>
        ) : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2.5">
        <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
      </td>
    </tr>
  );
}

function StylePrPaymentsPanel({ prId }: { prId: number }) {
  const { toast } = useToast();
  const { data: payments = [] } = usePrPayments(prId);
  const addPay = useAddPayment();
  const delPay = useDeletePayment();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [payForm, setPayForm] = useState({
    paymentType: "Partial", paymentDate: new Date().toISOString().slice(0, 10),
    paymentMode: "", amount: "", transactionStatus: "", paymentStatus: "Pending",
    attachment: null as null | { name: string; type: string; data: string; size: number },
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPayForm(f => ({ ...f, attachment: { name: file.name, type: file.type, data: ev.target?.result as string, size: file.size } }));
    reader.readAsDataURL(file);
  }

  async function handleAdd() {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    await addPay.mutateAsync({ prId, ...payForm });
    setPayForm({ paymentType: "Partial", paymentDate: new Date().toISOString().slice(0, 10), paymentMode: "", amount: "", transactionStatus: "", paymentStatus: "Pending", attachment: null });
    setShowForm(false);
    toast({ title: "Payment recorded" });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          Payments {payments.length > 0 && <span className="text-gray-600">({payments.length})</span>}
        </p>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
          <CreditCard className="h-3 w-3" /> Record Payment
        </button>
      </div>
      {showForm && (
        <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 font-medium">Type</label>
              <select value={payForm.paymentType} onChange={e => setPayForm(f => ({ ...f, paymentType: e.target.value }))} className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none">
                {["Advance", "Partial", "Full"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium">Mode</label>
              <input value={payForm.paymentMode} onChange={e => setPayForm(f => ({ ...f, paymentMode: e.target.value }))} className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none" placeholder="Bank / UPI / Cash…" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium">Amount (₹)</label>
              <input type="number" min="0" step="any" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none" placeholder="0.00" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium">Date</label>
              <input type="date" value={payForm.paymentDate} onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))} className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium">Transaction Status</label>
              <input value={payForm.transactionStatus} onChange={e => setPayForm(f => ({ ...f, transactionStatus: e.target.value }))} className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none" placeholder="e.g. TXN123456" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium">Payment Status</label>
              <select value={payForm.paymentStatus} onChange={e => setPayForm(f => ({ ...f, paymentStatus: e.target.value }))} className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none">
                {["Pending", "Processing", "Completed", "Failed"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
              <Paperclip className="h-3 w-3" /> {payForm.attachment ? payForm.attachment.name : "Attach file"}
            </button>
            {payForm.attachment && <button onClick={() => setPayForm(f => ({ ...f, attachment: null }))} className="text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>}
            <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
            <button onClick={handleAdd} disabled={addPay.isPending}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors disabled:opacity-60">
              {addPay.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Save
            </button>
            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            {["Type", "Mode", "Amount", "Date", "Txn Status", "Pay Status", "Attachment", ""].map(h => (
              <th key={h} className="text-left text-[10px] font-semibold text-gray-400 px-3 py-1.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.length === 0
            ? <EmptyRow text="No payments recorded" />
            : payments.map(p => <StylePaymentRow key={p.id} pay={p} onDelete={() => delPay.mutate(p.id)} />)}
        </tbody>
      </table>
    </div>
  );
}

function StylePrTableRow({ pr, poNumber, bomItems }: { pr: PurchaseReceiptRecord; poNumber: string; bomItems: PoLineItem[] }) {
  const [open, setOpen] = useState(false);
  const deletePr = useDeleteStylePR();
  const total = (parseFloat(pr.receivedQty) || 0) * (parseFloat(pr.actualPrice) || 0);
  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50/50">
        <td className="px-3 py-2.5 font-mono text-[10px] font-bold text-gray-700">{pr.prNumber}</td>
        <td className="px-3 py-2.5 font-mono text-[10px] text-amber-700 font-semibold">{poNumber}</td>
        <td className="px-3 py-2.5 text-gray-700 text-xs">{pr.vendorName}</td>
        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{new Date(pr.receivedDate).toLocaleDateString()}</td>
        <td className="px-3 py-2.5 font-semibold text-gray-800 text-xs">{pr.receivedQty}</td>
        <td className="px-3 py-2.5 text-gray-700 text-xs">₹{parseFloat(pr.actualPrice).toFixed(2)}</td>
        <td className="px-3 py-2.5 font-semibold text-blue-700 text-xs">₹{total.toFixed(2)}</td>
        <td className="px-3 py-2.5 max-w-[200px]">
          {bomItems.length === 0 ? <span className="text-gray-300 text-xs">—</span> : (
            <div className="flex flex-col gap-1">
              {bomItems.slice(0, 2).map((item, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[9px] px-1 py-0.5 rounded font-bold shrink-0 bg-gray-100 text-gray-500 font-mono">{item.materialCode}</span>
                  <span className="text-[10px] text-gray-700 truncate">{item.materialName}</span>
                </div>
              ))}
              {bomItems.length > 2 && <span className="text-[10px] text-gray-400">+{bomItems.length - 2} more</span>}
            </div>
          )}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1">
            <button onClick={() => setOpen(v => !v)}
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors ${open ? "bg-gray-900 text-[#C9B45C] border-gray-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              <CreditCard className="h-3 w-3" /> Payments {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <button onClick={() => deletePr.mutate(pr.id)} disabled={deletePr.isPending}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50/60 border-b border-gray-100">
          <td colSpan={9} className="px-5 py-4"><StylePrPaymentsPanel prId={pr.id} /></td>
        </tr>
      )}
    </>
  );
}

function StylePoCard({ po, onCreatePR, onExportPdf }: { po: PurchaseOrderRecord; onCreatePR: (poId: number, vendorName: string, bomItems: PoLineItem[]) => void; onExportPdf: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const updatePo = useUpdatePO();
  const deletePo = useDeleteStylePO();
  const items: PoLineItem[] = po.bomItems ?? [];
  const canAdvance = po.status !== "Closed";
  const nextStatus = PO_STATUSES[PO_STATUSES.indexOf(po.status) + 1];
  const canCreatePR = ["Approved", "In Process"].includes(po.status);

  async function handleExport() {
    setExporting(true);
    try { onExportPdf(); } finally { setExporting(false); }
  }

  async function advance() {
    if (!nextStatus) return;
    await updatePo.mutateAsync({ id: po.id, status: nextStatus });
    toast({ title: `PO moved to ${nextStatus}` });
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-gray-700">{po.poNumber}</span>
            <StatusBadge status={po.status} map={PO_STATUS_COLORS} />
            {items.length > 0 && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Package className="h-3 w-3" />{items.length} item{items.length > 1 ? "s" : ""}</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{po.vendorName} · {new Date(po.poDate).toLocaleDateString()}</p>
          {po.status === "Draft" && (
            <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
              <span>⏳</span> Awaiting admin approval — email sent
            </p>
          )}
          {po.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{po.notes}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {canAdvance && nextStatus && (
            <button onClick={advance} disabled={updatePo.isPending}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50">
              {updatePo.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />} → {nextStatus}
            </button>
          )}
          {canCreatePR && (
            <button onClick={() => onCreatePR(po.id, po.vendorName, po.bomItems ?? [])}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-medium hover:bg-blue-100 transition-colors">
              <Plus className="h-3 w-3" /> Create PR
            </button>
          )}
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-[#C6AF4B] text-[#8a7a30] hover:bg-[#fdf9ec] font-medium transition-colors disabled:opacity-50">
            {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />} PDF
          </button>
          <button onClick={() => deletePo.mutate(po.id)} disabled={deletePo.isPending}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && items.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/40 p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Ordered Items</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                {["Code", "Item", "Qty", "Target Price", "Line Total"].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-gray-400 px-2 py-1.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-2 py-2 font-mono text-[10px] text-gray-500">{item.materialCode}</td>
                  <td className="px-2 py-2 text-gray-800">{item.materialName}</td>
                  <td className="px-2 py-2 text-gray-600">{parseFloat(item.quantity).toFixed(2)} {item.unitType}</td>
                  <td className="px-2 py-2 text-gray-600">₹{parseFloat(item.targetPrice).toFixed(2)}</td>
                  <td className="px-2 py-2 font-semibold text-gray-900">₹{((parseFloat(item.targetPrice) || 0) * (parseFloat(item.quantity) || 0)).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td colSpan={4} className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-500">Total Target</td>
                <td className="px-2 py-1.5 font-bold text-gray-900">₹{items.reduce((s, i) => s + (parseFloat(i.targetPrice) || 0) * (parseFloat(i.quantity) || 0), 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StyleCreatePoModal({
  styleOrderId, bomRows, vendors, onClose, onCreate,
}: {
  styleOrderId: number;
  bomRows: BomRecord[];
  vendors: { id: number; brandName: string }[];
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => void;
}) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);
  type Override = { checked: boolean; targetPrice: string; quantity: string; targetVendorId: string; targetVendorName: string };
  const [overrides, setOverrides] = useState<Record<number, Override>>(() =>
    Object.fromEntries(bomRows.map(r => [r.id, {
      checked: false, targetPrice: r.avgUnitPrice, quantity: r.requiredQty,
      targetVendorId: r.targetVendorId ? String(r.targetVendorId) : "",
      targetVendorName: r.targetVendorName ?? "",
    }]))
  );

  const toggleRow = (id: number) => setOverrides(prev => ({ ...prev, [id]: { ...prev[id], checked: !prev[id].checked } }));
  const setField = (id: number, field: "targetPrice" | "quantity", val: string) =>
    setOverrides(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  const setItemVendor = (id: number, vid: string) => {
    const v = vendors.find(v => String(v.id) === vid);
    setOverrides(prev => ({ ...prev, [id]: { ...prev[id], targetVendorId: vid, targetVendorName: v?.brandName ?? "" } }));
  };

  const selectedItems = bomRows.filter(r => overrides[r.id]?.checked);
  const totalTarget = selectedItems.reduce((s, r) => {
    const ov = overrides[r.id];
    return s + (parseFloat(ov.targetPrice) || 0) * (parseFloat(ov.quantity) || 0);
  }, 0);

  function handleSubmit() {
    if (selectedItems.length === 0) { toast({ title: "Select at least one BOM item", variant: "destructive" }); return; }
    const bomItems: PoLineItem[] = selectedItems.map(r => ({
      bomRowId: r.id, materialCode: r.materialCode, materialName: r.materialName,
      unitType: r.unitType, targetPrice: overrides[r.id].targetPrice, quantity: overrides[r.id].quantity,
      targetVendorId: overrides[r.id].targetVendorId ? Number(overrides[r.id].targetVendorId) : null,
      targetVendorName: overrides[r.id].targetVendorName || null,
    }));
    setIsPending(true);
    try {
      onCreate({ styleOrderId, notes: notes || undefined, bomItems });
      onClose();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="text-sm font-bold text-gray-900">Create Purchase Order</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          <div>
            <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full mt-1 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="Add notes…" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-2 block">Select BOM Items *</label>
            {bomRows.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No BOM rows available. Add materials to BOM first.</p>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 w-8"></th>
                      {["Code", "Item", "Stock", "Qty", "Target Price", "Target Vendor"].map(h => (
                        <th key={h} className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bomRows.map(r => {
                      const ov = overrides[r.id] ?? { checked: false, targetPrice: r.avgUnitPrice, quantity: r.requiredQty, targetVendorId: "", targetVendorName: "" };
                      return (
                        <tr key={r.id} className={`border-b border-gray-50 transition-colors ${ov.checked ? "bg-[#C9B45C]/5" : "hover:bg-gray-50/50"}`}>
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={ov.checked} onChange={() => toggleRow(r.id)}
                              className="rounded border-gray-300 text-gray-900 focus:ring-0" />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">{r.materialCode}</td>
                          <td className="px-3 py-2.5 text-gray-800 font-medium">{r.materialName}
                            <span className={`ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded ${r.materialType === "fabric" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}>
                              {r.materialType === "fabric" ? "FAB" : "MAT"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">{r.currentStock} {r.unitType}</td>
                          <td className="px-3 py-2.5">
                            <input type="number" min="0" step="any" value={ov.quantity}
                              onChange={e => setField(r.id, "quantity", e.target.value)}
                              disabled={!ov.checked}
                              className="w-20 text-xs text-gray-900 border border-gray-200 rounded-lg px-2 py-1 disabled:opacity-40 focus:outline-none" />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400">₹</span>
                              <input type="number" min="0" step="any" value={ov.targetPrice}
                                onChange={e => setField(r.id, "targetPrice", e.target.value)}
                                disabled={!ov.checked}
                                className="w-24 text-xs text-gray-900 border border-gray-200 rounded-lg px-2 py-1 disabled:opacity-40 focus:outline-none" />
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              value={ov.targetVendorId}
                              onChange={e => setItemVendor(r.id, e.target.value)}
                              disabled={!ov.checked}
                              className="w-36 text-xs text-gray-900 border border-gray-200 rounded-lg px-2 py-1 bg-white disabled:opacity-40 focus:outline-none"
                            >
                              <option value="">— Vendor —</option>
                              {vendors.map(v => <option key={v.id} value={v.id}>{v.brandName}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {selectedItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-600">{selectedItems.length} item{selectedItems.length > 1 ? "s" : ""} selected</span>
              <span className="font-bold text-amber-700 text-sm">Target Total: ₹{totalTarget.toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending || selectedItems.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors disabled:opacity-50">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />} Create PO
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PO Section ───────────────────────────────────────────────────────────────
function StylePoSection({ styleOrderId, orderCode, styleName, clientName }: {
  styleOrderId: number;
  orderCode?: string;
  styleName?: string;
  clientName?: string;
}) {
  const { toast } = useToast();
  const { data: pos = [], isLoading } = useStylePOs(styleOrderId);
  const { data: prs = [] } = useStylePRs(styleOrderId);
  const { data: bomRows = [] } = useStyleBom(styleOrderId);
  const { data: vendors = [] } = useAllVendors();
  const createPO = useCreateStylePO();
  const createPR = useCreateStylePR();

  function exportSinglePoPdf(po: PurchaseOrderRecord) {
    try {
      downloadCostingPoPdf({
        referenceType: "style",
        orderCode,
        entityName: styleName,
        clientName,
        orders: [{
          poNumber: po.poNumber,
          vendorName: po.vendorName,
          poDate: po.poDate,
          status: po.status,
          notes: po.notes,
          items: (po.bomItems ?? []).map(i => ({
            materialCode: i.materialCode,
            materialName: i.materialName,
            unitType: i.unitType,
            quantity: i.quantity,
            targetPrice: i.targetPrice,
            targetVendorName: i.targetVendorName,
          })),
        }],
      });
      logActivity(`Downloaded PO PDF ${po.poNumber} for Style Order ${orderCode}${clientName ? ` — ${clientName}` : ""}`);
      toast({ title: "PO PDF generated successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    }
  }

  const [showPoModal, setShowPoModal] = useState(false);
  const [prModal, setPrModal] = useState<{ poId: number; vendorName: string; bomItems: PoLineItem[] } | null>(null);
  const [prForm, setPrForm] = useState({ bomRowId: "" as string, receivedQty: "", actualPrice: "", warehouseLocation: "" });

  const prItemStats = (() => {
    if (!prModal) return null;
    const selectedBomRowId = prForm.bomRowId ? Number(prForm.bomRowId) : (prModal.bomItems.length === 1 ? prModal.bomItems[0].bomRowId : null);
    if (selectedBomRowId == null) return null;
    const item = prModal.bomItems.find(i => i.bomRowId === selectedBomRowId);
    if (!item) return null;
    const poPrs = prs.filter(pr => pr.poId === prModal.poId);
    const alreadyReceived = poPrs
      .filter(pr => pr.bomRowId === selectedBomRowId || (pr.bomRowId == null && prModal.bomItems.length === 1))
      .reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);
    const ordered = parseFloat(item.quantity) || 0;
    return { ordered, alreadyReceived, remaining: Math.max(0, ordered - alreadyReceived), unitType: item.unitType };
  })();

  function handleCreatePO(payload: Record<string, unknown>) {
    createPO.mutate(payload, {
      onSuccess: () => toast({ title: "Purchase Order created" }),
      onError: (err: any) => toast({ title: err?.message ?? "Failed to create PO", variant: "destructive" }),
    });
  }

  function handleCreatePR() {
    if (!prModal) return;
    if (prModal.bomItems.length > 1 && !prForm.bomRowId) { toast({ title: "Select an item for this PR", variant: "destructive" }); return; }
    if (!prForm.receivedQty || parseFloat(prForm.receivedQty) <= 0) { toast({ title: "Enter received quantity", variant: "destructive" }); return; }
    if (!prForm.actualPrice || parseFloat(prForm.actualPrice) <= 0) { toast({ title: "Enter actual price", variant: "destructive" }); return; }
    if (prItemStats && prItemStats.remaining <= 0) { toast({ title: "This item is already fully received.", variant: "destructive" }); return; }
    if (prItemStats && parseFloat(prForm.receivedQty) > prItemStats.remaining) {
      toast({ title: `Received qty exceeds remaining. Max: ${prItemStats.remaining.toFixed(2)} ${prItemStats.unitType}`, variant: "destructive" }); return;
    }
    const bomRowId = prForm.bomRowId ? Number(prForm.bomRowId) : (prModal.bomItems.length === 1 ? prModal.bomItems[0].bomRowId : null);
    createPR.mutate({ poId: prModal.poId, styleOrderId, bomRowId, receivedQty: prForm.receivedQty, actualPrice: prForm.actualPrice, warehouseLocation: prForm.warehouseLocation }, {
      onSuccess: () => { setPrForm({ bomRowId: "", receivedQty: "", actualPrice: "", warehouseLocation: "" }); setPrModal(null); toast({ title: "Purchase Receipt created" }); },
      onError: (err: any) => toast({ title: err?.message ?? "Failed to create PR", variant: "destructive" }),
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <SectionHeader icon={<ShoppingCart className="h-4 w-4" />} title="Purchase Orders">
        <button onClick={() => setShowPoModal(true)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
          <Plus className="h-3.5 w-3.5" /> Create PO
        </button>
      </SectionHeader>

      {isLoading ? (
        <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
      ) : pos.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-6">No Purchase Orders yet.</p>
      ) : (
        <div className="space-y-2">
          {pos.map(po => (
            <StylePoCard key={po.id} po={po}
              onExportPdf={() => exportSinglePoPdf(po)}
              onCreatePR={(poId, vendorName, bomItems) => {
                const singleItem = bomItems.length === 1 ? String(bomItems[0].bomRowId) : "";
                setPrForm({ bomRowId: singleItem, receivedQty: "", actualPrice: "", warehouseLocation: "" });
                setPrModal({ poId, vendorName, bomItems });
              }} />
          ))}
        </div>
      )}

      {showPoModal && (
        <StyleCreatePoModal styleOrderId={styleOrderId} bomRows={bomRows} vendors={vendors}
          onClose={() => setShowPoModal(false)} onCreate={handleCreatePO} />
      )}

      {prModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">Create Purchase Receipt</h4>
              <button onClick={() => setPrModal(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-gray-500">Vendor: <span className="font-semibold text-gray-700">{prModal.vendorName}</span></p>
            <div className="space-y-3">
              {prModal.bomItems.length > 1 && (
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Item *</label>
                  <select value={prForm.bomRowId} onChange={e => setPrForm(f => ({ ...f, bomRowId: e.target.value }))}
                    className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10">
                    <option value="">— Select item —</option>
                    {prModal.bomItems.map(item => (
                      <option key={item.bomRowId} value={String(item.bomRowId)}>
                        [{item.materialCode}] {item.materialName} · {item.quantity} {item.unitType}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {prModal.bomItems.length === 1 && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                  <p className="text-[10px] text-gray-400 font-medium mb-0.5">Item</p>
                  <p className="text-xs font-semibold text-gray-800">[{prModal.bomItems[0].materialCode}] {prModal.bomItems[0].materialName}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Ordered: {prModal.bomItems[0].quantity} {prModal.bomItems[0].unitType} @ ₹{parseFloat(prModal.bomItems[0].targetPrice).toFixed(2)}</p>
                </div>
              )}
              {prItemStats && (
                <div className={`rounded-xl px-3 py-2 text-xs flex items-center gap-3 ${prItemStats.remaining <= 0 ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
                  <div className="flex-1">
                    <span className="text-gray-500">Already received: </span>
                    <span className="font-semibold text-gray-800">{prItemStats.alreadyReceived.toFixed(2)} {prItemStats.unitType}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span className="text-gray-500">Remaining: </span>
                    <span className={`font-bold ${prItemStats.remaining <= 0 ? "text-red-600" : "text-green-700"}`}>{prItemStats.remaining.toFixed(2)} {prItemStats.unitType}</span>
                  </div>
                  {prItemStats.remaining <= 0 && <span className="text-[10px] font-semibold text-red-600">FULLY RECEIVED</span>}
                </div>
              )}
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Received Quantity *</label>
                <input type="number" min="0" step="any" value={prForm.receivedQty}
                  onChange={e => setPrForm(f => ({ ...f, receivedQty: e.target.value }))}
                  className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  placeholder="0" max={prItemStats ? prItemStats.remaining : undefined} />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Actual Price (₹) *</label>
                <input type="number" min="0" step="any" value={prForm.actualPrice}
                  onChange={e => setPrForm(f => ({ ...f, actualPrice: e.target.value }))}
                  className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Warehouse Location</label>
                <input value={prForm.warehouseLocation} onChange={e => setPrForm(f => ({ ...f, warehouseLocation: e.target.value }))}
                  className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  placeholder="e.g. Rack A-3" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleCreatePR} disabled={createPR.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors disabled:opacity-60">
                {createPR.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Create PR
              </button>
              <button onClick={() => setPrModal(null)} className="px-4 py-2.5 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PR Section ───────────────────────────────────────────────────────────────
function StylePrSection({ styleOrderId }: { styleOrderId: number }) {
  const { data: prs = [], isLoading } = useStylePRs(styleOrderId);
  const { data: pos = [] } = useStylePOs(styleOrderId);
  const { data: bomRows = [] } = useStyleBom(styleOrderId);
  const poMap = Object.fromEntries(pos.map(p => [p.id, p.poNumber]));
  const poItemsMap = Object.fromEntries(pos.map(p => [p.id, p.bomItems ?? []]));

  const [filterPoId, setFilterPoId] = useState<string>("all");
  const [filterBomRowId, setFilterBomRowId] = useState<string>("all");

  const filteredPrs = prs.filter(pr => {
    if (filterPoId !== "all" && String(pr.poId) !== filterPoId) return false;
    if (filterBomRowId !== "all") {
      if (pr.bomRowId != null) { if (String(pr.bomRowId) !== filterBomRowId) return false; }
      else {
        const poForPr = pos.find(p => p.id === pr.poId);
        const hasItem = (poForPr?.bomItems ?? []).some(item => String(item.bomRowId) === filterBomRowId);
        if (!hasItem) return false;
      }
    }
    return true;
  });
  const totalValue = filteredPrs.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0) * (parseFloat(pr.actualPrice) || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <SectionHeader icon={<FileText className="h-4 w-4" />} title="Purchase Receipts">
        {prs.length > 0 && (
          <span className="text-xs text-gray-400">
            {filteredPrs.length} receipt{filteredPrs.length !== 1 ? "s" : ""} · Total: <span className="font-semibold text-blue-700">₹{totalValue.toFixed(2)}</span>
          </span>
        )}
      </SectionHeader>
      {prs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <select value={filterPoId} onChange={e => setFilterPoId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300">
            <option value="all">All POs</option>
            {pos.map(p => <option key={p.id} value={String(p.id)}>{p.poNumber} — {p.vendorName}</option>)}
          </select>
          <select value={filterBomRowId} onChange={e => setFilterBomRowId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300">
            <option value="all">All Materials/Fabrics</option>
            {bomRows.map(r => <option key={r.id} value={String(r.id)}>[{r.materialCode}] {r.materialName}</option>)}
          </select>
          {(filterPoId !== "all" || filterBomRowId !== "all") && (
            <button onClick={() => { setFilterPoId("all"); setFilterBomRowId("all"); }}
              className="text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">Clear</button>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
      ) : filteredPrs.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-6">
          {prs.length === 0 ? "No Purchase Receipts yet. Create a PR from a PO above." : "No receipts match the selected filters."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["PR #", "PO #", "Vendor", "Date", "Rcv Qty", "Actual Price", "Total Value", "Item", ""].map(h => (
                  <th key={h} className={`text-left text-[10px] font-semibold ${h === "Total Value" ? "text-blue-500" : "text-gray-400"} px-3 py-2 whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPrs.map(pr => (
                <StylePrTableRow key={pr.id} pr={pr} poNumber={poMap[pr.poId] ?? "—"} bomItems={poItemsMap[pr.poId] ?? []} />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={6} className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400">{filteredPrs.length} receipt{filteredPrs.length !== 1 ? "s" : ""} · Grand Total</td>
                <td className="px-3 py-2 font-bold text-blue-700">₹{totalValue.toFixed(2)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Consumption Section (with Product mapping) ────────────────────────────────
function StyleConsumptionSection({ styleOrderId }: { styleOrderId: number }) {
  const { toast } = useToast();
  const { data: bomRows = [], isLoading } = useStyleBom(styleOrderId);
  const { data: pos = [] } = useStylePOs(styleOrderId);
  const { data: prs = [] } = useStylePRs(styleOrderId);
  const { data: consumptionLog = [] } = useStyleConsumptionLog(styleOrderId);
  const { data: productsRes } = useStyleOrderProducts(styleOrderId);
  const products = (productsRes?.data ?? []).filter(p => !p.isDeleted);
  const addEntry = useAddStyleConsumptionEntry();
  const deleteEntry = useDeleteStyleConsumptionEntry();

  const [filterBomRowId, setFilterBomRowId] = useState<string>("all");
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [addForm, setAddForm] = useState({ bomRowId: "", consumedQty: "", notes: "", productId: "", productName: "" });

  const displayRows = filterBomRowId === "all" ? bomRows : bomRows.filter(r => String(r.id) === filterBomRowId);
  const logForDisplay = consumptionLog.filter(e => {
    if (filterBomRowId !== "all" && String(e.bomRowId) !== filterBomRowId) return false;
    if (filterProductId !== "all" && String((e as any).styleOrderProductId ?? "") !== filterProductId) return false;
    return true;
  });

  const totals = displayRows.reduce((acc, r) => {
    const m = computeRowMetrics(r, pos, prs);
    acc.stockInclPr += m.stockNum + m.prQty;
    acc.consumedQty += m.consumedQtyNum;
    acc.consumedTotal += m.consumedTotal;
    return acc;
  }, { stockInclPr: 0, consumedQty: 0, consumedTotal: 0 });

  function openAddModal() {
    const preselect = filterBomRowId !== "all" ? filterBomRowId : (bomRows.length === 1 ? String(bomRows[0].id) : "");
    const preProduct = filterProductId !== "all" ? filterProductId : "";
    const prod = products.find(p => String(p.id) === preProduct);
    setAddForm({ bomRowId: preselect, consumedQty: "", notes: "", productId: preProduct, productName: prod?.productName ?? "" });
    setShowAddModal(true);
  }

  // Required qty = Reserved qty. Cap = required qty minus what has already been consumed.
  const selectedRow = bomRows.find(r => String(r.id) === addForm.bomRowId);
  const selectedRowMetrics = selectedRow ? computeRowMetrics(selectedRow, pos, prs) : null;
  const reservedQty = selectedRow ? parseFloat(selectedRow.requiredQty) : null;
  const availableStock = selectedRowMetrics && reservedQty !== null
    ? Math.max(0, reservedQty - selectedRowMetrics.consumedQtyNum)
    : null;

  function handleAddConsumption() {
    if (!addForm.bomRowId) { toast({ title: "Select a material/fabric", variant: "destructive" }); return; }
    if (!addForm.consumedQty || parseFloat(addForm.consumedQty) <= 0) { toast({ title: "Enter consumed quantity > 0", variant: "destructive" }); return; }
    const row = bomRows.find(r => String(r.id) === addForm.bomRowId);
    if (!row) return;
    if (availableStock !== null && parseFloat(addForm.consumedQty) > availableStock) {
      toast({ title: `Cannot consume more than the required/reserved quantity (${availableStock.toFixed(2)} ${row.unitType})`, variant: "destructive" }); return;
    }
    addEntry.mutate({
      styleOrderId, bomRowId: Number(addForm.bomRowId),
      materialCode: row.materialCode, materialName: row.materialName,
      materialType: row.materialType, unitType: row.unitType,
      consumedQty: addForm.consumedQty, notes: addForm.notes || null,
      styleOrderProductId: addForm.productId ? Number(addForm.productId) : null,
      styleOrderProductName: addForm.productName || null,
    }, {
      onSuccess: () => { setShowAddModal(false); toast({ title: "Consumption synced with inventory successfully" }); },
      onError: (err: any) => toast({ title: err?.message ?? "Failed to record consumption", variant: "destructive" }),
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <SectionHeader icon={<Package className="h-4 w-4" />} title="Consumption">
        <div className="flex items-center gap-2 flex-wrap">
          {products.length > 0 && (
            <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300">
              <option value="all">All Products</option>
              {products.map(p => <option key={p.id} value={String(p.id)}>{p.productName}</option>)}
            </select>
          )}
          {bomRows.length > 0 && (
            <select value={filterBomRowId} onChange={e => setFilterBomRowId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300">
              <option value="all">All Materials/Fabrics</option>
              {bomRows.map(r => <option key={r.id} value={String(r.id)}>[{r.materialCode}] {r.materialName}</option>)}
            </select>
          )}
          {bomRows.length > 0 && (
            <button onClick={openAddModal}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Consumption
            </button>
          )}
          {consumptionLog.length > 0 && (
            <button onClick={() => setShowLogModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              <FileText className="h-3.5 w-3.5" /> View Log ({consumptionLog.length})
            </button>
          )}
        </div>
      </SectionHeader>

      {isLoading ? (
        <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
      ) : displayRows.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-6">No BOM items found. Add items to the BOM first.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[880px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Code</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Item</th>
                <th className="text-left text-[10px] font-semibold text-blue-500 px-3 py-2 whitespace-nowrap">
                  <span className="flex items-center gap-1">Live Stock <span title="Base stock + all PR received quantities" className="cursor-help text-gray-500 hover:text-gray-500"><Info className="h-3 w-3" /></span></span>
                </th>
                <th className="text-left text-[10px] font-semibold text-violet-500 px-3 py-2 whitespace-nowrap">Req / Reserved</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Avg Price (₹)</th>
                <th className="text-left text-[10px] font-semibold text-amber-500 px-3 py-2 whitespace-nowrap">Consumed Qty</th>
                <th className="text-left text-[10px] font-semibold text-red-500 px-3 py-2 whitespace-nowrap">Consumed Total (₹)</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Last Consumed</th>
                <th className="px-3 py-2 whitespace-nowrap text-[10px] font-semibold text-gray-400">Log</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(r => {
                const m = computeRowMetrics(r, pos, prs);
                const liveStock = m.stockNum + m.prQty;
                const rowLogs = consumptionLog.filter(e => e.bomRowId === r.id);
                const lastEntry = rowLogs.length > 0 ? rowLogs.reduce((a, b) => new Date(a.consumedAt) > new Date(b.consumedAt) ? a : b) : null;
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">{r.materialCode}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-800">{r.materialName}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.materialType === "fabric" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-700"}`}>
                          {r.materialType === "fabric" ? "FAB" : "MAT"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-semibold text-blue-700">{liveStock.toFixed(2)}</span>
                      <span className="text-gray-400 ml-1 text-[10px]">{r.unitType}</span>
                      {m.prQty > 0 && <span title={`Base: ${m.stockNum} + PR received: ${m.prQty.toFixed(2)}`} className="ml-1 text-[9px] text-blue-400 cursor-help">+PR</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-semibold text-violet-700">{parseFloat(r.requiredQty).toFixed(2)}</span>
                      <span className="text-gray-400 ml-1 text-[10px]">{r.unitType}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">₹{m.weightedAvg.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-amber-700 font-medium">{m.consumedQtyNum.toFixed(2)} {r.unitType}</td>
                    <td className="px-3 py-2.5 font-semibold text-red-700">₹{m.consumedTotal.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap text-[10px]">
                      {lastEntry ? (
                        <span title={new Date(lastEntry.consumedAt).toLocaleString("en-IN")}>
                          {new Date(lastEntry.consumedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{" "}
                          {new Date(lastEntry.consumedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {rowLogs.length > 0 && (
                        <button onClick={() => { setFilterBomRowId(String(r.id)); setShowLogModal(true); }}
                          className="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                          {rowLogs.length} {rowLogs.length === 1 ? "entry" : "entries"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {displayRows.length > 1 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={2} className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400">Total</td>
                  <td className="px-3 py-2 font-bold text-blue-700">{totals.stockInclPr.toFixed(2)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 font-bold text-amber-700">{totals.consumedQty.toFixed(2)}</td>
                  <td className="px-3 py-2 font-bold text-red-700">₹{totals.consumedTotal.toFixed(2)}</td>
                  <td colSpan={2} className="px-3 py-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Add Consumption Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">Add Consumption</h4>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              {products.length > 0 && (
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Product</label>
                  <select value={addForm.productId}
                    onChange={e => {
                      const p = products.find(x => String(x.id) === e.target.value);
                      setAddForm(f => ({ ...f, productId: e.target.value, productName: p?.productName ?? "" }));
                    }}
                    className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10">
                    <option value="">— All Products —</option>
                    {products.map(p => <option key={p.id} value={String(p.id)}>{p.productName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Material / Fabric *</label>
                <select value={addForm.bomRowId} onChange={e => setAddForm(f => ({ ...f, bomRowId: e.target.value }))}
                  className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10">
                  <option value="">— Select item —</option>
                  {bomRows.map(r => (
                    <option key={r.id} value={String(r.id)}>[{r.materialCode}] {r.materialName} ({r.materialType === "fabric" ? "Fabric" : "Material"})</option>
                  ))}
                </select>
              </div>
              {selectedRow && selectedRowMetrics && (
                <div className={`rounded-xl px-3 py-2.5 text-xs space-y-1.5 ${availableStock !== null && availableStock <= 0 ? "bg-red-50 border border-red-200" : reservedQty !== null ? "bg-violet-50 border border-violet-200" : "bg-gray-50 border border-gray-200"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-500">Live stock:</span>
                    <span className="font-semibold text-gray-800">{selectedRowMetrics.stockNum.toFixed(2)}</span>
                    {selectedRowMetrics.prQty > 0 && (<>
                      <span className="text-blue-400">+</span>
                      <span className="text-blue-600 font-semibold">PR: {selectedRowMetrics.prQty.toFixed(2)}</span>
                      <span className="text-gray-400">=</span>
                      <span className="font-bold text-gray-900">{(selectedRowMetrics.stockNum + selectedRowMetrics.prQty).toFixed(2)}</span>
                    </>)}
                    <span className="text-gray-500">{selectedRow.unitType}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">REQ / RESERVED</span>
                    <span className="text-gray-500">For this order:</span>
                    <span className="font-bold text-violet-700">{reservedQty !== null ? reservedQty.toFixed(2) : "—"} {selectedRow.unitType}</span>
                    {availableStock !== null && availableStock <= 0 && <span className="text-[10px] font-semibold text-red-600">FULLY CONSUMED</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-500">Consumed:</span>
                    <span className="font-semibold text-amber-700">{selectedRowMetrics.consumedQtyNum.toFixed(2)}</span>
                    <span className="mx-1 text-gray-300">|</span>
                    <span className="text-gray-500">Remaining cap:</span>
                    <span className={`font-bold ${availableStock !== null && availableStock <= 0 ? "text-red-600" : "text-violet-700"}`}>
                      {availableStock !== null ? availableStock.toFixed(2) : "—"} {selectedRow.unitType}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Consumed Quantity *</label>
                <input type="number" min="0" step="any" value={addForm.consumedQty}
                  onChange={e => setAddForm(f => ({ ...f, consumedQty: e.target.value }))}
                  className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  placeholder="0" max={availableStock !== null ? availableStock : undefined} />
                {selectedRow && availableStock !== null && availableStock > 0 && (
                  <p className="text-[10px] mt-1 text-violet-600">
                    Remaining cap: {availableStock.toFixed(2)} {selectedRow.unitType}
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Notes</label>
                <input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full mt-0.5 text-xs text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  placeholder="Optional notes..." />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleAddConsumption} disabled={addEntry.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors disabled:opacity-60">
                {addEntry.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Record Consumption
              </button>
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2.5 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Consumption Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Consumption Log</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">{logForDisplay.length} entr{logForDisplay.length === 1 ? "y" : "ies"}</p>
              </div>
              <div className="flex items-center gap-2">
                {products.length > 0 && (
                  <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300">
                    <option value="all">All Products</option>
                    {products.map(p => <option key={p.id} value={String(p.id)}>{p.productName}</option>)}
                  </select>
                )}
                <select value={filterBomRowId} onChange={e => setFilterBomRowId(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300">
                  <option value="all">All Items</option>
                  {bomRows.map(r => <option key={r.id} value={String(r.id)}>[{r.materialCode}] {r.materialName}</option>)}
                </select>
                <button onClick={() => setShowLogModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="overflow-auto flex-1 px-4 py-3">
              {logForDisplay.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-8">No consumption entries.</p>
              ) : (
                <table className="w-full text-xs min-w-[680px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      {["Date & Time", "Product", "Code", "Item", "Qty", "Consumed By", "Notes", ""].map(h => (
                        <th key={h} className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logForDisplay.map(entry => (
                      <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                          {new Date(entry.consumedAt).toLocaleDateString("en-IN")} {new Date(entry.consumedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 text-[10px]">{(entry as any).styleOrderProductName ?? <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">{entry.materialCode}</td>
                        <td className="px-3 py-2.5 text-gray-800">
                          <div className="flex items-center gap-1">
                            {entry.materialName}
                            <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full ${entry.materialType === "fabric" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-700"}`}>
                              {entry.materialType === "fabric" ? "FAB" : "MAT"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-amber-700">{parseFloat(entry.consumedQty).toFixed(2)} {entry.unitType}</td>
                        <td className="px-3 py-2.5 text-gray-600">{entry.consumedBy}</td>
                        <td className="px-3 py-2.5 text-gray-400">{entry.notes || "—"}</td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => deleteEntry.mutate(entry.id)} disabled={deleteEntry.isPending}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td colSpan={4} className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400">Total Consumed</td>
                      <td className="px-3 py-2 font-bold text-amber-700">{logForDisplay.reduce((s, e) => s + (parseFloat(e.consumedQty) || 0), 0).toFixed(2)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <button onClick={openAddModal}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Consumption
              </button>
              <button onClick={() => setShowLogModal(false)} className="px-4 py-2 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Artisan Timesheet Section (with Product mapping) ──────────────────────────
const SHIFT_TYPES = ["regular", "night", "sunday", "overtime"] as const;
const SHIFT_LABELS: Record<string, string> = { regular: "Regular", night: "Night", sunday: "Sunday", overtime: "Overtime" };
const SHIFT_COLORS: Record<string, string> = {
  regular: "bg-green-100 text-green-700",
  night: "bg-indigo-100 text-indigo-700",
  sunday: "bg-orange-100 text-orange-700",
  overtime: "bg-red-100 text-red-700",
};

const defaultArtisanForm = { noOfArtisans: "1", startDate: "", endDate: "", shiftType: "regular", totalHours: "", hourlyRate: "", notes: "", productId: "", productName: "" };

function StyleArtisanSection({ styleOrderId }: { styleOrderId: number }) {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useStyleArtisanTimesheets(styleOrderId);
  const { data: productsRes } = useStyleOrderProducts(styleOrderId);
  const products = (productsRes?.data ?? []).filter(p => !p.isDeleted);
  const createMutation = useCreateStyleArtisanTimesheet();
  const deleteMutation = useDeleteStyleArtisanTimesheet();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultArtisanForm);
  const [filterType, setFilterType] = useState("all");
  const [filterProductId, setFilterProductId] = useState("all");

  const computedTotal = (() => {
    const n = parseFloat(form.noOfArtisans) || 0;
    const h = parseFloat(form.totalHours) || 0;
    const r = parseFloat(form.hourlyRate) || 0;
    return (n * h * r).toFixed(2);
  })();

  function handleAdd() {
    if (!form.startDate || !form.endDate || !form.totalHours || !form.hourlyRate) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    createMutation.mutate({
      styleOrderId, noOfArtisans: parseInt(form.noOfArtisans) || 1,
      startDate: form.startDate, endDate: form.endDate, shiftType: form.shiftType,
      totalHours: form.totalHours, hourlyRate: form.hourlyRate, notes: form.notes || undefined,
      styleOrderProductId: form.productId ? Number(form.productId) : null,
      styleOrderProductName: form.productName || null,
    }, {
      onSuccess: () => { setShowModal(false); setForm(defaultArtisanForm); toast({ title: "Timesheet entry added" }); },
      onError: (e: any) => toast({ title: e?.message ?? "Error", variant: "destructive" }),
    });
  }

  const filtered = rows.filter(r => {
    if (filterType !== "all" && r.shiftType !== filterType) return false;
    if (filterProductId !== "all" && String((r as any).styleOrderProductId ?? "") !== filterProductId) return false;
    return true;
  });
  const grandTotal = filtered.reduce((s, r) => s + (parseFloat(r.totalRate) || 0), 0);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <SectionHeader icon={<Clock className="h-4 w-4" />} title="Artisan Time Sheet">
        <div className="flex items-center gap-2 flex-wrap">
          {products.length > 0 && (
            <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)}
              className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
              <option value="all">All Products</option>
              {products.map(p => <option key={p.id} value={String(p.id)}>{p.productName}</option>)}
            </select>
          )}
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
            <option value="all">All Types</option>
            {SHIFT_TYPES.map(t => <option key={t} value={t}>{SHIFT_LABELS[t]}</option>)}
          </select>
          <button onClick={() => { setForm(defaultArtisanForm); setShowModal(true); }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Artisan
          </button>
        </div>
      </SectionHeader>

      {isLoading ? (
        <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[820px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Product</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Start Date</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">End Date</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Type</th>
                <th className="text-right text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap"># Artisans</th>
                <th className="text-right text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Total Hrs</th>
                <th className="text-right text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Rate/Hr (₹)</th>
                <th className="text-right text-[10px] font-semibold text-amber-500 px-3 py-2 whitespace-nowrap">Total Rate (₹)</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Added By</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyRow text={rows.length === 0 ? "No timesheet entries yet." : "No entries for selected filter."} />
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                  <td className="px-3 py-2.5 text-gray-600 text-[10px]">{(r as any).styleOrderProductName ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-800">{r.startDate}</td>
                  <td className="px-3 py-2.5 text-gray-800">{r.endDate}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${SHIFT_COLORS[r.shiftType] ?? "bg-gray-100 text-gray-600"}`}>
                      {SHIFT_LABELS[r.shiftType] ?? r.shiftType}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-800">{r.noOfArtisans}</td>
                  <td className="px-3 py-2.5 text-right text-gray-800">{parseFloat(r.totalHours).toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-800">₹{parseFloat(r.hourlyRate).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-amber-700">₹{parseFloat(r.totalRate).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-[10px]">{r.createdBy}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => deleteMutation.mutate(r.id, {
                      onSuccess: () => toast({ title: "Entry deleted" }),
                      onError: (e: any) => toast({ title: e?.message ?? "Error", variant: "destructive" }),
                    })} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={7} className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-amber-700">₹{grandTotal.toFixed(2)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Add Artisan Timesheet Entry</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {products.length > 0 && (
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Product</label>
                  <select value={form.productId}
                    onChange={e => {
                      const p = products.find(x => String(x.id) === e.target.value);
                      setForm(f => ({ ...f, productId: e.target.value, productName: p?.productName ?? "" }));
                    }}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]">
                    <option value="">— All Products —</option>
                    {products.map(p => <option key={p.id} value={String(p.id)}>{p.productName}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">No. of Artisans *</label>
                  <input type="number" min="1" value={form.noOfArtisans} onChange={e => setForm(f => ({ ...f, noOfArtisans: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Shift Type *</label>
                  <select value={form.shiftType} onChange={e => setForm(f => ({ ...f, shiftType: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]">
                    {SHIFT_TYPES.map(t => <option key={t} value={t}>{SHIFT_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Start Date *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">End Date *</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Total Hours *</label>
                  <input type="number" min="0" step="0.5" value={form.totalHours} onChange={e => setForm(f => ({ ...f, totalHours: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" placeholder="0.0" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Hourly Rate (₹) *</label>
                  <input type="number" min="0" step="any" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" placeholder="0.00" />
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
                <span className="text-gray-500">Total Rate = {form.noOfArtisans || 1} artisan(s) × {form.totalHours || 0} hrs × ₹{form.hourlyRate || 0}/hr</span>
                <span className="font-bold text-amber-700">₹{computedTotal}</span>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" placeholder="Optional" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={createMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-[#C9B45C] hover:bg-black disabled:opacity-50">
                {createMutation.isPending ? "Saving…" : "Add Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Outsource Job Section (with Product mapping) ──────────────────────────────
const defaultOutsourceForm = {
  vendorId: "", vendorName: "", vendorQuery: "",
  hsnId: "", hsnCode: "", gstPercentage: "", hsnQuery: "",
  issueDate: "", targetDate: "", deliveryDate: "", totalCost: "", notes: "",
  productId: "", productName: "",
};

function StyleOutsourceSection({ styleOrderId }: { styleOrderId: number }) {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useStyleOutsourceJobs(styleOrderId);
  const { data: productsRes } = useStyleOrderProducts(styleOrderId);
  const products = (productsRes?.data ?? []).filter(p => !p.isDeleted);
  const createMutation = useCreateStyleOutsourceJob();
  const deleteMutation = useDeleteStyleOutsourceJob();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultOutsourceForm);
  const [filterVendor, setFilterVendor] = useState("all");
  const [filterProductId, setFilterProductId] = useState("all");
  const [showVendorDrop, setShowVendorDrop] = useState(false);
  const [showHsnDrop, setShowHsnDrop] = useState(false);
  const [expandedPayRow, setExpandedPayRow] = useState<number | null>(null);
  const outsourcePaidTotals = useCostingPaymentTotals("outsource_job", { styleOrderId });

  const { data: vendorResults = [] } = useVendorSearch(form.vendorQuery);
  const { data: hsnResults = [] } = useHsnSearch(form.hsnQuery);

  function handleAdd() {
    if (!form.vendorId || !form.hsnId || !form.issueDate) {
      toast({ title: "Vendor, HSN Code and Issue Date are required", variant: "destructive" }); return;
    }
    createMutation.mutate({
      styleOrderId,
      vendorId: parseInt(form.vendorId), vendorName: form.vendorName,
      hsnId: parseInt(form.hsnId), hsnCode: form.hsnCode, gstPercentage: form.gstPercentage || "5",
      issueDate: form.issueDate, targetDate: form.targetDate || undefined, deliveryDate: form.deliveryDate || undefined,
      totalCost: form.totalCost || "0", notes: form.notes || undefined,
      styleOrderProductId: form.productId ? Number(form.productId) : null,
      styleOrderProductName: form.productName || null,
    }, {
      onSuccess: () => { setShowModal(false); setForm(defaultOutsourceForm); toast({ title: "Outsource job added" }); },
      onError: (e: any) => toast({ title: e?.message ?? "Error", variant: "destructive" }),
    });
  }

  const uniqueVendors = [...new Set(rows.map(r => r.vendorName))];
  const filtered = rows.filter(r => {
    if (filterVendor !== "all" && r.vendorName !== filterVendor) return false;
    if (filterProductId !== "all" && String((r as any).styleOrderProductId ?? "") !== filterProductId) return false;
    return true;
  });
  const grandTotal = filtered.reduce((s, r) => s + (parseFloat(r.totalCost) || 0), 0);
  const grandPaid = filtered.reduce((s, r) => s + (outsourcePaidTotals.get(r.id) ?? 0), 0);
  const grandBalance = Math.max(0, grandTotal - grandPaid);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <SectionHeader icon={<Truck className="h-4 w-4" />} title="Outsource Jobs">
        <div className="flex items-center gap-2 flex-wrap">
          {products.length > 0 && (
            <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)}
              className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
              <option value="all">All Products</option>
              {products.map(p => <option key={p.id} value={String(p.id)}>{p.productName}</option>)}
            </select>
          )}
          <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
            <option value="all">All Vendors</option>
            {uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <button onClick={() => { setForm(defaultOutsourceForm); setShowModal(true); }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Job
          </button>
        </div>
      </SectionHeader>

      {isLoading ? (
        <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[960px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Product</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Vendor</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">HSN</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">GST%</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Issue Date</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Target Date</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Delivery Date</th>
                <th className="text-right text-[10px] font-semibold text-amber-500 px-3 py-2 whitespace-nowrap">Total Cost (₹)</th>
                <th className="text-right text-[10px] font-semibold text-emerald-600 px-3 py-2 whitespace-nowrap">Paid (₹)</th>
                <th className="text-right text-[10px] font-semibold text-red-500 px-3 py-2 whitespace-nowrap">Balance (₹)</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Notes</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyRow text={rows.length === 0 ? "No outsource jobs yet." : "No jobs for selected filter."} />
              ) : filtered.map(r => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-gray-50 hover:bg-gray-50/40">
                    <td className="px-3 py-2.5 text-gray-600 text-[10px]">{(r as any).styleOrderProductName ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{r.vendorName}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">{r.hsnCode}</td>
                    <td className="px-3 py-2.5"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{r.gstPercentage}%</span></td>
                    <td className="px-3 py-2.5 text-gray-600">{r.issueDate}</td>
                    <td className="px-3 py-2.5 text-gray-400">{r.targetDate ?? "—"}</td>
                    <td className="px-3 py-2.5 text-gray-400">{r.deliveryDate ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-amber-700">₹{parseFloat(r.totalCost).toFixed(2)}</td>
                    {(() => { const cost = parseFloat(r.totalCost); const paid = outsourcePaidTotals.get(r.id) ?? 0; const balance = Math.max(0, cost - paid); return (<>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">₹{paid.toFixed(2)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${balance <= 0 ? "text-emerald-600" : "text-red-500"}`}>₹{balance.toFixed(2)}</td>
                    </>); })()}
                    <td className="px-3 py-2.5 text-gray-400 max-w-[120px] truncate" title={r.notes ?? ""}>{r.notes ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {(() => { const cost = parseFloat(r.totalCost); const paid = outsourcePaidTotals.get(r.id) ?? 0; const fullyPaid = cost > 0 && paid >= cost; return fullyPaid ? (
                          <button onClick={() => setExpandedPayRow(v => v === r.id ? null : r.id)}
                            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${expandedPayRow === r.id ? "bg-green-700 text-white border-green-700" : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"}`}>
                            <CreditCard className="h-3 w-3" /> Paid
                          </button>
                        ) : (
                          <button onClick={() => setExpandedPayRow(v => v === r.id ? null : r.id)}
                            className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors ${expandedPayRow === r.id ? "bg-gray-900 text-[#C9B45C] border-gray-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                            <CreditCard className="h-3 w-3" /> Pay
                          </button>
                        ); })()}
                        <button onClick={() => deleteMutation.mutate(r.id, {
                          onSuccess: () => toast({ title: "Job deleted" }),
                          onError: (e: any) => toast({ title: e?.message ?? "Error", variant: "destructive" }),
                        })} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedPayRow === r.id && (
                    <tr className="bg-amber-50/30 border-b border-amber-100">
                      <td colSpan={12} className="px-5 py-3">
                        <CostingPaymentsPanel
                          referenceType="outsource_job"
                          referenceId={r.id}
                          vendorId={r.vendorId}
                          vendorName={r.vendorName}
                          styleOrderId={styleOrderId}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={7} className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-amber-700">₹{grandTotal.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-700">₹{grandPaid.toFixed(2)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${grandBalance <= 0 ? "text-emerald-600" : "text-red-500"}`}>₹{grandBalance.toFixed(2)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Add Outsource Job</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {products.length > 0 && (
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Product</label>
                  <select value={form.productId}
                    onChange={e => {
                      const p = products.find(x => String(x.id) === e.target.value);
                      setForm(f => ({ ...f, productId: e.target.value, productName: p?.productName ?? "" }));
                    }}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]">
                    <option value="">— All Products —</option>
                    {products.map(p => <option key={p.id} value={String(p.id)}>{p.productName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Vendor *</label>
                <div className="relative mt-1">
                  <input type="text" value={form.vendorId ? form.vendorName : form.vendorQuery}
                    onChange={e => {
                      if (form.vendorId) setForm(f => ({ ...f, vendorId: "", vendorName: "", vendorQuery: e.target.value }));
                      else setForm(f => ({ ...f, vendorQuery: e.target.value }));
                      setShowVendorDrop(true);
                    }}
                    onFocus={() => setShowVendorDrop(true)}
                    placeholder="Search vendor by name or code..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" />
                  {form.vendorId && (
                    <button onClick={() => setForm(f => ({ ...f, vendorId: "", vendorName: "", vendorQuery: "" }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                  )}
                  {showVendorDrop && !form.vendorId && vendorResults.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                      {vendorResults.map(v => (
                        <button key={v.id} type="button"
                          onClick={() => { setForm(f => ({ ...f, vendorId: String(v.id), vendorName: v.brandName, vendorQuery: "" })); setShowVendorDrop(false); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          <span className="font-medium text-gray-800">{v.brandName}</span>
                          <span className="ml-2 text-gray-400 font-mono text-[10px]">{v.vendorCode}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">HSN Code *</label>
                <div className="relative mt-1">
                  <input type="text" value={form.hsnId ? form.hsnCode : form.hsnQuery}
                    onChange={e => {
                      if (form.hsnId) setForm(f => ({ ...f, hsnId: "", hsnCode: "", gstPercentage: "", hsnQuery: e.target.value }));
                      else setForm(f => ({ ...f, hsnQuery: e.target.value }));
                      setShowHsnDrop(true);
                    }}
                    onFocus={() => setShowHsnDrop(true)}
                    placeholder="Search HSN code or description..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" />
                  {form.hsnId && (
                    <button onClick={() => setForm(f => ({ ...f, hsnId: "", hsnCode: "", gstPercentage: "", hsnQuery: "" }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                  )}
                  {showHsnDrop && !form.hsnId && hsnResults.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                      {hsnResults.map(h => (
                        <button key={h.id} type="button"
                          onClick={() => { setForm(f => ({ ...f, hsnId: String(h.id), hsnCode: h.hsnCode, gstPercentage: h.gstPercentage, hsnQuery: "" })); setShowHsnDrop(false); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          <span className="font-mono font-medium text-gray-800">{h.hsnCode}</span>
                          <span className="ml-2 text-gray-400 text-[10px]">{h.govtDescription}</span>
                          <span className="ml-1 text-blue-500 text-[10px] font-semibold">GST {h.gstPercentage}%</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {form.hsnId && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs flex items-center gap-2">
                  <span className="text-gray-500">GST from HSN {form.hsnCode}:</span>
                  <span className="font-bold text-blue-700 text-sm">{form.gstPercentage}%</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Issue Date *</label>
                  <input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Target Date</label>
                  <input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Delivery Date</label>
                  <input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Total Cost (₹)</label>
                <input type="number" min="0" step="any" value={form.totalCost} onChange={e => setForm(f => ({ ...f, totalCost: e.target.value }))}
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" placeholder="0.00" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" placeholder="Optional" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={createMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-[#C9B45C] hover:bg-black disabled:opacity-50">
                {createMutation.isPending ? "Saving…" : "Add Job"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom Charges Section (with Product mapping) ─────────────────────────────
const defaultCustomChargeForm = {
  vendorId: "", vendorName: "", vendorQuery: "",
  hsnId: "", hsnCode: "", gstPercentage: "", hsnQuery: "",
  description: "", unitPrice: "", quantity: "1",
  productId: "", productName: "",
};

function StyleCustomChargesSection({ styleOrderId }: { styleOrderId: number }) {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useStyleCustomCharges(styleOrderId);
  const { data: productsRes } = useStyleOrderProducts(styleOrderId);
  const products = (productsRes?.data ?? []).filter(p => !p.isDeleted);
  const createMutation = useCreateStyleCustomCharge();
  const deleteMutation = useDeleteStyleCustomCharge();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultCustomChargeForm);
  const [filterVendor, setFilterVendor] = useState("all");
  const [filterProductId, setFilterProductId] = useState("all");
  const [showVendorDrop, setShowVendorDrop] = useState(false);
  const [showHsnDrop, setShowHsnDrop] = useState(false);
  const [expandedPayRow, setExpandedPayRow] = useState<number | null>(null);
  const customChargePaidTotals = useCostingPaymentTotals("custom_charge", { styleOrderId });

  const { data: vendorResults = [] } = useVendorSearch(form.vendorQuery);
  const { data: hsnResults = [] } = useHsnSearch(form.hsnQuery);
  const computedTotal = ((parseFloat(form.unitPrice) || 0) * (parseFloat(form.quantity) || 0)).toFixed(2);

  function handleAdd() {
    if (!form.vendorId || !form.hsnId || !form.description) {
      toast({ title: "Vendor, HSN Code and Description are required", variant: "destructive" }); return;
    }
    createMutation.mutate({
      styleOrderId,
      vendorId: parseInt(form.vendorId), vendorName: form.vendorName,
      hsnId: parseInt(form.hsnId), hsnCode: form.hsnCode, gstPercentage: form.gstPercentage || "5",
      description: form.description, unitPrice: form.unitPrice || "0", quantity: form.quantity || "1",
      styleOrderProductId: form.productId ? Number(form.productId) : null,
      styleOrderProductName: form.productName || null,
    }, {
      onSuccess: () => { setShowModal(false); setForm(defaultCustomChargeForm); toast({ title: "Custom charge added" }); },
      onError: (e: any) => toast({ title: e?.message ?? "Error", variant: "destructive" }),
    });
  }

  const uniqueVendors = [...new Set(rows.map(r => r.vendorName))];
  const filtered = rows.filter(r => {
    if (filterVendor !== "all" && r.vendorName !== filterVendor) return false;
    if (filterProductId !== "all" && String((r as any).styleOrderProductId ?? "") !== filterProductId) return false;
    return true;
  });
  const grandTotal = filtered.reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
  const grandPaid = filtered.reduce((s, r) => s + (customChargePaidTotals.get(r.id) ?? 0), 0);
  const grandBalance = Math.max(0, grandTotal - grandPaid);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <SectionHeader icon={<CreditCard className="h-4 w-4" />} title="Custom Charges">
        <div className="flex items-center gap-2 flex-wrap">
          {products.length > 0 && (
            <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)}
              className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
              <option value="all">All Products</option>
              {products.map(p => <option key={p.id} value={String(p.id)}>{p.productName}</option>)}
            </select>
          )}
          <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
            <option value="all">All Vendors</option>
            {uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <button onClick={() => { setForm(defaultCustomChargeForm); setShowModal(true); }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Charge
          </button>
        </div>
      </SectionHeader>

      {isLoading ? (
        <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[880px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Product</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Vendor</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">HSN</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">GST%</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2">Description</th>
                <th className="text-right text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Unit Price (₹)</th>
                <th className="text-right text-[10px] font-semibold text-gray-400 px-3 py-2 whitespace-nowrap">Qty</th>
                <th className="text-right text-[10px] font-semibold text-amber-500 px-3 py-2 whitespace-nowrap">Total (₹)</th>
                <th className="text-right text-[10px] font-semibold text-emerald-600 px-3 py-2 whitespace-nowrap">Paid (₹)</th>
                <th className="text-right text-[10px] font-semibold text-red-500 px-3 py-2 whitespace-nowrap">Balance (₹)</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyRow text={rows.length === 0 ? "No custom charges yet." : "No charges for selected filter."} />
              ) : filtered.map(r => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-gray-50 hover:bg-gray-50/40">
                  <td className="px-3 py-2.5 text-gray-600 text-[10px]">{(r as any).styleOrderProductName ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{r.vendorName}</td>
                  <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">{r.hsnCode}</td>
                  <td className="px-3 py-2.5"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{r.gstPercentage}%</span></td>
                  <td className="px-3 py-2.5 text-gray-800">{r.description}</td>
                  <td className="px-3 py-2.5 text-right text-gray-800">₹{parseFloat(r.unitPrice).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-800">{parseFloat(r.quantity).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-amber-700">₹{parseFloat(r.totalAmount).toFixed(2)}</td>
                  {(() => { const amt = parseFloat(r.totalAmount); const paid = customChargePaidTotals.get(r.id) ?? 0; const balance = Math.max(0, amt - paid); return (<>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">₹{paid.toFixed(2)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${balance <= 0 ? "text-emerald-600" : "text-red-500"}`}>₹{balance.toFixed(2)}</td>
                  </>); })()}
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {(() => { const amt = parseFloat(r.totalAmount); const paid = customChargePaidTotals.get(r.id) ?? 0; const fullyPaid = amt > 0 && paid >= amt; return fullyPaid ? (
                        <button onClick={() => setExpandedPayRow(v => v === r.id ? null : r.id)}
                          className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${expandedPayRow === r.id ? "bg-green-700 text-white border-green-700" : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"}`}>
                          <CreditCard className="h-3 w-3" /> Paid
                        </button>
                      ) : (
                        <button onClick={() => setExpandedPayRow(v => v === r.id ? null : r.id)}
                          className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors ${expandedPayRow === r.id ? "bg-gray-900 text-[#C9B45C] border-gray-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                          <CreditCard className="h-3 w-3" /> Pay
                        </button>
                      ); })()}
                      <button onClick={() => deleteMutation.mutate(r.id, {
                        onSuccess: () => toast({ title: "Charge deleted" }),
                        onError: (e: any) => toast({ title: e?.message ?? "Error", variant: "destructive" }),
                      })} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  </tr>
                  {expandedPayRow === r.id && (
                    <tr className="bg-amber-50/30 border-b border-amber-100">
                      <td colSpan={11} className="px-5 py-3">
                        <CostingPaymentsPanel
                          referenceType="custom_charge"
                          referenceId={r.id}
                          vendorId={r.vendorId}
                          vendorName={r.vendorName}
                          styleOrderId={styleOrderId}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={7} className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-amber-700">₹{grandTotal.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-700">₹{grandPaid.toFixed(2)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${grandBalance <= 0 ? "text-emerald-600" : "text-red-500"}`}>₹{grandBalance.toFixed(2)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Add Custom Charge</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {products.length > 0 && (
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Product</label>
                  <select value={form.productId}
                    onChange={e => {
                      const p = products.find(x => String(x.id) === e.target.value);
                      setForm(f => ({ ...f, productId: e.target.value, productName: p?.productName ?? "" }));
                    }}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]">
                    <option value="">— All Products —</option>
                    {products.map(p => <option key={p.id} value={String(p.id)}>{p.productName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Vendor *</label>
                <div className="relative mt-1">
                  <input type="text" value={form.vendorId ? form.vendorName : form.vendorQuery}
                    onChange={e => {
                      if (form.vendorId) setForm(f => ({ ...f, vendorId: "", vendorName: "", vendorQuery: e.target.value }));
                      else setForm(f => ({ ...f, vendorQuery: e.target.value }));
                      setShowVendorDrop(true);
                    }}
                    onFocus={() => setShowVendorDrop(true)}
                    placeholder="Search vendor by name or code..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" />
                  {form.vendorId && (
                    <button onClick={() => setForm(f => ({ ...f, vendorId: "", vendorName: "", vendorQuery: "" }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                  )}
                  {showVendorDrop && !form.vendorId && vendorResults.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                      {vendorResults.map(v => (
                        <button key={v.id} type="button"
                          onClick={() => { setForm(f => ({ ...f, vendorId: String(v.id), vendorName: v.brandName, vendorQuery: "" })); setShowVendorDrop(false); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          <span className="font-medium text-gray-800">{v.brandName}</span>
                          <span className="ml-2 text-gray-400 font-mono text-[10px]">{v.vendorCode}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">HSN Code *</label>
                <div className="relative mt-1">
                  <input type="text" value={form.hsnId ? form.hsnCode : form.hsnQuery}
                    onChange={e => {
                      if (form.hsnId) setForm(f => ({ ...f, hsnId: "", hsnCode: "", gstPercentage: "", hsnQuery: e.target.value }));
                      else setForm(f => ({ ...f, hsnQuery: e.target.value }));
                      setShowHsnDrop(true);
                    }}
                    onFocus={() => setShowHsnDrop(true)}
                    placeholder="Search HSN code or description..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" />
                  {form.hsnId && (
                    <button onClick={() => setForm(f => ({ ...f, hsnId: "", hsnCode: "", gstPercentage: "", hsnQuery: "" }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                  )}
                  {showHsnDrop && !form.hsnId && hsnResults.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                      {hsnResults.map(h => (
                        <button key={h.id} type="button"
                          onClick={() => { setForm(f => ({ ...f, hsnId: String(h.id), hsnCode: h.hsnCode, gstPercentage: h.gstPercentage, hsnQuery: "" })); setShowHsnDrop(false); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          <span className="font-mono font-medium text-gray-800">{h.hsnCode}</span>
                          <span className="ml-2 text-gray-400 text-[10px]">{h.govtDescription}</span>
                          <span className="ml-1 text-blue-500 text-[10px] font-semibold">GST {h.gstPercentage}%</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {form.hsnId && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs flex items-center gap-2">
                  <span className="text-gray-500">GST from HSN {form.hsnCode}:</span>
                  <span className="font-bold text-blue-700 text-sm">{form.gstPercentage}%</span>
                </div>
              )}
              <div>
                <label className="text-[10px] text-gray-500 font-medium">Description *</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]"
                  placeholder="e.g. Embroidery work, Thread charges..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Unit Price (₹)</label>
                  <input type="number" min="0" step="any" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">Quantity</label>
                  <input type="number" min="0" step="any" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9B45C]" placeholder="1" />
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
                <span className="text-gray-500">Total Amount = {form.unitPrice || 0} × {form.quantity || 0}</span>
                <span className="font-bold text-amber-700">₹{computedTotal}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={createMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-[#C9B45C] hover:bg-black disabled:opacity-50">
                {createMutation.isPending ? "Saving…" : "Add Charge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Style Costing Tab ────────────────────────────────────────────────────
export default function StyleCostingTab({
  styleOrderId, orderCode, styleName, clientName,
}: {
  styleOrderId: number;
  orderCode?: string;
  styleName?: string;
  clientName?: string;
}) {
  return (
    <div className="space-y-5">
      <StyleBomSection styleOrderId={styleOrderId} orderCode={orderCode} styleName={styleName} clientName={clientName} />
      <StylePoSection styleOrderId={styleOrderId} orderCode={orderCode} styleName={styleName} clientName={clientName} />
      <StylePrSection styleOrderId={styleOrderId} />
      <StyleConsumptionSection styleOrderId={styleOrderId} />
      <StyleArtisanSection styleOrderId={styleOrderId} />
      <StyleOutsourceSection styleOrderId={styleOrderId} />
      <StyleCustomChargesSection styleOrderId={styleOrderId} />
    </div>
  );
}
