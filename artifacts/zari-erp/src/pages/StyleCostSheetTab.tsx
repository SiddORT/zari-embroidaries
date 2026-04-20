import { useRef, useState, useEffect } from "react";
import { Printer, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useStyleBom, useStylePOs, useStylePRs,
  useStyleConsumptionLog, useStyleArtisanTimesheets,
  useStyleOutsourceJobs, useStyleCustomCharges,
  type BomRecord, type PurchaseOrderRecord, type PurchaseReceiptRecord,
} from "@/hooks/useCosting";
import { useStyleOrderProducts } from "@/hooks/useStyleOrderProducts";

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  const liveStock = stockNum + prQty;
  return { poTargetPrice, poQty, poTargetTotal, prQty, prTotal, weightedAvg, consumedQtyNum, consumedTotal, stockNum, liveStock };
}

function fmt(n: number, dec = 2) { return n.toFixed(dec); }
function rupee(n: number) { return `₹${n.toFixed(2)}`; }

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 print:mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-px flex-1 bg-[#C9B45C]/30" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#C9B45C] px-2">{title}</h3>
        <div className="h-px flex-1 bg-[#C9B45C]/30" />
      </div>
      {children}
    </div>
  );
}

function SheetTable({ headers, rows, footer }: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  footer?: (string | React.ReactNode)[];
}) {
  return (
    <table className="w-full text-[11px] border-collapse mb-2">
      <thead>
        <tr className="bg-gray-900 text-[#C9B45C]">
          {headers.map((h, i) => (
            <th key={i} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={headers.length} className="px-2 py-3 text-center text-gray-400 italic text-[10px]">No entries</td></tr>
        ) : rows.map((row, ri) => (
          <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
            {row.map((cell, ci) => (
              <td key={ci} className="px-2 py-1.5 border-b border-gray-100 text-gray-800">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {footer && (
        <tfoot>
          <tr className="bg-gray-900/5 border-t-2 border-gray-900/20 font-bold">
            {footer.map((cell, i) => (
              <td key={i} className="px-2 py-1.5 text-gray-900">{cell}</td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

// ─── Style Cost Sheet Tab ──────────────────────────────────────────────────────
export default function StyleCostSheetTab({
  styleOrderId, orderCode, styleName, clientName,
}: {
  styleOrderId: number;
  orderCode?: string;
  styleName?: string;
  clientName?: string;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [includeGst, setIncludeGst] = useState(true);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const { data: productsRes } = useStyleOrderProducts(styleOrderId);
  const products = (productsRes?.data ?? []).filter(p => !p.isDeleted);

  const { data: bomRows = [], isLoading: loadingBom } = useStyleBom(styleOrderId);
  const { data: pos = [], isLoading: loadingPos } = useStylePOs(styleOrderId);
  const { data: prs = [], isLoading: loadingPrs } = useStylePRs(styleOrderId);
  const { data: consumptionLog = [] } = useStyleConsumptionLog(styleOrderId);
  const { data: artisanTimesheets = [] } = useStyleArtisanTimesheets(styleOrderId);
  const { data: outsourceJobs = [] } = useStyleOutsourceJobs(styleOrderId);
  const { data: customCharges = [] } = useStyleCustomCharges(styleOrderId);

  const isLoading = loadingBom || loadingPos || loadingPrs;

  // ── HSN/GST master data ──────────────────────────────────────────────────────
  type MatMasterRow = { materialCode: string; hsnCode: string; gstPercent: string };
  type FabMasterRow = { fabricCode: string; hsnCode: string; gstPercent: string };
  const [materialsMaster, setMaterialsMaster] = useState<MatMasterRow[]>([]);
  const [fabricsMaster, setFabricsMaster] = useState<FabMasterRow[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("zarierp_token");
    const hdrs: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch("/api/materials/all", { headers: hdrs }).then(r => r.json()).then((d: MatMasterRow[] | { data: MatMasterRow[] }) => {
      setMaterialsMaster(Array.isArray(d) ? d : (d as { data: MatMasterRow[] }).data ?? []);
    }).catch(() => {});
    fetch("/api/fabrics/all", { headers: hdrs }).then(r => r.json()).then((d: FabMasterRow[] | { data: FabMasterRow[] }) => {
      setFabricsMaster(Array.isArray(d) ? d : (d as { data: FabMasterRow[] }).data ?? []);
    }).catch(() => {});
  }, []);

  // ── Artwork costs ─────────────────────────────────────────────────────────
  type ArtworkRow = {
    id: number; artworkCode: string; artworkName: string;
    toileMakingCost: string | null; toileVendorName: string | null;
    toilePaymentAmount: string | null; toilePaymentStatus: string | null;
    patternType: string | null; patternMakingCost: string | null;
    patternVendorName: string | null;
    patternPaymentAmount: string | null; patternPaymentStatus: string | null;
    styleOrderProductId: number | null; styleOrderProductName: string | null;
  };
  const [artworks, setArtworks] = useState<ArtworkRow[]>([]);
  useEffect(() => {
    const token = localStorage.getItem("zarierp_token");
    const hdrs: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/style-order-artworks?styleOrderId=${styleOrderId}`, { headers: hdrs })
      .then(r => r.json()).then((d: { data?: ArtworkRow[] }) => setArtworks(d.data ?? []))
      .catch(() => {});
  }, [styleOrderId]);

  function getBomHsnGst(r: BomRecord): { hsnCode: string; gstPct: number } {
    const master = r.materialType === "fabric"
      ? fabricsMaster.find(f => f.fabricCode === r.materialCode)
      : materialsMaster.find(m => m.materialCode === r.materialCode);
    const hsnCode = master?.hsnCode ?? "";
    const gstPct = master ? (parseFloat(master.gstPercent) || 0) : 0;
    return { hsnCode, gstPct };
  }

  async function handleRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["style-bom", styleOrderId] });
    await qc.invalidateQueries({ queryKey: ["style-pos", styleOrderId] });
    await qc.invalidateQueries({ queryKey: ["style-prs", styleOrderId] });
    await qc.invalidateQueries({ queryKey: ["style-consumption-log", styleOrderId] });
    await qc.invalidateQueries({ queryKey: ["style-artisan-timesheets", styleOrderId] });
    await qc.invalidateQueries({ queryKey: ["style-outsource-jobs", styleOrderId] });
    await qc.invalidateQueries({ queryKey: ["style-custom-charges", styleOrderId] });
    setRefreshing(false);
  }

  const selectedProduct = products.find(p => String(p.id) === selectedProductId);
  const isFiltered = selectedProductId !== "all";

  // ── Filtered data based on product selection ─────────────────────────────────
  // For artisan / outsource / custom charges — filter by product ID
  const filteredArtisan = isFiltered
    ? artisanTimesheets.filter(r => String((r as any).styleOrderProductId ?? "") === selectedProductId)
    : artisanTimesheets;
  const filteredOutsource = isFiltered
    ? outsourceJobs.filter(r => String((r as any).styleOrderProductId ?? "") === selectedProductId)
    : outsourceJobs;
  const filteredCustom = isFiltered
    ? customCharges.filter(r => String((r as any).styleOrderProductId ?? "") === selectedProductId)
    : customCharges;

  const filteredArtworks = isFiltered
    ? artworks.filter(a => String(a.styleOrderProductId ?? "") === selectedProductId)
    : artworks;

  // For consumption: filter log entries by product, then recalculate consumed qty per BOM row
  const filteredConsumptionLog = isFiltered
    ? consumptionLog.filter(e => String((e as any).styleOrderProductId ?? "") === selectedProductId)
    : consumptionLog;

  // ── BOM metrics (consumption amounts need product-aware calculation) ──────────
  const bomWithMetrics = bomRows.map(r => {
    const m = computeRowMetrics(r, pos, prs);
    if (isFiltered) {
      // Recalculate consumed qty from the filtered log for this product
      const productEntries = filteredConsumptionLog.filter(e => e.bomRowId === r.id);
      const productConsumedQty = productEntries.reduce((s, e) => s + (parseFloat(e.consumedQty) || 0), 0);
      const productConsumedTotal = productConsumedQty * m.weightedAvg;
      return { r, m: { ...m, consumedQtyNum: productConsumedQty, consumedTotal: productConsumedTotal } };
    }
    return { r, m };
  });

  // ── Totals ───────────────────────────────────────────────────────────────────
  const bomConsumedTotal = bomWithMetrics.reduce((s, { m }) => s + m.consumedTotal, 0);
  const bomGstTotal = bomWithMetrics.reduce((s, { r, m }) => {
    const { gstPct } = getBomHsnGst(r);
    return s + m.consumedTotal * (gstPct / 100);
  }, 0);
  const artisanTotal = filteredArtisan.reduce((s, r) => s + (parseFloat(r.totalRate) || 0), 0);

  const outsourceBaseTotal = filteredOutsource.reduce((s, r) => s + (parseFloat(r.totalCost) || 0), 0);
  const outsourceGstTotal  = filteredOutsource.reduce((s, r) => {
    const base = parseFloat(r.totalCost) || 0;
    const gstPct = parseFloat(r.gstPercentage) || 0;
    return s + base * gstPct / 100;
  }, 0);
  const outsourceTotal = outsourceBaseTotal + (includeGst ? outsourceGstTotal : 0);

  const customBaseTotal = filteredCustom.reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
  const customGstTotal  = filteredCustom.reduce((s, r) => {
    const base = parseFloat(r.totalAmount) || 0;
    const gstPct = parseFloat(r.gstPercentage) || 0;
    return s + base * gstPct / 100;
  }, 0);
  const customTotal = customBaseTotal + (includeGst ? customGstTotal : 0);

  const artworkToileTotal = filteredArtworks.reduce((s, a) => s + (parseFloat(a.toileMakingCost ?? "") || 0), 0);
  const artworkPatternTotal = filteredArtworks
    .filter(a => a.patternType === "Outhouse")
    .reduce((s, a) => s + (parseFloat(a.patternPaymentAmount ?? "") || 0), 0);
  const artworkTotal = artworkToileTotal + artworkPatternTotal;

  const grandTotal = bomConsumedTotal + (includeGst ? bomGstTotal : 0) + artisanTotal + outsourceTotal + customTotal + artworkTotal;

  const SHIFT_LABELS: Record<string, string> = { regular: "Regular", night: "Night", sunday: "Sunday", overtime: "Overtime" };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #style-cost-sheet-print, #style-cost-sheet-print * { visibility: visible; }
          #style-cost-sheet-print { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Cost Sheet</h2>
          <p className="text-xs text-gray-400">Consolidated cost summary for this style order</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Product filter */}
          {products.length > 0 && (
            <div className="relative">
              <div className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-xl bg-white px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors min-w-[180px] justify-between"
                onClick={() => {}}>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="appearance-none bg-transparent text-gray-700 font-medium focus:outline-none cursor-pointer w-full pr-4">
                  <option value="all">All Products</option>
                  {products.map(p => (
                    <option key={p.id} value={String(p.id)}>{p.productName}</option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0 pointer-events-none" />
              </div>
            </div>
          )}
          <button onClick={() => { void handleRefresh(); }} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors">
            <Printer className="h-3.5 w-3.5" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Active filter banner */}
      {isFiltered && selectedProduct && (
        <div className="no-print mb-4 flex items-center gap-2 bg-[#C9B45C]/10 border border-[#C9B45C]/30 rounded-xl px-4 py-2.5">
          <span className="text-xs font-semibold text-[#8a7a30]">Filtering by product:</span>
          <span className="text-xs font-bold text-gray-900">{selectedProduct.productName}</span>
          <button onClick={() => setSelectedProductId("all")}
            className="ml-auto text-[10px] px-2.5 py-1 rounded-lg border border-[#C9B45C]/40 text-[#8a7a30] hover:bg-[#C9B45C]/20 transition-colors font-medium">
            Show All Products
          </button>
        </div>
      )}

      {/* Printable cost sheet */}
      <div id="style-cost-sheet-print" ref={printRef}
        className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 print:p-0 print:border-0 print:shadow-none">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-black tracking-wider text-gray-900">ZARI</span>
              <span className="text-xs font-light tracking-[0.3em] text-gray-400">EMBROIDERIES</span>
            </div>
            <p className="text-[10px] text-gray-400">Enterprise Resource Planning System</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900 tracking-tight">COST SHEET</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
            {isFiltered && selectedProduct && (
              <p className="text-[10px] font-semibold text-[#8a7a30] mt-0.5">Product: {selectedProduct.productName}</p>
            )}
          </div>
        </div>

        {/* ── Order Info ─────────────────────────────────────────────────── */}
        <div className={`grid gap-4 mb-6 bg-gray-50/60 rounded-xl p-4 border border-gray-100 ${isFiltered ? "grid-cols-4" : "grid-cols-3"}`}>
          <div>
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Order Code</p>
            <p className="text-sm font-bold text-gray-900">{orderCode ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Style Name</p>
            <p className="text-sm font-semibold text-gray-800">{styleName ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Client</p>
            <p className="text-sm font-semibold text-gray-800">{clientName ?? "—"}</p>
          </div>
          {isFiltered && selectedProduct && (
            <div>
              <p className="text-[10px] text-gray-400 font-medium mb-0.5">Product Filter</p>
              <p className="text-sm font-semibold text-[#8a7a30]">{selectedProduct.productName}</p>
            </div>
          )}
        </div>

        {/* ── 1. Material Consumption ─────────────────────────────────────── */}
        <div className="no-print flex items-center justify-end mb-1.5">
          <button
            onClick={() => setIncludeGst(v => !v)}
            className={`flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
              includeGst
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
            }`}>
            <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${includeGst ? "bg-emerald-500" : "bg-gray-300"}`}>
              <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${includeGst ? "translate-x-3" : "translate-x-0"}`} />
            </span>
            {includeGst ? "HSN / GST Applied" : "HSN / GST Excluded"}
          </button>
        </div>
        <SheetSection title="Material Consumption">
          <SheetTable
            headers={[
              ...((!isFiltered && products.length > 0) ? ["Product"] : []),
              "Code", "Material / Fabric", "Type",
              "Consumed Qty", "Avg Price ₹", "HSN", "GST%", "Final Rate ₹", includeGst ? "Total (incl. GST) ₹" : "Total ₹", "Consumed By",
            ]}
            rows={bomWithMetrics.filter(({ m }) => m.consumedQtyNum > 0).map(({ r, m }) => {
              const { hsnCode, gstPct } = getBomHsnGst(r);
              const effectiveGst = includeGst ? gstPct : 0;
              const finalRate = m.weightedAvg * (1 + effectiveGst / 100);
              const totalWithGst = m.consumedTotal * (1 + effectiveGst / 100);
              const entries = filteredConsumptionLog.filter(e => e.bomRowId === r.id);
              const productNames = isFiltered
                ? (entries[0] ? ((entries[0] as any).styleOrderProductName ?? "—") : "—")
                : [...new Set(entries.map(e => (e as any).styleOrderProductName).filter(Boolean))].join(", ") || "—";
              const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
              const row: (string | React.ReactNode)[] = [
                r.materialCode,
                r.materialName,
                r.materialType === "fabric" ? "Fabric" : "Material",
                `${fmt(m.consumedQtyNum)} ${r.unitType}`,
                rupee(m.weightedAvg),
                includeGst ? (hsnCode || "—") : "—",
                includeGst && gstPct > 0 ? `${gstPct}%` : "—",
                rupee(finalRate),
                rupee(totalWithGst),
                lastEntry?.consumedBy ?? "—",
              ];
              if (!isFiltered && products.length > 0) row.unshift(productNames);
              return row;
            })}
            footer={bomWithMetrics.filter(({ m }) => m.consumedQtyNum > 0).length > 0 ? [
              ...(!isFiltered && products.length > 0 ? [""] : []),
              "", "", "Total", "", "", "", "", "",
              rupee(bomConsumedTotal + (includeGst ? bomGstTotal : 0)),
              "",
            ] : undefined}
          />
        </SheetSection>

        {/* ── 2. Artisan Time Sheet ───────────────────────────────────────── */}
        <SheetSection title="Artisan Time Sheet">
          <SheetTable
            headers={[
              ...((!isFiltered && products.length > 0) ? ["Product"] : []),
              "Start Date", "End Date", "Shift Type", "# Artisans", "Total Hours", "Rate / Hr ₹", "Total Rate ₹",
            ]}
            rows={filteredArtisan.map(r => {
              const row: (string | React.ReactNode)[] = [
                r.startDate,
                r.endDate,
                SHIFT_LABELS[r.shiftType] ?? r.shiftType,
                String(r.noOfArtisans),
                parseFloat(r.totalHours).toFixed(1),
                rupee(parseFloat(r.hourlyRate)),
                rupee(parseFloat(r.totalRate)),
              ];
              if (!isFiltered && products.length > 0) row.unshift((r as any).styleOrderProductName ?? "—");
              return row;
            })}
            footer={filteredArtisan.length > 0 ? [
              ...(!isFiltered && products.length > 0 ? [""] : []),
              "", "", "", "", "", "Total",
              rupee(artisanTotal),
            ] : undefined}
          />
        </SheetSection>

        {/* ── 3. Outsource Jobs ───────────────────────────────────────────── */}
        <SheetSection title="Outsource Jobs">
          <SheetTable
            headers={[
              ...((!isFiltered && products.length > 0) ? ["Product"] : []),
              "Vendor", "HSN", "GST%", "Issue Date", "Target Date", "Delivery Date",
              includeGst ? "Total (incl. GST) ₹" : "Total Cost ₹",
            ]}
            rows={filteredOutsource.map(r => {
              const base = parseFloat(r.totalCost) || 0;
              const gstPct = parseFloat(r.gstPercentage) || 0;
              const totalWithGst = base * (1 + (includeGst ? gstPct / 100 : 0));
              const row: (string | React.ReactNode)[] = [
                r.vendorName,
                includeGst ? (r.hsnCode || "—") : "—",
                includeGst && gstPct > 0 ? `${gstPct}%` : "—",
                r.issueDate,
                r.targetDate ?? "—",
                r.deliveryDate ?? "—",
                rupee(totalWithGst),
              ];
              if (!isFiltered && products.length > 0) row.unshift((r as any).styleOrderProductName ?? "—");
              return row;
            })}
            footer={filteredOutsource.length > 0 ? [
              ...(!isFiltered && products.length > 0 ? [""] : []),
              "", "", "", "", "", "Total",
              rupee(outsourceTotal),
            ] : undefined}
          />
        </SheetSection>

        {/* ── 4. Custom Charges ───────────────────────────────────────────── */}
        <SheetSection title="Custom Charges">
          <SheetTable
            headers={[
              ...((!isFiltered && products.length > 0) ? ["Product"] : []),
              "Vendor", "HSN", "GST%", "Description", "Unit Price ₹", "Qty",
              includeGst ? "Total (incl. GST) ₹" : "Total ₹",
            ]}
            rows={filteredCustom.map(r => {
              const base = parseFloat(r.totalAmount) || 0;
              const gstPct = parseFloat(r.gstPercentage) || 0;
              const totalWithGst = base * (1 + (includeGst ? gstPct / 100 : 0));
              const row: (string | React.ReactNode)[] = [
                r.vendorName,
                includeGst ? (r.hsnCode || "—") : "—",
                includeGst && gstPct > 0 ? `${gstPct}%` : "—",
                r.description,
                rupee(parseFloat(r.unitPrice)),
                parseFloat(r.quantity).toFixed(2),
                rupee(totalWithGst),
              ];
              if (!isFiltered && products.length > 0) row.unshift((r as any).styleOrderProductName ?? "—");
              return row;
            })}
            footer={filteredCustom.length > 0 ? [
              ...(!isFiltered && products.length > 0 ? [""] : []),
              "", "", "", "", "", "Total",
              rupee(customTotal),
            ] : undefined}
          />
        </SheetSection>

        {/* ── 5. Artwork Costs ─────────────────────────────────────────────── */}
        {filteredArtworks.length > 0 && (
          <SheetSection title="Artwork Costs (Toile & Pattern Outhouse)">
            <SheetTable
              headers={[
                ...((!isFiltered && products.length > 0) ? ["Product"] : []),
                "Artwork Code", "Artwork Name", "Type", "Vendor", "Amount ₹", "Status",
              ]}
              rows={filteredArtworks.flatMap(a => {
                const rows: (string | React.ReactNode)[][] = [];
                if (a.toileMakingCost && parseFloat(a.toileMakingCost) > 0) {
                  const row: (string | React.ReactNode)[] = [
                    a.artworkCode, a.artworkName, "Toile",
                    a.toileVendorName || "—", rupee(parseFloat(a.toileMakingCost)),
                    a.toilePaymentStatus || "—",
                  ];
                  if (!isFiltered && products.length > 0) row.unshift(a.styleOrderProductName ?? "—");
                  rows.push(row);
                }
                if (a.patternType === "Outhouse" && a.patternPaymentAmount && parseFloat(a.patternPaymentAmount) > 0) {
                  const row: (string | React.ReactNode)[] = [
                    a.artworkCode, a.artworkName, "Pattern (Outhouse)",
                    a.patternVendorName || "—", rupee(parseFloat(a.patternPaymentAmount)),
                    a.patternPaymentStatus || "—",
                  ];
                  if (!isFiltered && products.length > 0) row.unshift(a.styleOrderProductName ?? "—");
                  rows.push(row);
                }
                return rows;
              })}
              footer={artworkTotal > 0 ? [
                ...(!isFiltered && products.length > 0 ? [""] : []),
                "", "", "", "Total", rupee(artworkTotal), "",
              ] : undefined}
            />
          </SheetSection>
        )}

        {/* ── Grand Total ─────────────────────────────────────────────────── */}
        <div className="mt-6 border-t-2 border-gray-900 pt-4">
          <div className="flex justify-end">
            <div className="w-80">
              <div className="space-y-1.5">
                {[
                  { label: includeGst ? "Material Consumed (excl. GST)" : "Material Consumed", value: bomConsumedTotal },
                  ...(includeGst && bomGstTotal > 0 ? [{ label: "Material GST", value: bomGstTotal }] : []),
                  { label: "Artisan Labour", value: artisanTotal },
                  { label: includeGst ? "Outsource Jobs (excl. GST)" : "Outsource Jobs", value: outsourceBaseTotal },
                  ...(includeGst && outsourceGstTotal > 0 ? [{ label: "Outsource GST", value: outsourceGstTotal }] : []),
                  { label: includeGst ? "Custom Charges (excl. GST)" : "Custom Charges", value: customBaseTotal },
                  ...(includeGst && customGstTotal > 0 ? [{ label: "Custom Charges GST", value: customGstTotal }] : []),
                  ...(artworkToileTotal > 0 ? [{ label: "Toile Cost", value: artworkToileTotal }] : []),
                  ...(artworkPatternTotal > 0 ? [{ label: "Pattern (Outhouse)", value: artworkPatternTotal }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs text-gray-600 px-3 py-0.5">
                    <span>{label}</span>
                    <span className="font-medium text-gray-800">{rupee(value)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-gray-900 mt-2">
                  <div>
                    <span className="text-xs font-bold text-white tracking-wide">GRAND TOTAL</span>
                    {isFiltered && selectedProduct && (
                      <p className="text-[9px] text-[#C9B45C]/70 mt-0.5">{selectedProduct.productName}</p>
                    )}
                  </div>
                  <span className="text-base font-black text-[#C9B45C]">{rupee(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Per-product breakdown (only when All Products selected and products exist) */}
        {!isFiltered && products.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 text-center">Cost Breakdown by Product</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.map(prod => {
                const prodId = String(prod.id);
                const prodConsumption = consumptionLog.filter(e => String((e as any).styleOrderProductId ?? "") === prodId);
                const prodConsumedTotal = bomRows.reduce((s, r) => {
                  const m = computeRowMetrics(r, pos, prs);
                  const qty = prodConsumption.filter(e => e.bomRowId === r.id).reduce((a, e) => a + (parseFloat(e.consumedQty) || 0), 0);
                  return s + qty * m.weightedAvg;
                }, 0);
                const prodArtisan = artisanTimesheets.filter(r => String((r as any).styleOrderProductId ?? "") === prodId).reduce((s, r) => s + (parseFloat(r.totalRate) || 0), 0);
                const prodOutsourceBase = outsourceJobs.filter(r => String((r as any).styleOrderProductId ?? "") === prodId).reduce((s, r) => s + (parseFloat(r.totalCost) || 0), 0);
                const prodOutsourceGst  = outsourceJobs.filter(r => String((r as any).styleOrderProductId ?? "") === prodId).reduce((s, r) => s + (parseFloat(r.totalCost) || 0) * (parseFloat(r.gstPercentage) || 0) / 100, 0);
                const prodOutsource = prodOutsourceBase + (includeGst ? prodOutsourceGst : 0);
                const prodCustomBase = customCharges.filter(r => String((r as any).styleOrderProductId ?? "") === prodId).reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
                const prodCustomGst  = customCharges.filter(r => String((r as any).styleOrderProductId ?? "") === prodId).reduce((s, r) => s + (parseFloat(r.totalAmount) || 0) * (parseFloat(r.gstPercentage) || 0) / 100, 0);
                const prodCustom = prodCustomBase + (includeGst ? prodCustomGst : 0);
                const prodTotal = prodConsumedTotal + prodArtisan + prodOutsource + prodCustom;
                return (
                  <div key={prod.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-gray-900 mb-2 truncate">{prod.productName}</p>
                    <div className="space-y-1">
                      {[
                        { label: "Materials", value: prodConsumedTotal },
                        { label: "Labour", value: prodArtisan },
                        { label: "Outsource", value: prodOutsource },
                        { label: "Custom", value: prodCustom },
                      ].map(({ label, value }) => value > 0 && (
                        <div key={label} className="flex justify-between text-[10px] text-gray-500">
                          <span>{label}</span>
                          <span className="font-medium text-gray-700">{rupee(value)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-[11px] font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                        <span>Total</span>
                        <span className="text-[#8a7a30]">{rupee(prodTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Unassigned entries */}
              {(() => {
                const unassignedConsumption = consumptionLog.filter(e => !(e as any).styleOrderProductId);
                const unassignedConsumedTotal = bomRows.reduce((s, r) => {
                  const m = computeRowMetrics(r, pos, prs);
                  const qty = unassignedConsumption.filter(e => e.bomRowId === r.id).reduce((a, e) => a + (parseFloat(e.consumedQty) || 0), 0);
                  return s + qty * m.weightedAvg;
                }, 0);
                const unassignedArtisan = artisanTimesheets.filter(r => !(r as any).styleOrderProductId).reduce((s, r) => s + (parseFloat(r.totalRate) || 0), 0);
                const unassignedOutsourceBase = outsourceJobs.filter(r => !(r as any).styleOrderProductId).reduce((s, r) => s + (parseFloat(r.totalCost) || 0), 0);
                const unassignedOutsource = unassignedOutsourceBase + (includeGst ? outsourceJobs.filter(r => !(r as any).styleOrderProductId).reduce((s, r) => s + (parseFloat(r.totalCost) || 0) * (parseFloat(r.gstPercentage) || 0) / 100, 0) : 0);
                const unassignedCustomBase = customCharges.filter(r => !(r as any).styleOrderProductId).reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
                const unassignedCustom = unassignedCustomBase + (includeGst ? customCharges.filter(r => !(r as any).styleOrderProductId).reduce((s, r) => s + (parseFloat(r.totalAmount) || 0) * (parseFloat(r.gstPercentage) || 0) / 100, 0) : 0);
                const unassignedTotal = unassignedConsumedTotal + unassignedArtisan + unassignedOutsource + unassignedCustom;
                if (unassignedTotal <= 0) return null;
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-amber-700 mb-2">Unassigned</p>
                    <div className="space-y-1">
                      {[
                        { label: "Materials", value: unassignedConsumedTotal },
                        { label: "Labour", value: unassignedArtisan },
                        { label: "Outsource", value: unassignedOutsource },
                        { label: "Custom", value: unassignedCustom },
                      ].map(({ label, value }) => value > 0 && (
                        <div key={label} className="flex justify-between text-[10px] text-amber-600">
                          <span>{label}</span>
                          <span className="font-medium">{rupee(value)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-[11px] font-bold text-amber-800 border-t border-amber-200 pt-1 mt-1">
                        <span>Total</span>
                        <span>{rupee(unassignedTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Footer signature line ────────────────────────────────────────── */}
        <div className="mt-8 pt-4 border-t border-gray-100 grid grid-cols-3 gap-8 text-center print:block">
          {["Prepared By", "Verified By", "Approved By"].map(label => (
            <div key={label}>
              <div className="h-10 border-b border-gray-300 mb-1" />
              <p className="text-[10px] text-gray-400 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
