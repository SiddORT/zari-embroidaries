import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GOLD_RGB: [number, number, number] = [198, 175, 75];
const DARK_RGB: [number, number, number] = [30, 30, 30];
const WHITE_RGB: [number, number, number] = [255, 255, 255];
const GRAY_RGB: [number, number, number] = [120, 120, 120];
const LIGHT_RGB: [number, number, number] = [245, 244, 240];

const COMPANY = "ZARI EMBROIDERIES";
const TAGLINE = "Premium Custom Embroidery";

export interface QuotationPdfData {
  quotation_number: string;
  created_at: string;
  status: string;
  client_name: string | null;
  client_state: string | null;
  requirement_summary: string | null;
  internal_notes: string | null;
  client_notes: string | null;
  estimated_weight: string;
  gst_type: string;
  gst_rate: string;
  subtotal_amount: string;
  gst_amount: string;
  estimated_shipping_charges: string;
  total_amount: string;
  cover_page: string;
  cover_page_image: string | null;
  designs: Array<{ design_name: string; hsn_code: string | null; design_image: string | null; remarks: string | null }>;
  charges: Array<{ charge_name: string; hsn_code: string | null; unit: string | null; quantity: string; price: string; amount: string }>;
}

function fmtMoney(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `Rs. ${(isNaN(n) ? 0 : n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

function coverClassic(doc: jsPDF, data: QuotationPdfData) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFillColor(...WHITE_RGB); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...GOLD_RGB); doc.rect(0, 0, W, 16, "F");
  doc.setFillColor(...GOLD_RGB); doc.rect(0, H - 12, W, 12, "F");

  doc.setFontSize(26); doc.setTextColor(...DARK_RGB); doc.setFont("helvetica", "bold");
  doc.text(COMPANY, W / 2, 78, { align: "center" });
  doc.setDrawColor(...GOLD_RGB); doc.setLineWidth(0.8);
  doc.line(30, 86, W - 30, 86);
  doc.setFontSize(11); doc.setTextColor(...GOLD_RGB); doc.setFont("helvetica", "normal");
  doc.text(TAGLINE, W / 2, 96, { align: "center" });

  doc.setFontSize(14); doc.setTextColor(...GRAY_RGB); doc.setFont("helvetica", "bold");
  doc.text("QUOTATION", W / 2, 124, { align: "center" });
  doc.setFillColor(...LIGHT_RGB); doc.roundedRect(W / 2 - 48, 130, 96, 18, 4, 4, "F");
  doc.setFontSize(13); doc.setTextColor(...GOLD_RGB); doc.setFont("helvetica", "bold");
  doc.text(data.quotation_number, W / 2, 141, { align: "center" });

  if (data.client_name) {
    doc.setFontSize(10); doc.setTextColor(...GRAY_RGB); doc.setFont("helvetica", "normal");
    doc.text("Prepared for:", W / 2, 164, { align: "center" });
    doc.setFontSize(14); doc.setTextColor(...DARK_RGB); doc.setFont("helvetica", "bold");
    doc.text(data.client_name, W / 2, 174, { align: "center" });
    if (data.client_state) {
      doc.setFontSize(10); doc.setTextColor(...GRAY_RGB); doc.setFont("helvetica", "normal");
      doc.text(data.client_state, W / 2, 183, { align: "center" });
    }
  }
  doc.setFontSize(9); doc.setTextColor(...GRAY_RGB);
  doc.text(`Date: ${fmtDate(data.created_at)}`, W / 2, 238, { align: "center" });
}

function coverModern(doc: jsPDF, data: QuotationPdfData) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFillColor(26, 26, 46); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...GOLD_RGB); doc.rect(W - 36, 0, 36, H, "F");

  doc.setFontSize(24); doc.setTextColor(...WHITE_RGB); doc.setFont("helvetica", "bold");
  doc.text(COMPANY, 22, 88);
  doc.setDrawColor(...GOLD_RGB); doc.setLineWidth(1.5); doc.line(22, 94, 115, 94);
  doc.setFontSize(10); doc.setTextColor(...GOLD_RGB); doc.setFont("helvetica", "normal");
  doc.text(TAGLINE, 22, 103);

  doc.setFontSize(36); doc.setTextColor(...WHITE_RGB); doc.setFont("helvetica", "bold");
  doc.text("QUOTATION", 22, 148);
  doc.setFontSize(14); doc.setTextColor(...GOLD_RGB); doc.text(data.quotation_number, 22, 161);

  if (data.client_name) {
    doc.setFontSize(9); doc.setTextColor(150, 150, 180); doc.setFont("helvetica", "normal");
    doc.text("FOR", 22, 186);
    doc.setFontSize(14); doc.setTextColor(...WHITE_RGB); doc.setFont("helvetica", "bold");
    doc.text(data.client_name, 22, 196);
    if (data.client_state) {
      doc.setFontSize(10); doc.setTextColor(150, 150, 180); doc.setFont("helvetica", "normal");
      doc.text(data.client_state, 22, 205);
    }
  }
  doc.setFontSize(9); doc.setTextColor(150, 150, 180);
  doc.text(fmtDate(data.created_at), 22, H - 24);
}

function coverCorporate(doc: jsPDF, data: QuotationPdfData) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFillColor(...WHITE_RGB); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...DARK_RGB); doc.rect(0, 0, W, 52, "F");
  doc.setFillColor(...GOLD_RGB); doc.circle(22, 26, 9, "F");
  doc.setFontSize(15); doc.setTextColor(...WHITE_RGB); doc.setFont("helvetica", "bold");
  doc.text(COMPANY, 37, 23);
  doc.setFontSize(8); doc.setTextColor(180, 180, 180); doc.setFont("helvetica", "normal");
  doc.text(TAGLINE, 37, 32);
  doc.setFillColor(...GOLD_RGB); doc.rect(0, 52, W, 3, "F");

  doc.setFontSize(30); doc.setTextColor(...DARK_RGB); doc.setFont("helvetica", "bold");
  doc.text("QUOTATION", 20, 108);
  doc.setDrawColor(...GOLD_RGB); doc.setLineWidth(1.5); doc.line(20, 113, 125, 113);
  doc.setFontSize(13); doc.setTextColor(...GOLD_RGB); doc.text(data.quotation_number, 20, 124);

  const iy = 148;
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
  doc.text("Date:", 20, iy); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_RGB);
  doc.text(fmtDate(data.created_at), 55, iy);
  doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
  doc.text("Prepared for:", 20, iy + 12); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_RGB);
  doc.text(data.client_name || "—", 55, iy + 12);
  if (data.client_state) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    doc.text("State:", 20, iy + 22); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_RGB);
    doc.text(data.client_state, 55, iy + 22);
  }
  doc.setFillColor(...DARK_RGB); doc.rect(0, H - 18, W, 18, "F");
  doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "normal");
  doc.text("Confidential — For Client Use Only", W / 2, H - 8, { align: "center" });
}

function coverMinimal(doc: jsPDF, data: QuotationPdfData) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFillColor(...WHITE_RGB); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...GOLD_RGB); doc.rect(0, 0, 4, H, "F");

  doc.setFontSize(20); doc.setTextColor(...DARK_RGB); doc.setFont("helvetica", "bold");
  doc.text(COMPANY, 18, 88);
  doc.setDrawColor(...GOLD_RGB); doc.setLineWidth(0.5); doc.line(18, 94, W - 18, 94);
  doc.setFontSize(9); doc.setTextColor(...GRAY_RGB); doc.setFont("helvetica", "normal");
  doc.text(TAGLINE, 18, 102);

  doc.setFontSize(10); doc.setTextColor(...GRAY_RGB); doc.text("QUOTATION", 18, 128);
  doc.setFontSize(18); doc.setTextColor(...DARK_RGB); doc.setFont("helvetica", "bold");
  doc.text(data.quotation_number, 18, 140);

  if (data.client_name) {
    doc.setFontSize(9); doc.setTextColor(...GRAY_RGB); doc.setFont("helvetica", "normal");
    doc.text("for", 18, 160);
    doc.setFontSize(13); doc.setTextColor(...DARK_RGB); doc.setFont("helvetica", "bold");
    doc.text(data.client_name, 18, 170);
    if (data.client_state) {
      doc.setFontSize(9); doc.setTextColor(...GRAY_RGB); doc.setFont("helvetica", "normal");
      doc.text(data.client_state, 18, 179);
    }
  }
  doc.setFontSize(8); doc.setTextColor(...GRAY_RGB);
  doc.text(fmtDate(data.created_at), 18, H - 18);
}

function addContentPage(doc: jsPDF, data: QuotationPdfData) {
  doc.addPage();
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(...DARK_RGB); doc.rect(0, 0, W, 22, "F");
  doc.setFillColor(...GOLD_RGB); doc.rect(0, 22, W, 2, "F");
  doc.setFontSize(12); doc.setTextColor(...WHITE_RGB); doc.setFont("helvetica", "bold");
  doc.text(COMPANY, 14, 10);
  doc.setFontSize(8); doc.setTextColor(...GOLD_RGB); doc.setFont("helvetica", "normal");
  doc.text(TAGLINE, 14, 17);
  doc.setFontSize(12); doc.setTextColor(...WHITE_RGB); doc.setFont("helvetica", "bold");
  doc.text(data.quotation_number, W - 14, 10, { align: "right" });
  doc.setFontSize(8); doc.setTextColor(180, 180, 180); doc.setFont("helvetica", "normal");
  doc.text(`Date: ${fmtDate(data.created_at)}  |  Status: ${data.status}`, W - 14, 17, { align: "right" });

  let curY = 34;

  doc.setFontSize(11); doc.setTextColor(...GOLD_RGB); doc.setFont("helvetica", "bold");
  doc.text("CLIENT DETAILS", 14, curY);
  doc.setDrawColor(...GOLD_RGB); doc.setLineWidth(0.4); doc.line(14, curY + 2, W - 14, curY + 2);
  curY += 8;
  doc.setFontSize(10); doc.setTextColor(...DARK_RGB); doc.setFont("helvetica", "normal");
  doc.text(`Client: `, 14, curY);
  doc.setFont("helvetica", "bold"); doc.text(data.client_name || "—", 40, curY);
  if (data.client_state) {
    doc.setFont("helvetica", "normal"); doc.text(`  |  State: `, 40 + doc.getTextWidth(data.client_name || "—"), curY);
    doc.setFont("helvetica", "bold");
    doc.text(data.client_state, 40 + doc.getTextWidth(data.client_name || "—") + doc.getTextWidth("  |  State: "), curY);
  }
  curY += 6;

  if (data.requirement_summary) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text("Summary:", 14, curY);
    const lines = doc.splitTextToSize(data.requirement_summary, W - 50) as string[];
    doc.text(lines, 40, curY);
    curY += Math.max(6, lines.length * 4.5) + 2;
  }

  if (data.designs.length > 0) {
    curY += 4;
    const PH = doc.internal.pageSize.getHeight();
    doc.setFontSize(11); doc.setTextColor(...GOLD_RGB); doc.setFont("helvetica", "bold");
    doc.text("DESIGNS", 14, curY);
    doc.setDrawColor(...GOLD_RGB); doc.setLineWidth(0.4); doc.line(14, curY + 2, W - 14, curY + 2);
    curY += 8;

    const IMG_W = 32;
    const IMG_H = 32;
    const CARD_H = IMG_H + 6;
    const CARD_PAD = 4;

    data.designs.forEach((d, i) => {
      if (curY + CARD_H + 6 > PH - 20) { doc.addPage(); curY = 30; }

      const hasImg = !!d.design_image;
      const textX = 14 + (hasImg ? IMG_W + CARD_PAD + 4 : 0);

      doc.setFillColor(252, 250, 240);
      doc.roundedRect(14, curY, W - 28, CARD_H, 3, 3, "F");
      doc.setDrawColor(230, 220, 180); doc.setLineWidth(0.3);
      doc.roundedRect(14, curY, W - 28, CARD_H, 3, 3, "S");

      if (hasImg) {
        try {
          const imgFmt = d.design_image!.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(d.design_image!, imgFmt, 16, curY + 2, IMG_W, IMG_H + 2);
        } catch {
          doc.setFillColor(220, 218, 210);
          doc.rect(16, curY + 2, IMG_W, IMG_H + 2, "F");
          doc.setFontSize(6); doc.setTextColor(...GRAY_RGB);
          doc.text("Image", 16 + IMG_W / 2, curY + IMG_H / 2 + 4, { align: "center" });
        }
      }

      doc.setFontSize(7); doc.setTextColor(...GOLD_RGB); doc.setFont("helvetica", "bold");
      doc.text(`#${i + 1}`, textX, curY + 9);

      doc.setFontSize(10); doc.setTextColor(...DARK_RGB); doc.setFont("helvetica", "bold");
      const nameMaxW = W - 28 - (hasImg ? IMG_W + CARD_PAD + 4 : 0) - 10;
      const nameLines = doc.splitTextToSize(d.design_name, nameMaxW) as string[];
      doc.text(nameLines[0], textX + 10, curY + 9);

      let infoY = curY + 16;
      if (d.hsn_code) {
        doc.setFontSize(8); doc.setTextColor(...GRAY_RGB); doc.setFont("helvetica", "normal");
        doc.text(`HSN: ${d.hsn_code}`, textX, infoY);
        infoY += 6;
      }
      if (d.remarks) {
        doc.setFontSize(8); doc.setTextColor(80, 80, 80); doc.setFont("helvetica", "normal");
        const rLines = doc.splitTextToSize(d.remarks, nameMaxW + 10) as string[];
        doc.text(rLines.slice(0, 2), textX, infoY);
      }

      curY += CARD_H + 4;
    });
    curY += 4;
  }

  if (data.charges.length > 0) {
    curY += 4;
    doc.setFontSize(11); doc.setTextColor(...GOLD_RGB); doc.setFont("helvetica", "bold");
    doc.text("CHARGES", 14, curY);
    doc.setDrawColor(...GOLD_RGB); doc.setLineWidth(0.4); doc.line(14, curY + 2, W - 14, curY + 2);
    curY += 6;
    autoTable(doc, {
      startY: curY,
      head: [[
        "Charge / Description",
        { content: "HSN",    styles: { halign: "right" } },
        { content: "Unit",   styles: { halign: "right" } },
        { content: "Qty",    styles: { halign: "right" } },
        { content: "Price",  styles: { halign: "right" } },
        { content: "Amount", styles: { halign: "right" } },
      ]],
      body: data.charges.map((c) => [
        c.charge_name,
        c.hsn_code || "—",
        c.unit || "—",
        parseFloat(c.quantity).toLocaleString("en-IN"),
        fmtMoney(c.price),
        fmtMoney(c.amount),
      ]),
      headStyles: { fillColor: GOLD_RGB, textColor: WHITE_RGB, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: DARK_RGB },
      alternateRowStyles: { fillColor: [252, 250, 240] },
      columnStyles: {
        0: { cellWidth: 58, halign: "left" },
        1: { cellWidth: 24, halign: "center" },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 18, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
        5: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
      tableWidth: "wrap",
    });
    curY = (doc as any).lastAutoTable.finalY + 6;
  }

  const totals: [string, string][] = [
    ["Subtotal", fmtMoney(data.subtotal_amount)],
    [`GST (${data.gst_type} @ ${data.gst_rate}%)`, fmtMoney(data.gst_amount)],
    ["Shipping", fmtMoney(data.estimated_shipping_charges)],
  ];
  const totalBoxW = 90;
  const totalBoxX = W - 14 - totalBoxW;
  curY += 4;
  totals.forEach(([label, val]) => {
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    doc.text(label, totalBoxX, curY);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_RGB);
    doc.text(val, W - 14, curY, { align: "right" });
    curY += 6;
  });
  doc.setFillColor(...GOLD_RGB); doc.rect(totalBoxX - 2, curY - 2, totalBoxW + 4, 10, "F");
  doc.setFontSize(10); doc.setTextColor(...WHITE_RGB); doc.setFont("helvetica", "bold");
  doc.text("TOTAL", totalBoxX, curY + 6);
  doc.text(fmtMoney(data.total_amount), W - 14, curY + 6, { align: "right" });

  if (data.client_notes) {
    curY += 20;
    doc.setFontSize(9); doc.setTextColor(...GOLD_RGB); doc.setFont("helvetica", "bold");
    doc.text("CLIENT NOTES", 14, curY);
    doc.setFontSize(9); doc.setTextColor(80, 80, 80); doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(data.client_notes, W - 28) as string[];
    doc.text(noteLines, 14, curY + 5);
  }

  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7); doc.setTextColor(...GRAY_RGB); doc.setFont("helvetica", "normal");
    doc.text(`${COMPANY}  |  ${data.quotation_number}`, 14, pH - 6);
    doc.text(`Page ${i} of ${pageCount}`, W - 14, pH - 6, { align: "right" });
  }
}

export async function generateQuotationPdf(data: QuotationPdfData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  if (data.cover_page === "custom" && data.cover_page_image) {
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const imgData = data.cover_page_image;
    const fmt = imgData.startsWith("data:image/png") ? "PNG"
      : imgData.startsWith("data:image/jpeg") || imgData.startsWith("data:image/jpg") ? "JPEG"
      : "JPEG";
    doc.addImage(imgData, fmt, 0, 0, W, H);
  } else {
    switch (data.cover_page) {
      case "modern":    coverModern(doc, data);    break;
      case "corporate": coverCorporate(doc, data); break;
      case "minimal":   coverMinimal(doc, data);   break;
      default:          coverClassic(doc, data);   break;
    }
  }

  addContentPage(doc, data);
  return doc;
}

export async function downloadQuotationPdf(data: QuotationPdfData) {
  const doc = await generateQuotationPdf(data);
  doc.save(`${data.quotation_number}.pdf`);
}
