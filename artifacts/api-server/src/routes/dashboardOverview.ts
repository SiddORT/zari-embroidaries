import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/dashboard/overview", requireAuth, async (_req, res) => {
  try {
    const [
      kpiRes,
      trendStyleRes,
      trendSwatchRes,
      styleStatusRes,
      swatchStatusRes,
      recentOrdersRes,
      invoiceStatsRes,
      activityRes,
      vendorPendingRes,
      openPrRes,
      artworkPipelineRes,
      heatmapRes,
    ] = await Promise.all([

      /* ── KPI counts ─────────────────────────────────────────── */
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM style_orders  WHERE is_deleted = false OR is_deleted IS NULL)::int  AS style_total,
          (SELECT COUNT(*) FROM style_orders  WHERE (is_deleted = false OR is_deleted IS NULL) AND order_status NOT IN ('Completed','Cancelled'))::int AS style_active,
          (SELECT COUNT(*) FROM style_orders  WHERE (is_deleted = false OR is_deleted IS NULL) AND date_trunc('month', NULLIF(order_issue_date,'')::date) = date_trunc('month', NOW()))::int AS style_this_month,
          (SELECT COUNT(*) FROM style_orders  WHERE (is_deleted = false OR is_deleted IS NULL) AND date_trunc('month', NULLIF(order_issue_date,'')::date) = date_trunc('month', NOW() - INTERVAL '1 month'))::int AS style_last_month,
          (SELECT COUNT(*) FROM swatch_orders WHERE is_deleted = false OR is_deleted IS NULL)::int  AS swatch_total,
          (SELECT COUNT(*) FROM swatch_orders WHERE (is_deleted = false OR is_deleted IS NULL) AND order_status NOT IN ('Completed','Cancelled'))::int AS swatch_active,
          (SELECT COUNT(*) FROM swatch_orders WHERE (is_deleted = false OR is_deleted IS NULL) AND date_trunc('month', NULLIF(order_issue_date,'')::date) = date_trunc('month', NOW()))::int AS swatch_this_month,
          (SELECT COUNT(*) FROM swatch_orders WHERE (is_deleted = false OR is_deleted IS NULL) AND date_trunc('month', NULLIF(order_issue_date,'')::date) = date_trunc('month', NOW() - INTERVAL '1 month'))::int AS swatch_last_month,
          (SELECT COUNT(*) FROM style_order_artworks)::int + (SELECT COUNT(*) FROM artworks)::int   AS artwork_total,
          (SELECT COUNT(DISTINCT client_id) FROM style_orders  WHERE (is_deleted = false OR is_deleted IS NULL) AND order_status NOT IN ('Completed','Cancelled') AND client_id IS NOT NULL)::int
          + (SELECT COUNT(DISTINCT client_id) FROM swatch_orders WHERE (is_deleted = false OR is_deleted IS NULL) AND order_status NOT IN ('Completed','Cancelled') AND client_id IS NOT NULL)::int AS active_clients
      `),

      /* ── Trend: style orders (last 6 months) ────────────────── */
      pool.query(`
        SELECT
          to_char(gs.month, 'Mon ''YY') AS label,
          to_char(gs.month, 'YYYY-MM')  AS month_key,
          COALESCE(cnt.c, 0)::int        AS style_qty
        FROM generate_series(
          date_trunc('month', NOW() - INTERVAL '5 months'),
          date_trunc('month', NOW()),
          INTERVAL '1 month'
        ) AS gs(month)
        LEFT JOIN (
          SELECT date_trunc('month', NULLIF(order_issue_date,'')::date) AS m, COUNT(*) AS c
          FROM style_orders
          WHERE (is_deleted = false OR is_deleted IS NULL) AND order_issue_date IS NOT NULL AND order_issue_date != ''
          GROUP BY 1
        ) cnt ON cnt.m = gs.month
        ORDER BY gs.month
      `),

      /* ── Trend: swatch orders (last 6 months) ───────────────── */
      pool.query(`
        SELECT
          to_char(gs.month, 'YYYY-MM') AS month_key,
          COALESCE(cnt.c, 0)::int       AS swatch_qty
        FROM generate_series(
          date_trunc('month', NOW() - INTERVAL '5 months'),
          date_trunc('month', NOW()),
          INTERVAL '1 month'
        ) AS gs(month)
        LEFT JOIN (
          SELECT date_trunc('month', NULLIF(order_issue_date,'')::date) AS m, COUNT(*) AS c
          FROM swatch_orders
          WHERE (is_deleted = false OR is_deleted IS NULL) AND order_issue_date IS NOT NULL AND order_issue_date != ''
          GROUP BY 1
        ) cnt ON cnt.m = gs.month
        ORDER BY gs.month
      `),

      /* ── Style order statuses ───────────────────────────────── */
      pool.query(`
        SELECT order_status AS status, COUNT(*)::int AS count
        FROM style_orders
        WHERE is_deleted = false OR is_deleted IS NULL
        GROUP BY order_status
        ORDER BY count DESC
      `),

      /* ── Swatch order statuses ──────────────────────────────── */
      pool.query(`
        SELECT order_status AS status, COUNT(*)::int AS count
        FROM swatch_orders
        WHERE is_deleted = false OR is_deleted IS NULL
        GROUP BY order_status
        ORDER BY count DESC
      `),

      /* ── Recent 5 style orders ──────────────────────────────── */
      pool.query(`
        SELECT
          order_code, client_name, order_status,
          priority,
          COALESCE(order_issue_date, '') AS order_issue_date
        FROM style_orders
        WHERE is_deleted = false OR is_deleted IS NULL
        ORDER BY id DESC
        LIMIT 5
      `),

      /* ── Invoice stats ──────────────────────────────────────── */
      pool.query(`
        SELECT
          COUNT(*)::int                                                                        AS total_count,
          COUNT(CASE WHEN invoice_status = 'Paid'  THEN 1 END)::int                          AS paid_count,
          COUNT(CASE WHEN invoice_status NOT IN ('Paid','Draft','Cancelled') THEN 1 END)::int AS pending_count,
          COUNT(CASE WHEN invoice_status = 'Draft' THEN 1 END)::int                          AS draft_count,
          COUNT(CASE WHEN invoice_status != 'Paid' AND due_date != '' AND due_date < to_char(NOW(),'YYYY-MM-DD') THEN 1 END)::int AS overdue_count,
          COALESCE(SUM(CASE WHEN invoice_status = 'Paid'  THEN base_currency_amount ELSE 0 END),0)::numeric(18,0) AS paid_amount,
          COALESCE(SUM(CASE WHEN invoice_status NOT IN ('Paid','Draft','Cancelled') THEN base_currency_amount ELSE 0 END),0)::numeric(18,0) AS pending_amount,
          COALESCE(SUM(CASE WHEN invoice_status = 'Draft' THEN base_currency_amount ELSE 0 END),0)::numeric(18,0) AS draft_amount,
          COALESCE(SUM(CASE WHEN invoice_status != 'Paid' AND due_date != '' AND due_date < to_char(NOW(),'YYYY-MM-DD') THEN base_currency_amount ELSE 0 END),0)::numeric(18,0) AS overdue_amount
        FROM invoices
        WHERE invoice_status != 'Cancelled'
      `),

      /* ── Activity feed (last 8) ─────────────────────────────── */
      pool.query(`
        SELECT user_name, action, url, created_at
        FROM activity_logs
        ORDER BY created_at DESC
        LIMIT 8
      `),

      /* ── Vendor pending ─────────────────────────────────────── */
      pool.query(`
        SELECT
          COALESCE(SUM(pending_amount),0)::numeric(18,0) AS total_pending,
          COUNT(*)::int                                   AS bill_count
        FROM vendor_invoice_ledger
        WHERE status != 'Paid'
      `),

      /* ── Open purchase receipts ─────────────────────────────── */
      pool.query(`
        SELECT COUNT(*)::int AS open_pr_count
        FROM purchase_receipts
        WHERE status = 'Open'
      `),

      /* ── Artwork pipeline (swatch artworks with status) ─────── */
      pool.query(`
        SELECT
          COALESCE(feedback_status, 'Pending') AS status,
          COUNT(*)::int AS count
        FROM artworks
        GROUP BY feedback_status
        UNION ALL
        SELECT 'Style Artworks' AS status, COUNT(*)::int AS count
        FROM style_order_artworks
      `),

      /* ── Priority × Status heatmap (style orders) ───────────── */
      pool.query(`
        SELECT
          priority,
          order_status AS status,
          COUNT(*)::int AS count
        FROM style_orders
        WHERE (is_deleted = false OR is_deleted IS NULL)
          AND priority IS NOT NULL
        GROUP BY priority, order_status
        ORDER BY priority, order_status
      `),
    ]);

    /* ── build trend ────────────────────────────────────────── */
    const swatchMap: Record<string, number> = {};
    trendSwatchRes.rows.forEach((r: any) => { swatchMap[r.month_key] = r.swatch_qty; });
    const trend = trendStyleRes.rows.map((r: any) => ({
      month:      r.label,
      month_key:  r.month_key,
      styleQty:   r.style_qty,
      swatchQty:  swatchMap[r.month_key] ?? 0,
    }));

    /* ── build heatmap ──────────────────────────────────────── */
    const priorities = ["Urgent", "High", "Medium", "Low"];
    const statuses   = ["Draft", "Issued", "In Progress", "Completed", "Cancelled"];
    const heatRaw: Record<string, Record<string, number>> = {};
    heatmapRes.rows.forEach((r: any) => {
      if (!heatRaw[r.priority]) heatRaw[r.priority] = {};
      heatRaw[r.status]
        ? (heatRaw[r.priority][r.status] = r.count)
        : (heatRaw[r.priority][r.status] = r.count);
    });
    const heatmap = priorities.map(p => ({
      priority: p,
      values:   statuses.map(s => heatmapRes.rows.find((r: any) => r.priority === p && r.status === s)?.count ?? 0),
    }));

    /* ── kpi ────────────────────────────────────────────────── */
    const k = kpiRes.rows[0];
    const stylePct  = k.style_last_month  > 0 ? (((k.style_this_month  - k.style_last_month)  / k.style_last_month)  * 100).toFixed(1) : null;
    const swatchPct = k.swatch_last_month > 0 ? (((k.swatch_this_month - k.swatch_last_month) / k.swatch_last_month) * 100).toFixed(1) : null;

    /* ── invoice stats ──────────────────────────────────────── */
    const iv = invoiceStatsRes.rows[0];
    function fmtINR(n: number): string {
      if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
      if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
      if (n >= 1_000)       return `₹${(n / 1_000).toFixed(0)}K`;
      return `₹${n}`;
    }

    const vp = vendorPendingRes.rows[0];

    res.json({
      kpi: {
        styleOrders:   { total: k.style_total,  active: k.style_active,  thisMonth: k.style_this_month,  pctChange: stylePct  },
        swatchOrders:  { total: k.swatch_total, active: k.swatch_active, thisMonth: k.swatch_this_month, pctChange: swatchPct },
        artworks:      { total: k.artwork_total },
        activeClients: { total: k.active_clients },
      },
      trend,
      styleStatuses:  styleStatusRes.rows,
      swatchStatuses: swatchStatusRes.rows,
      recentOrders:   recentOrdersRes.rows.map((r: any) => ({
        code:     r.order_code,
        client:   r.client_name ?? "—",
        status:   r.order_status,
        priority: r.priority ?? "Medium",
        date:     r.order_issue_date
          ? new Date(r.order_issue_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
          : "—",
      })),
      invoiceStats: {
        generated: { count: iv.draft_count,    amount: fmtINR(parseFloat(iv.draft_amount))   },
        pending:   { count: iv.pending_count,  amount: fmtINR(parseFloat(iv.pending_amount)) },
        completed: { count: iv.paid_count,     amount: fmtINR(parseFloat(iv.paid_amount))    },
        overdue:   { count: iv.overdue_count,  amount: fmtINR(parseFloat(iv.overdue_amount)) },
      },
      activityFeed: activityRes.rows.map((r: any, idx: number) => ({
        user:     r.user_name ?? "System",
        initials: (r.user_name ?? "S").charAt(0).toUpperCase(),
        action:   r.action ?? "Performed action",
        time:     timeAgo(new Date(r.created_at)),
        refPath:  "/" + (r.url ?? "").replace(/^\//, "").split("/")[0],
        ref:      extractRef(r.url ?? ""),
      })),
      vendorPending: {
        totalPending: parseFloat(vp.total_pending),
        formatted:    fmtINR(parseFloat(vp.total_pending)),
        billCount:    vp.bill_count,
      },
      openPrCount: openPrRes.rows[0].open_pr_count,
      artworkPipeline: artworkPipelineRes.rows,
      heatmap,
    });
  } catch (e: any) {
    console.error("Dashboard overview error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} hr ago`;
  return `${Math.floor(secs / 86400)} days ago`;
}

function extractRef(url: string): string {
  const parts = url.replace(/^\//, "").split("/");
  if (parts.length >= 2 && parts[1]) return `#${parts[1]}`;
  return parts[0] ? parts[0].toUpperCase() : "—";
}

export default router;
