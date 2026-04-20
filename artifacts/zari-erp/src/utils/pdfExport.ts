import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GOLD = [198, 175, 75] as [number, number, number];
const DARK = [30, 30, 30]   as [number, number, number];
const GRAY = [100, 100, 100] as [number, number, number];
const LGRAY = [245, 245, 242] as [number, number, number];

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("ZARI EMBROIDERIES", 14, 9);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 14);

  doc.setTextColor(...DARK);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(subtitle, 14, 28);

  doc.setTextColor(...GRAY);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 33);
  doc.setLineWidth(0.3);
  doc.setDrawColor(...GOLD);
  doc.line(14, 36, 196, 36);
}

function addInfoGrid(doc: jsPDF, startY: number, fields: [string, string][]) {
  const colW = 91;
  let row = 0;
  let col = 0;
  fields.forEach(([label, value]) => {
    const x = 14 + col * colW;
    const y = startY + row * 10;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.setFontSize(8.5);
    doc.text(String(value || "—"), x, y + 4.5);
    col++;
    if (col === 2) { col = 0; row++; }
  });
  return startY + Math.ceil(fields.length / 2) * 10 + 2;
}

export interface POItem {
  item_name: string;
  item_code: string;
  unit_type: string | null;
  ordered_quantity: string | number;
  received_quantity: string | number;
  pending_quantity: string | number;
  unit_price: string | number;
}

export interface PRReceipt {
  pr_number: string;
  status: string;
  received_date: string;
  vendor_name: string;
  items: { item_name: string; item_code: string; quantity: string | number; unit_price: string | number; warehouse_location?: string | null }[];
}

export interface POPdfData {
  po_number: string;
  status: string;
  vendor_name: string;
  po_date: string;
  reference_type: string;
  notes?: string | null;
  items: POItem[];
  receipts?: PRReceipt[];
}

export function downloadPoPdf(po: POPdfData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  addHeader(doc, "PURCHASE ORDER", po.po_number);

  let y = addInfoGrid(doc, 42, [
    ["PO Number",    po.po_number],
    ["Status",       po.status],
    ["Vendor",       po.vendor_name],
    ["Date",         po.po_date ? fmtDate(po.po_date) : "—"],
    ["Source",       po.reference_type || "Manual"],
    ["Notes",        po.notes || "—"],
  ]);

  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("ORDER ITEMS", 14, y);
  y += 2;

  const totalOrdered = po.items.reduce((s, i) => s + parseFloat(String(i.ordered_quantity)) * parseFloat(String(i.unit_price)), 0);
  const totalReceived = po.items.reduce((s, i) => s + parseFloat(String(i.received_quantity)) * parseFloat(String(i.unit_price)), 0);

  autoTable(doc, {
    startY: y,
    head: [["#", "Item Name", "Code", "Unit", "Ordered Qty", "Received Qty", "Pending Qty", "Target Price (₹)", "Ordered Value (₹)"]],
    body: po.items.map((item, i) => [
      i + 1,
      item.item_name,
      item.item_code,
      item.unit_type || "—",
      parseFloat(String(item.ordered_quantity)).toFixed(3),
      parseFloat(String(item.received_quantity)).toFixed(3),
      parseFloat(String(item.pending_quantity)).toFixed(3),
      `₹${parseFloat(String(item.unit_price)).toFixed(2)}`,
      `₹${(parseFloat(String(item.ordered_quantity)) * parseFloat(String(item.unit_price))).toFixed(2)}`,
    ]),
    foot: [["", "", "", "", "", "", "TOTAL", "", `₹${totalOrdered.toFixed(2)}`]],
    styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK },
    headStyles: { fillColor: GOLD, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    footStyles: { fillColor: LGRAY, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 249, 246] },
    columnStyles: {
      0: { cellWidth: 8 },
      4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
      7: { halign: "right" }, 8: { halign: "right" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  if (po.receipts && po.receipts.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("PURCHASE RECEIPTS", 14, y);
    y += 2;

    for (const pr of po.receipts) {
      if (y > 240) { doc.addPage(); y = 20; }

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(`${pr.pr_number}  ·  ${fmtDate(pr.received_date)}  ·  ${pr.status.toUpperCase()}`, 14, y + 4);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Item", "Code", "Received Qty", "Received Price (₹)", "Value (₹)", "Location"]],
        body: pr.items.map(item => [
          item.item_name,
          item.item_code,
          parseFloat(String(item.quantity)).toFixed(3),
          `₹${parseFloat(String(item.unit_price)).toFixed(2)}`,
          `₹${(parseFloat(String(item.quantity)) * parseFloat(String(item.unit_price))).toFixed(2)}`,
          item.warehouse_location || "—",
        ]),
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [80, 100, 60], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: [250, 252, 248] },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    }

    const totalReceivedValue = po.receipts
      .flatMap(pr => pr.items)
      .reduce((s, i) => s + parseFloat(String(i.quantity)) * parseFloat(String(i.unit_price)), 0);

    doc.setFillColor(...LGRAY);
    doc.rect(14, y, 182, 12, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("SUMMARY", 18, y + 5);
    doc.text(`Ordered: ₹${totalOrdered.toFixed(2)}`, 70, y + 5);
    doc.text(`Received: ₹${totalReceivedValue.toFixed(2)}`, 120, y + 5);
    const diff = totalOrdered - totalReceivedValue;
    doc.setTextColor(diff > 0 ? 180 : 0, diff > 0 ? 80 : 140, 0);
    doc.text(`Pending: ₹${Math.abs(diff).toFixed(2)}`, 160, y + 5);
  }

  addFooter(doc);
  doc.save(`${po.po_number.replace(/\//g, "-")}.pdf`);
}

export interface PRPdfData {
  pr_number: string;
  po_number?: string | null;
  status: string;
  vendor_name: string;
  received_date: string;
  reference_type?: string | null;
  items: {
    item_name: string;
    item_code: string;
    quantity: string | number;
    unit_price: string | number;
    unit_type?: string | null;
    warehouse_location?: string | null;
    po_target_price?: string | number | null;
  }[];
}

export function downloadPrPdf(pr: PRPdfData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  addHeader(doc, "PURCHASE RECEIPT", pr.pr_number);

  let y = addInfoGrid(doc, 42, [
    ["PR Number",    pr.pr_number],
    ["Status",       pr.status],
    ["Vendor",       pr.vendor_name],
    ["Received Date", pr.received_date ? fmtDate(pr.received_date) : "—"],
    ["PO Number",    pr.po_number || "—"],
    ["Source",       pr.reference_type || "—"],
  ]);

  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("RECEIVED ITEMS", 14, y);
  y += 2;

  const totalValue = pr.items.reduce((s, i) => s + parseFloat(String(i.quantity)) * parseFloat(String(i.unit_price)), 0);

  const hasTarget = pr.items.some(i => i.po_target_price != null);

  autoTable(doc, {
    startY: y,
    head: [hasTarget
      ? ["#", "Item Name", "Code", "Unit", "Received Qty", "Target Price (₹)", "Received Rate (₹)", "Variance (₹)", "Value (₹)", "Location"]
      : ["#", "Item Name", "Code", "Unit", "Received Qty", "Received Rate (₹)", "Value (₹)", "Location"]
    ],
    body: pr.items.map((item, i) => {
      const qty   = parseFloat(String(item.quantity));
      const rate  = parseFloat(String(item.unit_price));
      const target = item.po_target_price != null ? parseFloat(String(item.po_target_price)) : null;
      const variance = target != null ? rate - target : null;
      if (hasTarget) {
        return [
          i + 1, item.item_name, item.item_code, item.unit_type || "—",
          qty.toFixed(3),
          target != null ? `₹${target.toFixed(2)}` : "—",
          `₹${rate.toFixed(2)}`,
          variance != null ? `₹${variance.toFixed(2)}` : "—",
          `₹${(qty * rate).toFixed(2)}`,
          item.warehouse_location || "—",
        ];
      }
      return [
        i + 1, item.item_name, item.item_code, item.unit_type || "—",
        qty.toFixed(3), `₹${rate.toFixed(2)}`, `₹${(qty * rate).toFixed(2)}`,
        item.warehouse_location || "—",
      ];
    }),
    foot: [hasTarget
      ? ["", "", "", "", "", "", "TOTAL", "", `₹${totalValue.toFixed(2)}`, ""]
      : ["", "", "", "", "TOTAL", "", `₹${totalValue.toFixed(2)}`, ""]
    ],
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: DARK },
    headStyles: { fillColor: [80, 100, 60], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    footStyles: { fillColor: LGRAY, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 252, 248] },
    columnStyles: {
      0: { cellWidth: 8 },
      4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
      7: { halign: "right" }, 8: { halign: "right" },
    },
  });

  addFooter(doc);
  doc.save(`${pr.pr_number.replace(/\//g, "-")}.pdf`);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.text(`Page ${i} of ${pageCount}  ·  ZARI EMBROIDERIES  ·  Confidential`, 14, 290);
  }
}

// ─── BOM PDF ──────────────────────────────────────────────────────────────────

export interface BomPdfRow {
  materialName: string;
  materialCode: string;
  materialType: string;
  requiredQty: string;
  unitType: string;
}

export interface BomPdfData {
  referenceType: "swatch" | "style";
  referenceId: string | number;
  orderCode?: string;
  entityName?: string;
  clientName?: string;
  rows: BomPdfRow[];
}

const PREVIEW_COL = 2; // 0-indexed, 3rd column

export function downloadBomPdf(data: BomPdfData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ── Header band ──
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("ZARI EMBROIDERIES", 14, 9);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("SAMPLING DOCUMENTATION", 14, 14);

  // ── Document title ──
  doc.setTextColor(...DARK);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Bill of Materials", 14, 28);

  // ── Gold rule ──
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);

  // ── Reference info block ──
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const fields: [string, string][] = [
    [data.referenceType === "swatch" ? "Swatch Order" : "Style Order", data.orderCode ?? String(data.referenceId)],
    [data.referenceType === "swatch" ? "Swatch Name" : "Style Name", data.entityName ?? "—"],
    ["Date",     today],
    ["Total Items", String(data.rows.length)],
    ["Document", "BOM / Sampling"],
  ];
  let y = 38;
  const colW = 91;
  fields.forEach(([label, value], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 14 + col * colW;
    const fy = y + row * 10;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(label.toUpperCase(), x, fy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.setFontSize(8.5);
    doc.text(String(value || "—"), x, fy + 4.5);
  });

  y += Math.ceil(fields.length / 2) * 10 + 6;

  // ── Section label ──
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text("MATERIAL LIST", 14, y);
  y += 3;

  // ── Preview box dimensions: 80 mm wide × 60 mm tall ──
  const PREVIEW_H = 60; // mm per row
  const PREVIEW_W = 80; // mm cell content width

  autoTable(doc, {
    startY: y,
    head: [["Item Name", "Quantity & Unit", "Sample Preview Box"]],
    body: data.rows.length > 0
      ? data.rows.map(r => [
          `${r.materialName}\n${r.materialCode ? `[${r.materialCode}]` : ""}${r.materialType ? `  •  ${r.materialType === "fabric" ? "Fabric" : "Material"}` : ""}`,
          `${parseFloat(r.requiredQty || "0").toFixed(3)}\n${r.unitType || "—"}`,
          "",
        ])
      : [["No BOM rows available", "—", ""]],
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      textColor: DARK,
      valign: "top",
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
      minCellHeight: PREVIEW_H,
    },
    headStyles: {
      fillColor: DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      minCellHeight: 9,
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "normal" },
      1: { cellWidth: 30, halign: "center", valign: "middle" },
      2: { cellWidth: PREVIEW_W, halign: "center", valign: "middle" },
    },
    alternateRowStyles: { fillColor: [252, 250, 246] },
    margin: { left: 14, right: 14 },
    // Repeat header on every new page
    showHead: "everyPage",
    didDrawCell(hookData) {
      // Draw the preview box inside column 2 (Sample Preview Box)
      if (hookData.section === "body" && hookData.column.index === PREVIEW_COL && data.rows.length > 0) {
        const { x, y: cy, width, height } = hookData.cell;
        const pad = 5; // inner padding in mm
        const bx = x + pad;
        const by = cy + pad;
        const bw = width - pad * 2;
        const bh = height - pad * 2;

        // Outer border box
        doc.setDrawColor(...GOLD);
        doc.setLineWidth(0.6);
        doc.rect(bx, by, bw, bh);

        // Inner dashed corner marks (top-left, top-right, bottom-left, bottom-right)
        const mark = 4;
        doc.setDrawColor(200, 185, 130);
        doc.setLineWidth(0.3);
        // TL
        doc.line(bx, by + mark, bx, by); doc.line(bx, by, bx + mark, by);
        // TR
        doc.line(bx + bw - mark, by, bx + bw, by); doc.line(bx + bw, by, bx + bw, by + mark);
        // BL
        doc.line(bx, by + bh - mark, bx, by + bh); doc.line(bx, by + bh, bx + mark, by + bh);
        // BR
        doc.line(bx + bw - mark, by + bh, bx + bw, by + bh); doc.line(bx + bw, by + bh, bx + bw, by + bh - mark);

        // Centre label
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(180, 165, 110);
        doc.text("Sample / Swatch Area", bx + bw / 2, by + bh / 2 - 2.5, { align: "center" });
        doc.setFontSize(6);
        doc.text("(attach / mark / sign below)", bx + bw / 2, by + bh / 2 + 2.5, { align: "center" });
      }
    },
  });

  // ── Signature footer block on last page ──
  const finalY: number = (doc as any).lastAutoTable.finalY ?? 260;
  const sigY = finalY + 12;

  // Check if footer fits on current page, otherwise add new page
  const pageH = 297;
  const footerH = 40;
  const startSigY = sigY + footerH > pageH - 10 ? (() => { doc.addPage(); return 20; })() : sigY;

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(14, startSigY, 196, startSigY);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("APPROVAL & SIGN-OFF", 14, startSigY + 6);

  const sigBoxes = [
    { label: "Prepared By", x: 14 },
    { label: "Reviewed By", x: 80 },
    { label: "Approved By", x: 146 },
  ];

  sigBoxes.forEach(({ label, x }) => {
    const bY = startSigY + 12;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(label.toUpperCase(), x, bY);

    // Name line
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(x, bY + 10, x + 54, bY + 10);
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text("Name & Designation", x, bY + 14);

    // Date line
    doc.setTextColor(200, 200, 200);
    doc.line(x, bY + 22, x + 54, bY + 22);
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text("Date", x, bY + 26);

    // Signature box
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.rect(x, bY + 28, 54, 10);
    doc.setFontSize(6);
    doc.setTextColor(200, 185, 130);
    doc.text("Signature", x + 27, bY + 34, { align: "center" });
  });

  // ── Page numbers ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Page ${i} of ${pageCount}  ·  ZARI EMBROIDERIES  ·  Bill of Materials  ·  Confidential`,
      14, 290,
    );
  }

  const filename = `BOM_${data.orderCode ?? data.referenceId}_${today.replace(/\s/g, "-")}.pdf`;
  doc.save(filename);
}
