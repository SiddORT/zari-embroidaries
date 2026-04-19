import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { verifyToken } from "./lib/auth";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Rich activity description builder ───────────────────────────
async function buildRichAction(
  method: string, path: string, reqBody: any, resBody: any, statusCode: number
): Promise<string> {
  const clean = path.replace(/^\/api\//, "");
  const parts = clean.split("/").filter(Boolean);
  const seg = (i: number) => parts[i] ?? "";
  const M = method.toUpperCase();
  const verb = M === "POST" ? "Created" : M === "DELETE" ? "Deleted" : "Updated";

  const rd: any = resBody?.data ?? resBody ?? {};
  const rb: any = reqBody ?? {};

  const fmt = (n: number | string | undefined) =>
    n != null ? `₹${Number(n).toLocaleString("en-IN")}` : "";

  // ── Auth ──────────────────────────────────────────────────────
  if (seg(0) === "auth") {
    if (seg(1) === "login") return `Logged in`;
    if (seg(1) === "logout") return `Logged out`;
    return `Authentication action`;
  }

  // ── Procurement: Purchase Orders ─────────────────────────────
  if (seg(0) === "procurement" && seg(1) === "purchase-orders") {
    const sub = seg(3);
    const poId = seg(2);

    if (sub === "approve" || sub === "cancel") {
      try {
        const r = await pool.query(
          "SELECT po_number, vendor_name FROM purchase_orders WHERE id = $1", [poId]
        );
        if (r.rows[0]) {
          const { po_number, vendor_name } = r.rows[0];
          return sub === "approve"
            ? `Approved Purchase Order ${po_number} — ${vendor_name}`
            : `Cancelled Purchase Order ${po_number} — ${vendor_name}`;
        }
      } catch {}
      return `${sub === "approve" ? "Approved" : "Cancelled"} Purchase Order #${poId}`;
    }

    if (M === "DELETE" && poId) {
      return `Deleted Purchase Order #${poId}`;
    }

    if (M === "POST" && !poId) {
      const poNum = rd?.po_number ?? rd?.data?.po_number;
      const vendor = rd?.vendor_name ?? rd?.data?.vendor_name ?? rb?.vendor_name;
      const items = (rb?.items ?? rb?.lines ?? []).length;
      const total = rd?.total_amount ?? rb?.total_amount;
      return [
        `Created Purchase Order${poNum ? ` ${poNum}` : ""}`,
        vendor ? `for ${vendor}` : "",
        items ? `— ${items} item${items !== 1 ? "s" : ""}` : "",
        total ? `(${fmt(total)})` : "",
      ].filter(Boolean).join(" ");
    }

    if (poId && !sub) {
      try {
        const r = await pool.query(
          "SELECT po_number, vendor_name FROM purchase_orders WHERE id = $1", [poId]
        );
        if (r.rows[0]) {
          const { po_number, vendor_name } = r.rows[0];
          return `Updated Purchase Order ${po_number} — ${vendor_name}`;
        }
      } catch {}
      return `Updated Purchase Order #${poId}`;
    }
    return `${verb} Purchase Order`;
  }

  // ── Procurement: Purchase Receipts ────────────────────────────
  if (seg(0) === "procurement" && seg(1) === "purchase-receipts") {
    const sub = seg(3);
    const prId = seg(2);

    const lookupPR = async () => {
      const r = await pool.query(
        "SELECT pr_number, vendor_name, po_number FROM purchase_receipts WHERE id = $1", [prId]
      );
      return r.rows[0] as { pr_number: string; vendor_name: string; po_number: string } | undefined;
    };

    if (sub === "confirm" || sub === "cancel") {
      try {
        const pr = await lookupPR();
        if (pr) {
          return sub === "confirm"
            ? `Confirmed Purchase Receipt ${pr.pr_number} — received goods from ${pr.vendor_name}`
            : `Cancelled Purchase Receipt ${pr.pr_number}`;
        }
      } catch {}
      return `${sub === "confirm" ? "Confirmed" : "Cancelled"} Purchase Receipt #${prId}`;
    }

    if (sub === "vendor-invoice") {
      const invNo = rb?.invoice_number;
      const invAmt = rb?.invoice_amount;
      try {
        const pr = await lookupPR();
        const base = pr ? pr.pr_number : `PR #${prId}`;
        if (M === "DELETE") return `Removed vendor invoice from ${base}`;
        return [
          `Uploaded vendor invoice`,
          invNo ? `#${invNo}` : "",
          invAmt ? `(${fmt(invAmt)})` : "",
          `to ${base}`,
        ].filter(Boolean).join(" ");
      } catch {}
      if (M === "DELETE") return `Removed vendor invoice from PR #${prId}`;
      return `Uploaded vendor invoice${invNo ? ` #${invNo}` : ""}${invAmt ? ` (${fmt(invAmt)})` : ""} to PR #${prId}`;
    }

    if (M === "DELETE" && prId && !sub) return `Deleted Purchase Receipt #${prId}`;

    if (M === "POST" && !prId) {
      const prNum = rd?.pr_number ?? rd?.data?.pr_number;
      const vendor = rd?.vendor_name ?? rd?.data?.vendor_name ?? rb?.vendor_name;
      const items = (rb?.items ?? []).length;
      return [
        `Created Purchase Receipt${prNum ? ` ${prNum}` : ""}`,
        vendor ? `from ${vendor}` : "",
        items ? `— ${items} item${items !== 1 ? "s" : ""} received` : "",
      ].filter(Boolean).join(" ");
    }

    if (prId && !sub) {
      try {
        const pr = await lookupPR();
        if (pr) return `Updated Purchase Receipt ${pr.pr_number}`;
      } catch {}
      return `Updated Purchase Receipt #${prId}`;
    }
    return `${verb} Purchase Receipt`;
  }

  // ── Quotations ────────────────────────────────────────────────
  if (seg(0) === "quotations") {
    const sub = seg(2);
    const qId = seg(1);

    if (sub === "convert-swatch") {
      const code = rd?.orderCode ?? rd?.data?.orderCode;
      return `Converted Quotation to Swatch Order${code ? ` — ${code}` : ""}`;
    }
    if (sub === "convert-style") {
      const code = rd?.orderCode ?? rd?.data?.orderCode;
      return `Converted Quotation to Style Order${code ? ` — ${code}` : ""}`;
    }
    if (sub === "revision") {
      const qNum = rd?.quotationNumber ?? rd?.data?.quotationNumber;
      return `Created new revision${qNum ? ` for Quotation ${qNum}` : " of Quotation"}`;
    }

    if (M === "POST" && !qId) {
      const qNum = rd?.quotationNumber ?? rd?.data?.quotationNumber;
      const client = rb?.clientName ?? rb?.client_name;
      return `Created Quotation${qNum ? ` ${qNum}` : ""}${client ? ` for ${client}` : ""}`;
    }

    if (qId) {
      try {
        const r = await pool.query(
          "SELECT quotation_number, client_name FROM quotations WHERE id = $1", [qId]
        );
        if (r.rows[0]) {
          const { quotation_number, client_name } = r.rows[0];
          return `Updated Quotation ${quotation_number} — ${client_name}`;
        }
      } catch {}
      return `Updated Quotation #${qId}`;
    }
    return `${verb} Quotation`;
  }

  // ── Invoices ──────────────────────────────────────────────────
  if (seg(0) === "invoices") {
    const sub = seg(2);
    const invId = seg(1);

    if (M === "POST" && !invId) {
      const invNo = rd?.invoiceNo ?? rd?.invoice_no ?? rb?.invoiceNo ?? rb?.invoice_no;
      const client = rb?.clientName ?? rb?.client_name ?? rd?.clientName;
      const total = rb?.totalAmount ?? rb?.total_amount ?? rd?.totalAmount;
      return [
        `Created Invoice${invNo ? ` ${invNo}` : ""}`,
        client ? `for ${client}` : "",
        total ? `— ${fmt(total)}` : "",
      ].filter(Boolean).join(" ");
    }

    if (invId && invId !== "next-number") {
      if (sub === "send") return `Sent Invoice #${invId} to client`;
      if (sub === "cancel") return `Cancelled Invoice #${invId}`;
      if (M === "DELETE") return `Deleted Invoice #${invId}`;
      const invNo = rb?.invoiceNo ?? rb?.invoice_no;
      return `Updated Invoice${invNo ? ` ${invNo}` : ` #${invId}`}`;
    }
    return `${verb} Invoice`;
  }

  // ── Masters ───────────────────────────────────────────────────
  if (seg(0) === "masters") {
    const typeMap: Record<string, string> = {
      clients: "Client", products: "Product", vendors: "Vendor",
      "product-categories": "Product Category", "hsn-codes": "HSN Code",
      "unit-of-measure": "Unit of Measure",
    };
    const typeName = typeMap[seg(1)] ?? seg(1).replace(/-/g, " ");
    const itemId = seg(2);
    const ident = rd?.name ?? rd?.code ?? rd?.hsn_code ?? rb?.name ?? rb?.code ?? rb?.hsn_code ?? rb?.description;
    if (M === "DELETE" && itemId) return `Deleted ${typeName}${ident ? `: ${ident}` : ` #${itemId}`}`;
    if (itemId) return `Updated ${typeName}${ident ? `: ${ident}` : ` #${itemId}`}`;
    return `Created ${typeName}${ident ? `: ${ident}` : ""}`;
  }

  // ── Clients (top-level) ───────────────────────────────────────
  if (seg(0) === "clients") {
    const itemId = seg(1);
    const ident = rd?.name ?? rb?.name;
    if (M === "DELETE" && itemId) return `Deleted Client${ident ? `: ${ident}` : ` #${itemId}`}`;
    if (itemId) return `Updated Client${ident ? `: ${ident}` : ` #${itemId}`}`;
    return `Created Client${ident ? `: ${ident}` : ""}`;
  }

  // ── HSN ───────────────────────────────────────────────────────
  if (seg(0) === "hsn") {
    const itemId = seg(1);
    const code = rb?.code ?? rd?.code;
    const desc = rb?.description ?? rd?.description;
    if (M === "DELETE" && itemId) return `Deleted HSN Code${code ? ` ${code}` : ` #${itemId}`}`;
    if (itemId) return `Updated HSN Code${code ? ` ${code}` : ` #${itemId}`}${desc ? ` — ${desc}` : ""}`;
    return `Created HSN Code${code ? ` ${code}` : ""}${desc ? ` — ${desc}` : ""}`;
  }

  // ── Settings ──────────────────────────────────────────────────
  if (seg(0) === "settings") {
    const s1 = seg(1);

    if (s1 === "currencies") {
      if (seg(2) === "base") {
        const code = rb?.code;
        return `Changed base currency${code ? ` to ${code}` : ""}`;
      }
      if (seg(3) === "toggle") {
        const code = seg(2).toUpperCase();
        const isActive = rd?.is_active ?? resBody?.is_active;
        return isActive != null
          ? `${isActive ? "Activated" : "Deactivated"} currency ${code}`
          : `Toggled currency ${code}`;
      }
    }

    if (s1 === "exchange-rates") {
      if (seg(2) === "refresh") return "Refreshed all exchange rates from live market data";
      if (seg(2)) {
        const code = seg(2).toUpperCase();
        const rate = rb?.rate;
        return `Updated exchange rate for ${code}${rate ? ` — rate set to ${rate}` : ""}`;
      }
    }

    if (s1 === "company") {
      const name = rb?.company_name ?? rd?.company_name;
      return `Updated company profile${name ? ` — ${name}` : ""}`;
    }
    if (s1 === "banks") {
      const bank = rb?.bank_name ?? rd?.bank_name;
      if (M === "DELETE") return `Removed bank account${bank ? `: ${bank}` : ""}`;
      return `${verb} bank account${bank ? `: ${bank}` : ""}`;
    }
    if (s1 === "gst") {
      const gstin = rb?.gstin ?? rd?.gstin;
      return `Updated GST settings${gstin ? ` — GSTIN: ${gstin}` : ""}`;
    }
    if (s1 === "users") {
      const name = rb?.name ?? rb?.username ?? rd?.name ?? rd?.username;
      const email = rb?.email ?? rd?.email;
      if (M === "DELETE") return `Removed user${name ? ` ${name}` : ""}${email ? ` (${email})` : ""}`;
      return `${verb} user account${name ? `: ${name}` : ""}${email ? ` (${email})` : ""}`;
    }
    if (s1 === "warehouses") {
      const name = rb?.name ?? rd?.name;
      if (M === "DELETE") return `Removed warehouse location${name ? `: ${name}` : ""}`;
      return `${verb} warehouse location${name ? `: ${name}` : ""}`;
    }
    if (s1 === "password") return "Changed account password";
    if (s1 === "profile") {
      const name = rb?.name ?? rd?.name;
      return `Updated profile${name ? ` — ${name}` : ""}`;
    }
    if (s1 === "activity-logs") return "Logged manual activity";
    return "Updated settings";
  }

  // ── Shipping ──────────────────────────────────────────────────
  if (seg(0) === "shipping") return "Updated shipping settings";

  // ── Orders ────────────────────────────────────────────────────
  if (seg(0) === "swatch-orders" || seg(0) === "orders") {
    const ordId = seg(1);
    const sub = seg(2);
    const code = rd?.order_code ?? rb?.order_code;
    const ref = code ?? (ordId ? `#${ordId}` : "");
    if (sub === "confirm") return `Confirmed Swatch Order ${ref}`;
    if (sub === "cancel") return `Cancelled Swatch Order ${ref}`;
    if (sub === "cost" || sub === "costing") return `Updated costing for Swatch Order ${ref}`;
    if (sub === "notes") return `Added note to Swatch Order ${ref}`;
    if (sub === "artworks") return `Updated artwork for Swatch Order ${ref}`;
    return `${verb} Swatch Order${ref ? ` ${ref}` : ""}`;
  }

  if (seg(0) === "style-orders") {
    const ordId = seg(1);
    const sub = seg(2);
    const code = rd?.order_code ?? rb?.order_code;
    const ref = code ?? (ordId ? `#${ordId}` : "");
    if (sub === "confirm") return `Confirmed Style Order ${ref}`;
    if (sub === "cancel") return `Cancelled Style Order ${ref}`;
    if (sub === "cost" || sub === "costing") return `Updated costing for Style Order ${ref}`;
    if (sub === "notes") return `Added note to Style Order ${ref}`;
    if (sub === "artworks") return `Updated artwork for Style Order ${ref}`;
    return `${verb} Style Order${ref ? ` ${ref}` : ""}`;
  }

  // ── Inventory ─────────────────────────────────────────────────
  if (seg(0) === "inventory") {
    const itemId = seg(1);
    const ident = rd?.item_name ?? rb?.item_name ?? rd?.name ?? rb?.name;
    if (M === "DELETE" && itemId) return `Deleted inventory item${ident ? `: ${ident}` : ` #${itemId}`}`;
    if (itemId) return `Updated inventory item${ident ? `: ${ident}` : ` #${itemId}`}`;
    return `Added inventory item${ident ? `: ${ident}` : ""}`;
  }

  // ── Fallback ──────────────────────────────────────────────────
  const resource = parts.filter(p => !/^\d+$/.test(p)).slice(0, 2).join(" → ").replace(/-/g, " ");
  return `${verb} ${resource || "record"}`;
}

// ── Activity logging middleware ──────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const isApiPath = req.path.startsWith("/api");
  const isCustomLog = req.path === "/api/settings/activity-logs/action";

  if ((!isWrite && !isCustomLog) || !isApiPath) return next();

  // Capture response body by intercepting res.json
  let capturedResponseBody: any = null;
  const originalJson = (res.json as Function).bind(res);
  (res as any).json = function (body: any) {
    capturedResponseBody = body;
    return originalJson(body);
  };

  res.on("finish", async () => {
    try {
      let userEmail = "anonymous";
      let userName = "";
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) {
        try {
          const payload = verifyToken(auth.slice(7)) as any;
          userEmail = payload?.email ?? "anonymous";
          userName = payload?.username ?? payload?.name ?? "";
        } catch {}
      }

      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        req.socket?.remoteAddress ??
        "";

      const action = await buildRichAction(
        req.method, req.path, req.body, capturedResponseBody, res.statusCode
      );

      pool.query(
        `INSERT INTO activity_logs (user_email, user_name, method, url, action, status_code, ip_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userEmail, userName, req.method, req.path, action, res.statusCode, ip]
      ).catch(() => {});
    } catch {}
  });

  next();
});

app.use("/api", router);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

export default app;
