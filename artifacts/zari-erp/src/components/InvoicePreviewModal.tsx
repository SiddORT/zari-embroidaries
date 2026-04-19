import { useEffect, useState, useRef } from "react";
import { X, Printer, Loader2 } from "lucide-react";

const G = "#C6AF4B";
const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SAR: "﷼" };

function customFetch<T = any>(url: string): Promise<T> {
  const token = localStorage.getItem("zarierp_token");
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

export interface PreviewLineItem {
  description: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
}

export interface PreviewInvoice {
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  invoiceType: string;
  currencyCode: string;
  exchangeRate: number;
  clientName: string;
  clientAddress: string;
  clientGstin: string;
  clientEmail: string;
  clientPhone: string;
  clientState: string;
  items: PreviewLineItem[];
  cgstRate: number;
  sgstRate: number;
  discountType: string;
  discountValue: number;
  shippingAmount: number;
  adjustmentAmount: number;
  receivedAmount: number;
  paymentTerms: string;
  notes: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  bankUpi: string;
  referenceType?: string;
  referenceId?: string;
}

interface CompanyInfo {
  gstin: string;
  state: string;
  country: string;
}

interface Template {
  layout: string;
  payment_terms: string;
  notes: string;
}

interface Props {
  invoiceId?: number;
  formSnapshot?: PreviewInvoice;
  onClose: () => void;
}

function calcTotals(inv: PreviewInvoice) {
  const subtotal = inv.items.reduce((s, i) => s + i.total, 0);
  const discount = inv.discountType === "percent" ? (subtotal * inv.discountValue) / 100 : inv.discountValue;
  const taxable = subtotal - discount;
  const cgstAmt = (taxable * inv.cgstRate) / 100;
  const sgstAmt = (taxable * inv.sgstRate) / 100;
  const total = taxable + cgstAmt + sgstAmt + inv.shippingAmount + inv.adjustmentAmount;
  const pending = total - inv.receivedAmount;
  return { subtotal, discount, taxable, cgstAmt, sgstAmt, total, pending };
}

function fmtDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

function toFx(inr: number, rate: number) {
  return rate > 0 ? inr / rate : inr;
}

// ---- CLASSIC TEMPLATE ----
function ClassicTemplate({ inv, company, tpl }: { inv: PreviewInvoice; company: CompanyInfo; tpl: Template }) {
  const t = calcTotals(inv);
  const sym = CURRENCY_SYMBOLS[inv.currencyCode] ?? inv.currencyCode;
  const rate = inv.exchangeRate || 1;
  const fmt = (n: number) => toFx(n, rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const payTerms = inv.paymentTerms || tpl.payment_terms;
  const notesTxt = inv.notes || tpl.notes;
  const showHsn = inv.items.some(i => i.hsnCode);

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#1a1a1a", background: "#fff", padding: "40px 48px", maxWidth: 794, margin: "0 auto", fontSize: 13 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, borderBottom: "3px solid #1a1a1a", paddingBottom: 20 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2, color: "#1a1a1a" }}>ZARI EMBROIDERIES</div>
          {company.gstin && <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>GSTIN: {company.gstin}</div>}
          {company.state && <div style={{ fontSize: 11, color: "#555" }}>{company.state}{company.country ? `, ${company.country}` : ""}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: G, letterSpacing: 1 }}>INVOICE</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{inv.invoiceNo}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
            <span style={{ fontWeight: 600 }}>Date:</span> {fmtDate(inv.invoiceDate)}<br />
            {inv.dueDate && <><span style={{ fontWeight: 600 }}>Due:</span> {fmtDate(inv.dueDate)}</>}
          </div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{inv.invoiceType}</div>
        </div>
      </div>

      {/* Bill To + Reference */}
      <div style={{ display: "flex", gap: 40, marginBottom: 28 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 6 }}>Bill To</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.clientName || "—"}</div>
          {inv.clientAddress && <div style={{ color: "#555", marginTop: 3, lineHeight: 1.5, whiteSpace: "pre-line", fontSize: 12 }}>{inv.clientAddress}</div>}
          {inv.clientGstin && <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>GSTIN: {inv.clientGstin}</div>}
          {inv.clientEmail && <div style={{ fontSize: 11, color: "#444" }}>{inv.clientEmail}</div>}
          {inv.clientPhone && <div style={{ fontSize: 11, color: "#444" }}>{inv.clientPhone}</div>}
          {inv.clientState && <div style={{ fontSize: 11, color: "#444" }}>{inv.clientState}</div>}
        </div>
        {inv.referenceId && (
          <div style={{ minWidth: 140 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 6 }}>Reference</div>
            <div style={{ fontSize: 12, color: "#555" }}><span style={{ fontWeight: 600 }}>{inv.referenceType}:</span> {inv.referenceId}</div>
          </div>
        )}
      </div>

      {/* Line Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
        <thead>
          <tr style={{ background: "#1a1a1a", color: "#fff" }}>
            <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, width: 32 }}>#</th>
            <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 11, fontWeight: 600 }}>Description</th>
            {showHsn && <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, width: 80 }}>HSN</th>}
            <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 11, fontWeight: 600, width: 60 }}>Qty</th>
            <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 11, fontWeight: 600, width: 90 }}>Unit Price</th>
            <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 11, fontWeight: 600, width: 90 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f9f9f9", borderBottom: "1px solid #e8e8e8" }}>
              <td style={{ padding: "8px 10px", fontSize: 12, color: "#888" }}>{idx + 1}</td>
              <td style={{ padding: "8px 10px", fontSize: 12 }}>{item.description}</td>
              {showHsn && <td style={{ padding: "8px 10px", fontSize: 11, color: "#666" }}>{item.hsnCode || "—"}</td>}
              <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{item.quantity} {item.unit || ""}</td>
              <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{sym}{fmt(item.unitPrice)}</td>
              <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", fontWeight: 600 }}>{sym}{fmt(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <table style={{ minWidth: 260, fontSize: 12 }}>
          <tbody>
            <tr><td style={{ padding: "4px 8px", color: "#666" }}>Subtotal</td><td style={{ padding: "4px 8px", textAlign: "right" }}>{sym}{fmt(t.subtotal)}</td></tr>
            {t.discount > 0 && <tr><td style={{ padding: "4px 8px", color: "#666" }}>Discount</td><td style={{ padding: "4px 8px", textAlign: "right", color: "#e53e3e" }}>−{sym}{fmt(t.discount)}</td></tr>}
            {t.taxable !== t.subtotal && <tr><td style={{ padding: "4px 8px", color: "#666" }}>Taxable</td><td style={{ padding: "4px 8px", textAlign: "right" }}>{sym}{fmt(t.taxable)}</td></tr>}
            {inv.cgstRate > 0 && <tr><td style={{ padding: "4px 8px", color: "#666" }}>CGST ({inv.cgstRate}%)</td><td style={{ padding: "4px 8px", textAlign: "right" }}>{sym}{fmt(t.cgstAmt)}</td></tr>}
            {inv.sgstRate > 0 && <tr><td style={{ padding: "4px 8px", color: "#666" }}>SGST ({inv.sgstRate}%)</td><td style={{ padding: "4px 8px", textAlign: "right" }}>{sym}{fmt(t.sgstAmt)}</td></tr>}
            {inv.shippingAmount > 0 && <tr><td style={{ padding: "4px 8px", color: "#666" }}>Shipping</td><td style={{ padding: "4px 8px", textAlign: "right" }}>{sym}{fmt(inv.shippingAmount)}</td></tr>}
            {inv.adjustmentAmount !== 0 && <tr><td style={{ padding: "4px 8px", color: "#666" }}>Adjustment</td><td style={{ padding: "4px 8px", textAlign: "right" }}>{inv.adjustmentAmount < 0 ? "−" : "+"}{sym}{fmt(Math.abs(inv.adjustmentAmount))}</td></tr>}
            <tr style={{ borderTop: "2px solid #1a1a1a" }}>
              <td style={{ padding: "8px 8px", fontWeight: 700, fontSize: 14 }}>Total</td>
              <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>{sym}{fmt(t.total)}</td>
            </tr>
            {inv.receivedAmount > 0 && <>
              <tr><td style={{ padding: "4px 8px", color: "#38a169" }}>Received</td><td style={{ padding: "4px 8px", textAlign: "right", color: "#38a169" }}>{sym}{fmt(inv.receivedAmount)}</td></tr>
              <tr><td style={{ padding: "4px 8px", color: "#e53e3e", fontWeight: 600 }}>Pending</td><td style={{ padding: "4px 8px", textAlign: "right", color: "#e53e3e", fontWeight: 600 }}>{sym}{fmt(t.pending)}</td></tr>
            </>}
          </tbody>
        </table>
      </div>

      {/* Bank Details */}
      {(inv.bankName || inv.bankAccount || inv.bankUpi) && (
        <div style={{ background: "#f7f7f7", borderRadius: 6, padding: "12px 16px", marginBottom: 20, fontSize: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "#555", marginBottom: 6 }}>Payment Details</div>
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
            {inv.bankName && <div><span style={{ color: "#888" }}>Bank: </span><span style={{ fontWeight: 600 }}>{inv.bankName}</span></div>}
            {inv.bankAccount && <div><span style={{ color: "#888" }}>A/C: </span><span style={{ fontWeight: 600 }}>{inv.bankAccount}</span></div>}
            {inv.bankIfsc && <div><span style={{ color: "#888" }}>IFSC: </span><span style={{ fontWeight: 600 }}>{inv.bankIfsc}</span></div>}
            {inv.bankBranch && <div><span style={{ color: "#888" }}>Branch: </span><span style={{ fontWeight: 600 }}>{inv.bankBranch}</span></div>}
            {inv.bankUpi && <div><span style={{ color: "#888" }}>UPI: </span><span style={{ fontWeight: 600 }}>{inv.bankUpi}</span></div>}
          </div>
        </div>
      )}

      {/* Footer: Payment Terms + Notes */}
      {(payTerms || notesTxt) && (
        <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: 16, marginTop: 8, fontSize: 11, color: "#555" }}>
          {payTerms && <div style={{ marginBottom: 6 }}><span style={{ fontWeight: 700, color: "#1a1a1a" }}>Payment Terms: </span>{payTerms}</div>}
          {notesTxt && <div style={{ whiteSpace: "pre-line" }}><span style={{ fontWeight: 700, color: "#1a1a1a" }}>Notes: </span>{notesTxt}</div>}
        </div>
      )}
      <div style={{ textAlign: "center", marginTop: 32, color: "#aaa", fontSize: 10, borderTop: "1px solid #eee", paddingTop: 12 }}>
        This is a computer-generated invoice and does not require a physical signature.
      </div>
    </div>
  );
}

// ---- MODERN TEMPLATE ----
function ModernTemplate({ inv, company, tpl }: { inv: PreviewInvoice; company: CompanyInfo; tpl: Template }) {
  const t = calcTotals(inv);
  const sym = CURRENCY_SYMBOLS[inv.currencyCode] ?? inv.currencyCode;
  const rate = inv.exchangeRate || 1;
  const fmt = (n: number) => toFx(n, rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const payTerms = inv.paymentTerms || tpl.payment_terms;
  const notesTxt = inv.notes || tpl.notes;
  const showHsn = inv.items.some(i => i.hsnCode);

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#1a1a1a", background: "#fff", maxWidth: 794, margin: "0 auto", fontSize: 13 }}>
      {/* Dark header */}
      <div style={{ background: "#1C1C2E", color: "#fff", padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1.5, color: G }}>ZARI EMBROIDERIES</div>
          {company.gstin && <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>GSTIN: {company.gstin}</div>}
          {company.state && <div style={{ fontSize: 10, color: "#aaa" }}>{company.state}{company.country ? `, ${company.country}` : ""}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "#aaa" }}>{inv.invoiceType}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", marginTop: 4 }}>{inv.invoiceNo}</div>
        </div>
      </div>

      {/* Info bar */}
      <div style={{ background: G, padding: "10px 40px", display: "flex", gap: 40, fontSize: 11 }}>
        <div><span style={{ color: "#5a4700", fontWeight: 600 }}>DATE: </span><span style={{ fontWeight: 700, color: "#1a1a1a" }}>{fmtDate(inv.invoiceDate)}</span></div>
        {inv.dueDate && <div><span style={{ color: "#5a4700", fontWeight: 600 }}>DUE: </span><span style={{ fontWeight: 700, color: "#1a1a1a" }}>{fmtDate(inv.dueDate)}</span></div>}
        {inv.referenceId && <div><span style={{ color: "#5a4700", fontWeight: 600 }}>REF: </span><span style={{ fontWeight: 700, color: "#1a1a1a" }}>{inv.referenceType}/{inv.referenceId}</span></div>}
      </div>

      <div style={{ padding: "28px 40px" }}>
        {/* Bill To */}
        <div style={{ marginBottom: 24, background: "#f8f8f8", borderRadius: 8, padding: "14px 18px", borderLeft: `4px solid ${G}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#888", marginBottom: 6 }}>Bill To</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.clientName || "—"}</div>
          {inv.clientAddress && <div style={{ color: "#555", fontSize: 12, marginTop: 2, whiteSpace: "pre-line" }}>{inv.clientAddress}</div>}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 4, fontSize: 11, color: "#666" }}>
            {inv.clientGstin && <span>GSTIN: {inv.clientGstin}</span>}
            {inv.clientEmail && <span>{inv.clientEmail}</span>}
            {inv.clientPhone && <span>{inv.clientPhone}</span>}
            {inv.clientState && <span>{inv.clientState}</span>}
          </div>
        </div>

        {/* Items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #1C1C2E" }}>
              <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#888", width: 28 }}>#</th>
              <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#888" }}>Description</th>
              {showHsn && <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#888", width: 80 }}>HSN</th>}
              <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#888", width: 55 }}>Qty</th>
              <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#888", width: 90 }}>Rate</th>
              <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#888", width: 90 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "9px 6px", fontSize: 11, color: "#aaa" }}>{idx + 1}</td>
                <td style={{ padding: "9px 6px", fontSize: 12 }}>{item.description}</td>
                {showHsn && <td style={{ padding: "9px 6px", fontSize: 11, color: "#777" }}>{item.hsnCode || "—"}</td>}
                <td style={{ padding: "9px 6px", fontSize: 12, textAlign: "right" }}>{item.quantity}</td>
                <td style={{ padding: "9px 6px", fontSize: 12, textAlign: "right" }}>{sym}{fmt(item.unitPrice)}</td>
                <td style={{ padding: "9px 6px", fontSize: 12, textAlign: "right", fontWeight: 600 }}>{sym}{fmt(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <div style={{ minWidth: 280, background: "#f8f8f8", borderRadius: 8, padding: "14px 18px", fontSize: 12 }}>
            {[
              ["Subtotal", `${sym}${fmt(t.subtotal)}`],
              t.discount > 0 ? ["Discount", `−${sym}${fmt(t.discount)}`] : null,
              inv.cgstRate > 0 ? [`CGST (${inv.cgstRate}%)`, `${sym}${fmt(t.cgstAmt)}`] : null,
              inv.sgstRate > 0 ? [`SGST (${inv.sgstRate}%)`, `${sym}${fmt(t.sgstAmt)}`] : null,
              inv.shippingAmount > 0 ? ["Shipping", `${sym}${fmt(inv.shippingAmount)}`] : null,
            ].filter(Boolean).map(([label, val], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#555" }}>
                <span>{label}</span><span>{val as string}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 3px", marginTop: 6, borderTop: `2px solid ${G}`, fontWeight: 700, fontSize: 14 }}>
              <span>Total</span><span style={{ color: "#1C1C2E" }}>{sym}{fmt(t.total)}</span>
            </div>
            {inv.receivedAmount > 0 && <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#38a169" }}>
                <span>Received</span><span>{sym}{fmt(inv.receivedAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#e53e3e", fontWeight: 600 }}>
                <span>Pending</span><span>{sym}{fmt(t.pending)}</span>
              </div>
            </>}
          </div>
        </div>

        {/* Bank */}
        {(inv.bankName || inv.bankAccount || inv.bankUpi) && (
          <div style={{ fontSize: 12, marginBottom: 20, padding: "12px 16px", border: "1px solid #e8e8e8", borderRadius: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Bank Details</div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              {inv.bankName && <span><b>Bank:</b> {inv.bankName}</span>}
              {inv.bankAccount && <span><b>A/C:</b> {inv.bankAccount}</span>}
              {inv.bankIfsc && <span><b>IFSC:</b> {inv.bankIfsc}</span>}
              {inv.bankBranch && <span><b>Branch:</b> {inv.bankBranch}</span>}
              {inv.bankUpi && <span><b>UPI:</b> {inv.bankUpi}</span>}
            </div>
          </div>
        )}

        {/* Footer */}
        {(payTerms || notesTxt) && (
          <div style={{ fontSize: 11, color: "#666", borderTop: "1px solid #eee", paddingTop: 14 }}>
            {payTerms && <div style={{ marginBottom: 5 }}><b style={{ color: "#1a1a1a" }}>Payment Terms:</b> {payTerms}</div>}
            {notesTxt && <div style={{ whiteSpace: "pre-line" }}><b style={{ color: "#1a1a1a" }}>Notes:</b> {notesTxt}</div>}
          </div>
        )}
      </div>
      <div style={{ background: "#1C1C2E", color: "#777", fontSize: 10, textAlign: "center", padding: "10px 40px" }}>
        Computer-generated invoice — no physical signature required
      </div>
    </div>
  );
}

// ---- PREMIUM TEMPLATE ----
function PremiumTemplate({ inv, company, tpl }: { inv: PreviewInvoice; company: CompanyInfo; tpl: Template }) {
  const t = calcTotals(inv);
  const sym = CURRENCY_SYMBOLS[inv.currencyCode] ?? inv.currencyCode;
  const rate = inv.exchangeRate || 1;
  const fmt = (n: number) => toFx(n, rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const payTerms = inv.paymentTerms || tpl.payment_terms;
  const notesTxt = inv.notes || tpl.notes;
  const showHsn = inv.items.some(i => i.hsnCode);

  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#2d2410", background: "#fff", maxWidth: 794, margin: "0 auto", fontSize: 13 }}>
      {/* Gold gradient header */}
      <div style={{ background: "linear-gradient(135deg, #8B6914 0%, #C6AF4B 50%, #8B6914 100%)", padding: "36px 48px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>ZARI EMBROIDERIES</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", letterSpacing: 3, marginTop: 4, textTransform: "uppercase" }}>
            {company.gstin ? `GSTIN: ${company.gstin}` : ""}{company.state ? ` · ${company.state}` : ""}{company.country ? `, ${company.country}` : ""}
          </div>
          <div style={{ width: 60, height: 2, background: "rgba(255,255,255,0.5)", margin: "14px auto 12px" }} />
          <div style={{ fontSize: 14, letterSpacing: 6, color: "#fff8e6", textTransform: "uppercase" }}>Invoice</div>
        </div>
      </div>

      {/* Invoice meta strip */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 48px", borderBottom: "1px solid #d4b86a", background: "#fffdf5" }}>
        <div style={{ fontSize: 12 }}>
          <span style={{ color: "#8B6914", fontWeight: 600 }}>No: </span><span style={{ fontWeight: 700 }}>{inv.invoiceNo}</span>
          {inv.referenceId && <span style={{ color: "#888", marginLeft: 16, fontSize: 11 }}>· {inv.referenceType}/{inv.referenceId}</span>}
        </div>
        <div style={{ fontSize: 12, textAlign: "right" }}>
          <span style={{ color: "#8B6914", fontWeight: 600 }}>Date: </span><span style={{ fontWeight: 700 }}>{fmtDate(inv.invoiceDate)}</span>
          {inv.dueDate && <span style={{ marginLeft: 16 }}><span style={{ color: "#8B6914", fontWeight: 600 }}>Due: </span><span style={{ fontWeight: 700 }}>{fmtDate(inv.dueDate)}</span></span>}
        </div>
      </div>

      <div style={{ padding: "28px 48px" }}>
        {/* Bill To */}
        <div style={{ marginBottom: 28, padding: "16px 20px", border: "1px solid #d4b86a", borderRadius: 2, background: "#fffdf5" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#8B6914", marginBottom: 8 }}>Billed To</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#2d2410" }}>{inv.clientName || "—"}</div>
          {inv.clientAddress && <div style={{ color: "#5a4700", fontSize: 12, marginTop: 4, whiteSpace: "pre-line", lineHeight: 1.6 }}>{inv.clientAddress}</div>}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 4, fontSize: 11, color: "#8B6914" }}>
            {inv.clientGstin && <span>GSTIN: {inv.clientGstin}</span>}
            {inv.clientEmail && <span>{inv.clientEmail}</span>}
            {inv.clientPhone && <span>{inv.clientPhone}</span>}
          </div>
        </div>

        {/* Line Items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "linear-gradient(90deg, #8B6914, #C6AF4B)", color: "#fff" }}>
              <th style={{ padding: "10px 10px", textAlign: "left", fontSize: 10, fontWeight: 600, letterSpacing: 1, width: 28 }}>#</th>
              <th style={{ padding: "10px 10px", textAlign: "left", fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>Description</th>
              {showHsn && <th style={{ padding: "10px 10px", textAlign: "left", fontSize: 10, fontWeight: 600, letterSpacing: 1, width: 80 }}>HSN</th>}
              <th style={{ padding: "10px 10px", textAlign: "right", fontSize: 10, fontWeight: 600, letterSpacing: 1, width: 55 }}>Qty</th>
              <th style={{ padding: "10px 10px", textAlign: "right", fontSize: 10, fontWeight: 600, letterSpacing: 1, width: 90 }}>Rate</th>
              <th style={{ padding: "10px 10px", textAlign: "right", fontSize: 10, fontWeight: 600, letterSpacing: 1, width: 100 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#fffdf5", borderBottom: "1px solid #e8d9a8" }}>
                <td style={{ padding: "9px 10px", fontSize: 11, color: "#b8994e" }}>{idx + 1}</td>
                <td style={{ padding: "9px 10px", fontSize: 12 }}>{item.description}</td>
                {showHsn && <td style={{ padding: "9px 10px", fontSize: 11, color: "#8B6914" }}>{item.hsnCode || "—"}</td>}
                <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right" }}>{item.quantity}</td>
                <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right" }}>{sym}{fmt(item.unitPrice)}</td>
                <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right", fontWeight: 700, color: "#2d2410" }}>{sym}{fmt(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <table style={{ minWidth: 280, fontSize: 12 }}>
            <tbody>
              {t.discount > 0 && <>
                <tr><td style={{ padding: "3px 8px", color: "#8B6914" }}>Subtotal</td><td style={{ padding: "3px 8px", textAlign: "right" }}>{sym}{fmt(t.subtotal)}</td></tr>
                <tr><td style={{ padding: "3px 8px", color: "#8B6914" }}>Discount</td><td style={{ padding: "3px 8px", textAlign: "right", color: "#e53e3e" }}>−{sym}{fmt(t.discount)}</td></tr>
              </>}
              {inv.cgstRate > 0 && <tr><td style={{ padding: "3px 8px", color: "#8B6914" }}>CGST ({inv.cgstRate}%)</td><td style={{ padding: "3px 8px", textAlign: "right" }}>{sym}{fmt(t.cgstAmt)}</td></tr>}
              {inv.sgstRate > 0 && <tr><td style={{ padding: "3px 8px", color: "#8B6914" }}>SGST ({inv.sgstRate}%)</td><td style={{ padding: "3px 8px", textAlign: "right" }}>{sym}{fmt(t.sgstAmt)}</td></tr>}
              {inv.shippingAmount > 0 && <tr><td style={{ padding: "3px 8px", color: "#8B6914" }}>Shipping</td><td style={{ padding: "3px 8px", textAlign: "right" }}>{sym}{fmt(inv.shippingAmount)}</td></tr>}
              <tr style={{ borderTop: "2px solid #C6AF4B" }}>
                <td style={{ padding: "10px 8px", fontWeight: 700, fontSize: 15, color: "#2d2410" }}>Total</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, fontSize: 15, color: "#8B6914" }}>{sym}{fmt(t.total)}</td>
              </tr>
              {inv.receivedAmount > 0 && <>
                <tr><td style={{ padding: "3px 8px", color: "#38a169" }}>Received</td><td style={{ padding: "3px 8px", textAlign: "right", color: "#38a169" }}>{sym}{fmt(inv.receivedAmount)}</td></tr>
                <tr><td style={{ padding: "3px 8px", color: "#e53e3e", fontWeight: 600 }}>Pending</td><td style={{ padding: "3px 8px", textAlign: "right", color: "#e53e3e", fontWeight: 600 }}>{sym}{fmt(t.pending)}</td></tr>
              </>}
            </tbody>
          </table>
        </div>

        {/* Bank */}
        {(inv.bankName || inv.bankAccount || inv.bankUpi) && (
          <div style={{ marginBottom: 20, padding: "12px 16px", border: "1px solid #d4b86a", borderRadius: 2, fontSize: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#8B6914", marginBottom: 6 }}>Payment Details</div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              {inv.bankName && <span><b>Bank:</b> {inv.bankName}</span>}
              {inv.bankAccount && <span><b>A/C:</b> {inv.bankAccount}</span>}
              {inv.bankIfsc && <span><b>IFSC:</b> {inv.bankIfsc}</span>}
              {inv.bankBranch && <span><b>Branch:</b> {inv.bankBranch}</span>}
              {inv.bankUpi && <span><b>UPI:</b> {inv.bankUpi}</span>}
            </div>
          </div>
        )}

        {/* Footer */}
        {(payTerms || notesTxt) && (
          <div style={{ borderTop: "1px solid #d4b86a", paddingTop: 16, marginTop: 8, fontSize: 11, color: "#5a4700" }}>
            {payTerms && <div style={{ marginBottom: 6 }}><b style={{ color: "#2d2410" }}>Payment Terms:</b> {payTerms}</div>}
            {notesTxt && <div style={{ whiteSpace: "pre-line" }}><b style={{ color: "#2d2410" }}>Notes:</b> {notesTxt}</div>}
          </div>
        )}
      </div>

      <div style={{ background: "linear-gradient(135deg, #8B6914 0%, #C6AF4B 50%, #8B6914 100%)", color: "rgba(255,255,255,0.7)", fontSize: 10, textAlign: "center", padding: "10px 48px" }}>
        Thank you for your business · ZARI EMBROIDERIES
      </div>
    </div>
  );
}

// ---- Main Modal ----
export default function InvoicePreviewModal({ invoiceId, formSnapshot, onClose }: Props) {
  const [inv, setInv] = useState<PreviewInvoice | null>(formSnapshot ?? null);
  const [company, setCompany] = useState<CompanyInfo>({ gstin: "", state: "", country: "India" });
  const [template, setTemplate] = useState<Template>({ layout: "classic", payment_terms: "", notes: "" });
  const [loading, setLoading] = useState(!formSnapshot);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [gstData, tplData] = await Promise.all([
          customFetch<any>("/api/settings/gst"),
          customFetch<any>("/api/settings/invoice-templates"),
        ]);
        if (gstData?.data) {
          setCompany({ gstin: gstData.data.company_gstin || "", state: gstData.data.company_state || "", country: gstData.data.company_country || "India" });
        }
        const templates: any[] = tplData?.data ?? [];
        const def = templates.find(t => t.is_default) ?? templates[0];
        if (def) setTemplate({ layout: def.layout ?? "classic", payment_terms: def.payment_terms ?? "", notes: def.notes ?? "" });

        if (invoiceId) {
          const invData = await customFetch<any>(`/api/invoices/${invoiceId}`);
          const d = invData?.data;
          if (d) {
            setInv({
              invoiceNo: d.invoiceNo ?? d.invoice_no,
              invoiceDate: d.invoiceDate ?? d.invoice_date,
              dueDate: d.dueDate ?? d.due_date ?? "",
              invoiceType: d.invoiceType ?? d.invoice_type ?? "",
              currencyCode: d.currencyCode ?? d.currency_code ?? "INR",
              exchangeRate: parseFloat(d.exchangeRateSnapshot ?? d.exchange_rate_snapshot ?? "1"),
              clientName: d.clientName ?? d.client_name ?? "",
              clientAddress: d.clientAddress ?? d.client_address ?? "",
              clientGstin: d.clientGstin ?? d.client_gstin ?? "",
              clientEmail: d.clientEmail ?? d.client_email ?? "",
              clientPhone: d.clientPhone ?? d.client_phone ?? "",
              clientState: d.clientState ?? d.client_state ?? "",
              items: Array.isArray(d.items) ? d.items : [],
              cgstRate: parseFloat(d.cgstRate ?? d.cgst_rate ?? "0"),
              sgstRate: parseFloat(d.sgstRate ?? d.sgst_rate ?? "0"),
              discountType: d.discountType ?? d.discount_type ?? "flat",
              discountValue: parseFloat(d.discountValue ?? d.discount_value ?? "0"),
              shippingAmount: parseFloat(d.shippingAmount ?? d.shipping_amount ?? "0"),
              adjustmentAmount: parseFloat(d.adjustmentAmount ?? d.adjustment_amount ?? "0"),
              receivedAmount: parseFloat(d.receivedAmount ?? d.received_amount ?? "0"),
              paymentTerms: d.paymentTerms ?? d.payment_terms ?? "",
              notes: d.notes ?? "",
              bankName: d.bankName ?? d.bank_name ?? "",
              bankAccount: d.bankAccount ?? d.bank_account ?? "",
              bankIfsc: d.bankIfsc ?? d.bank_ifsc ?? "",
              bankBranch: d.bankBranch ?? d.bank_branch ?? "",
              bankUpi: d.bankUpi ?? d.bank_upi ?? "",
              referenceType: d.referenceType ?? d.reference_type ?? "",
              referenceId: d.referenceId ?? d.reference_id ?? "",
            });
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId]);

  function handlePrint() {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv?.invoiceNo ?? "Invoice"}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; }
        @media print {
          @page { margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head><body>${html}</body></html>`);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
  }

  const renderTemplate = () => {
    if (!inv) return null;
    const props = { inv, company, tpl: template };
    if (template.layout === "modern") return <ModernTemplate {...props} />;
    if (template.layout === "premium") return <PremiumTemplate {...props} />;
    return <ClassicTemplate {...props} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl relative">
        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-800 text-base">Invoice Preview</span>
            {inv && <span className="text-xs text-gray-400 font-mono">{inv.invoiceNo}</span>}
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 capitalize">{template.layout}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !inv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition disabled:opacity-50"
              style={{ backgroundColor: G }}
            >
              <Printer size={14} />
              Download / Print PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Invoice body */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={32} className="animate-spin text-amber-500" />
            </div>
          ) : !inv ? (
            <div className="text-center py-16 text-gray-400">Invoice not found.</div>
          ) : (
            <div ref={printRef} className="bg-white">
              {renderTemplate()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
