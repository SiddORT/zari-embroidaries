import { useRef } from "react";
import { Printer, Loader2 } from "lucide-react";
import {
  useSwatchBom, useSwatchPOs, useSwatchPRs,
  useSwatchConsumptionLog, useArtisanTimesheets,
  useOutsourceJobs, useCustomCharges,
  type BomRecord, type PurchaseOrderRecord, type PurchaseReceiptRecord,
} from "@/hooks/useCosting";

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

// ─── Cost Sheet Tab ────────────────────────────────────────────────────────────
export default function CostSheetTab({
  swatchOrderId, orderCode, swatchName, clientName,
}: {
  swatchOrderId: number;
  orderCode?: string;
  swatchName?: string;
  clientName?: string;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: bomRows = [], isLoading: loadingBom } = useSwatchBom(swatchOrderId);
  const { data: pos = [], isLoading: loadingPos } = useSwatchPOs(swatchOrderId);
  const { data: prs = [], isLoading: loadingPrs } = useSwatchPRs(swatchOrderId);
  const { data: consumptionLog = [] } = useSwatchConsumptionLog(swatchOrderId);
  const { data: artisanTimesheets = [] } = useArtisanTimesheets(swatchOrderId);
  const { data: outsourceJobs = [] } = useOutsourceJobs(swatchOrderId);
  const { data: customCharges = [] } = useCustomCharges(swatchOrderId);

  const isLoading = loadingBom || loadingPos || loadingPrs;

  // ── BOM Metrics ─────────────────────────────────────────────────────────────
  const bomWithMetrics = bomRows.map(r => ({ r, m: computeRowMetrics(r, pos, prs) }));

  // ── Totals ──────────────────────────────────────────────────────────────────
  const bomConsumedTotal = bomWithMetrics.reduce((s, { m }) => s + m.consumedTotal, 0);
  const poTargetTotal    = bomWithMetrics.reduce((s, { m }) => s + m.poTargetTotal, 0);
  const prTotal          = prs.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0) * (parseFloat(pr.actualPrice) || 0), 0);
  const artisanTotal     = artisanTimesheets.reduce((s, r) => s + (parseFloat(r.totalRate) || 0), 0);
  const outsourceTotal   = outsourceJobs.reduce((s, r) => s + (parseFloat(r.totalCost) || 0), 0);
  const customTotal      = customCharges.reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
  const grandTotal       = bomConsumedTotal + artisanTotal + outsourceTotal + customTotal;

  function handlePrint() {
    window.print();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const SHIFT_LABELS: Record<string, string> = { regular: "Regular", night: "Night", sunday: "Sunday", overtime: "Overtime" };

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #cost-sheet-print, #cost-sheet-print * { visibility: visible; }
          #cost-sheet-print { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Cost Sheet</h2>
          <p className="text-xs text-gray-400">Consolidated cost summary for this order</p>
        </div>
        <button onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-xs font-semibold hover:bg-black transition-colors">
          <Printer className="h-3.5 w-3.5" /> Print / Save PDF
        </button>
      </div>

      {/* Printable cost sheet */}
      <div id="cost-sheet-print" ref={printRef}
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
          </div>
        </div>

        {/* ── Order Info ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50/60 rounded-xl p-4 border border-gray-100">
          <div>
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Order Code</p>
            <p className="text-sm font-bold text-gray-900">{orderCode ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Swatch Name</p>
            <p className="text-sm font-semibold text-gray-800">{swatchName ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Client</p>
            <p className="text-sm font-semibold text-gray-800">{clientName ?? "—"}</p>
          </div>
        </div>

        {/* ── 1. Bill of Materials ────────────────────────────────────────── */}
        <SheetSection title="Bill of Materials">
          <SheetTable
            headers={["#", "Code", "Material / Fabric", "Type", "Req Qty", "Live Stock", "PO Rate ₹", "Avg Price ₹", "Consumed Qty", "Consumed Total ₹"]}
            rows={bomWithMetrics.map(({ r, m }, i) => [
              i + 1,
              r.materialCode,
              r.materialName,
              r.materialType === "fabric" ? "Fabric" : "Material",
              `${parseFloat(r.requiredQty).toFixed(2)} ${r.unitType}`,
              `${fmt(m.liveStock)} ${r.unitType}`,
              rupee(m.poTargetPrice),
              rupee(m.weightedAvg),
              `${fmt(m.consumedQtyNum)} ${r.unitType}`,
              rupee(m.consumedTotal),
            ])}
            footer={bomWithMetrics.length > 0 ? [
              "", "", "", "Total", "", "", "", "",
              `${fmt(bomWithMetrics.reduce((s, { m }) => s + m.consumedQtyNum, 0))}`,
              rupee(bomConsumedTotal),
            ] : undefined}
          />
        </SheetSection>

        {/* ── 2. Purchase Orders ──────────────────────────────────────────── */}
        <SheetSection title="Purchase Orders">
          <SheetTable
            headers={["PO No.", "Vendor", "Date", "Status", "Items", "PO Value ₹"]}
            rows={pos.map(po => {
              const poVal = (po.bomItems ?? []).reduce((s, i) => s + (parseFloat(i.targetPrice) || 0) * (parseFloat(i.quantity) || 0), 0);
              return [
                po.poNumber,
                po.vendorName,
                new Date(po.poDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
                po.status,
                (po.bomItems ?? []).length,
                rupee(poVal),
              ];
            })}
            footer={pos.length > 0 ? [
              "", "", "", "", "Total",
              rupee(poTargetTotal),
            ] : undefined}
          />
        </SheetSection>

        {/* ── 3. Purchase Receipts ────────────────────────────────────────── */}
        <SheetSection title="Purchase Receipts (GRN)">
          <SheetTable
            headers={["PR No.", "Vendor", "Received Date", "Received Qty", "Unit Price ₹", "PR Total ₹"]}
            rows={prs.map(pr => [
              pr.prNumber,
              pr.vendorName,
              new Date(pr.receivedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
              `${parseFloat(pr.receivedQty).toFixed(2)}`,
              rupee(parseFloat(pr.actualPrice)),
              rupee((parseFloat(pr.receivedQty) || 0) * (parseFloat(pr.actualPrice) || 0)),
            ])}
            footer={prs.length > 0 ? [
              "", "", "", "", "Total",
              rupee(prTotal),
            ] : undefined}
          />
        </SheetSection>

        {/* ── 4. Consumption Log ──────────────────────────────────────────── */}
        <SheetSection title="Material Consumption">
          <SheetTable
            headers={["Code", "Material / Fabric", "Type", "Consumed Qty", "Avg Price ₹", "Consumed Total ₹", "Consumed By"]}
            rows={bomWithMetrics.filter(({ m }) => m.consumedQtyNum > 0).map(({ r, m }) => [
              r.materialCode,
              r.materialName,
              r.materialType === "fabric" ? "Fabric" : "Material",
              `${fmt(m.consumedQtyNum)} ${r.unitType}`,
              rupee(m.weightedAvg),
              rupee(m.consumedTotal),
              (() => {
                const entries = consumptionLog.filter(e => e.bomRowId === r.id);
                const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
                return lastEntry?.consumedBy ?? "—";
              })(),
            ])}
            footer={bomWithMetrics.filter(({ m }) => m.consumedQtyNum > 0).length > 0 ? [
              "", "", "Total", "", "",
              rupee(bomConsumedTotal),
              "",
            ] : undefined}
          />
        </SheetSection>

        {/* ── 5. Artisan Time Sheet ───────────────────────────────────────── */}
        <SheetSection title="Artisan Time Sheet">
          <SheetTable
            headers={["Start Date", "End Date", "Shift Type", "# Artisans", "Total Hours", "Rate / Hr ₹", "Total Rate ₹"]}
            rows={artisanTimesheets.map(r => [
              r.startDate,
              r.endDate,
              SHIFT_LABELS[r.shiftType] ?? r.shiftType,
              r.noOfArtisans,
              parseFloat(r.totalHours).toFixed(1),
              rupee(parseFloat(r.hourlyRate)),
              rupee(parseFloat(r.totalRate)),
            ])}
            footer={artisanTimesheets.length > 0 ? [
              "", "", "", "", "", "Total",
              rupee(artisanTotal),
            ] : undefined}
          />
        </SheetSection>

        {/* ── 6. Outsource Jobs ───────────────────────────────────────────── */}
        <SheetSection title="Outsource Jobs">
          <SheetTable
            headers={["Vendor", "HSN", "GST%", "Issue Date", "Target Date", "Delivery Date", "Total Cost ₹"]}
            rows={outsourceJobs.map(r => [
              r.vendorName,
              r.hsnCode,
              `${r.gstPercentage}%`,
              r.issueDate,
              r.targetDate ?? "—",
              r.deliveryDate ?? "—",
              rupee(parseFloat(r.totalCost)),
            ])}
            footer={outsourceJobs.length > 0 ? [
              "", "", "", "", "", "Total",
              rupee(outsourceTotal),
            ] : undefined}
          />
        </SheetSection>

        {/* ── 7. Custom Charges ───────────────────────────────────────────── */}
        <SheetSection title="Custom Charges">
          <SheetTable
            headers={["Vendor", "HSN", "GST%", "Description", "Unit Price ₹", "Qty", "Total ₹"]}
            rows={customCharges.map(r => [
              r.vendorName,
              r.hsnCode,
              `${r.gstPercentage}%`,
              r.description,
              rupee(parseFloat(r.unitPrice)),
              parseFloat(r.quantity).toFixed(2),
              rupee(parseFloat(r.totalAmount)),
            ])}
            footer={customCharges.length > 0 ? [
              "", "", "", "", "", "Total",
              rupee(customTotal),
            ] : undefined}
          />
        </SheetSection>

        {/* ── Grand Total ─────────────────────────────────────────────────── */}
        <div className="mt-6 border-t-2 border-gray-900 pt-4">
          <div className="flex justify-end">
            <div className="w-80">
              <div className="space-y-1.5">
                {[
                  { label: "Material Consumed", value: bomConsumedTotal },
                  { label: "Artisan Labour", value: artisanTotal },
                  { label: "Outsource Jobs", value: outsourceTotal },
                  { label: "Custom Charges", value: customTotal },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs text-gray-600 px-3 py-0.5">
                    <span>{label}</span>
                    <span className="font-medium text-gray-800">{rupee(value)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-gray-900 mt-2">
                  <span className="text-xs font-bold text-white tracking-wide">GRAND TOTAL</span>
                  <span className="text-base font-black text-[#C9B45C]">{rupee(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

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
