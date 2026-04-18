import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Plus, Trash2, Search, CheckCircle2, XCircle,
  Clock, AlertTriangle, Package, IndianRupee, Save,
} from "lucide-react";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import TopNavbar from "@/components/layout/TopNavbar";
import { useToast } from "@/hooks/use-toast";

const G     = "#C6AF4B";
const G_DIM = "#A8943E";
const card  = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";

const STATUS_MAP: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  draft:     { label: "Draft",     color: "bg-gray-100 text-gray-700",   Icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700",     Icon: XCircle },
};

interface InventoryOption {
  id: number;
  item_name: string;
  item_code: string;
  unit_type: string | null;
  available_stock: string;
  current_stock: string;
  average_price: string;
  warehouse_location: string | null;
}

interface LineItem {
  key: string;
  inventoryItemId: number | null;
  itemName: string;
  itemCode: string;
  unitType: string;
  availableStock: string;
  quantity: string;
  unitPrice: string;
  warehouseLocation: string;
  remarks: string;
}

interface PRDetail {
  id: number;
  pr_number: string;
  vendor_id: number | null;
  vendor_name: string | null;
  pr_date: string;
  status: string;
  total_amount: string;
  remarks: string | null;
  created_by: string | null;
  items: Array<{
    id: number;
    inventory_item_id: number;
    item_name: string;
    item_code: string;
    quantity: string;
    unit_price: string;
    unit_type: string | null;
    warehouse_location: string | null;
    available_stock: string;
    remarks: string | null;
  }>;
}

function mkKey() { return Math.random().toString(36).slice(2); }

function fmtAmt(s: string | number) {
  const n = parseFloat(String(s));
  return isNaN(n) ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function ItemSearchDrop({
  value, onChange, onSelect, options,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: InventoryOption) => void;
  options: InventoryOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = options.filter(o =>
    o.item_name.toLowerCase().includes(value.toLowerCase()) ||
    o.item_code.toLowerCase().includes(value.toLowerCase())
  ).slice(0, 30);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
        <input
          type="text"
          placeholder="Search item…"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          className="w-full pl-7 pr-2 py-1.5 text-xs text-gray-900 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#C6AF4B]/50"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-40 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto min-w-[280px]">
          {filtered.map(it => (
            <button key={it.id} onClick={() => { onSelect(it); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-[#C6AF4B]/10 border-b border-gray-50 last:border-0">
              <div className="text-xs font-semibold text-gray-900">{it.item_name}</div>
              <div className="text-[11px] text-gray-400 flex gap-2 mt-0.5">
                <span>{it.item_code}</span>
                <span>Avail: {parseFloat(it.available_stock).toFixed(3)} {it.unit_type ?? ""}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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

  const [pr, setPr] = useState<PRDetail | null>(null);
  const [loadingPr, setLoadingPr] = useState(!isNew);

  const [inventoryItems, setInventoryItems] = useState<InventoryOption[]>([]);

  // form state
  const [vendorName, setVendorName]   = useState("");
  const [prDate, setPrDate]           = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks]         = useState("");
  const [lineItems, setLineItems]     = useState<LineItem[]>([
    { key: mkKey(), inventoryItemId: null, itemName: "", itemCode: "", unitType: "", availableStock: "0", quantity: "", unitPrice: "", warehouseLocation: "", remarks: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning]   = useState(false);

  useEffect(() => { if (isError) navigate("/login"); }, [isError, navigate]);

  useEffect(() => {
    if (!token) return;
    customFetch(`/api/inventory/items?limit=200&sort=item_name&order=asc&_t=${Date.now()}`)
      .then((r: unknown) => setInventoryItems((r as { data: InventoryOption[] }).data))
      .catch(() => {});
  }, [token]);

  const loadPr = useCallback(() => {
    if (!prId || !token) return;
    setLoadingPr(true);
    customFetch(`/api/purchase-receipts/${prId}`)
      .then((r: unknown) => {
        const d = r as PRDetail;
        setPr(d);
        setVendorName(d.vendor_name ?? "");
        setPrDate(d.pr_date);
        setRemarks(d.remarks ?? "");
        setLineItems(d.items.map(it => ({
          key: mkKey(),
          inventoryItemId: it.inventory_item_id,
          itemName: it.item_name,
          itemCode: it.item_code,
          unitType: it.unit_type ?? "",
          availableStock: it.available_stock ?? "0",
          quantity: parseFloat(it.quantity).toFixed(3),
          unitPrice: parseFloat(it.unit_price).toFixed(2),
          warehouseLocation: it.warehouse_location ?? "",
          remarks: it.remarks ?? "",
        })));
      })
      .catch(() => toast({ title: "Failed to load PR", variant: "destructive" }))
      .finally(() => setLoadingPr(false));
  }, [prId, token, toast]);

  useEffect(() => { if (!isNew) loadPr(); }, [isNew, loadPr]);

  const totalAmount = lineItems.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);

  const addLine = () => setLineItems(ls => [
    ...ls,
    { key: mkKey(), inventoryItemId: null, itemName: "", itemCode: "", unitType: "", availableStock: "0", quantity: "", unitPrice: "", warehouseLocation: "", remarks: "" },
  ]);

  const removeLine = (key: string) => setLineItems(ls => ls.filter(l => l.key !== key));

  const updateLine = (key: string, patch: Partial<LineItem>) =>
    setLineItems(ls => ls.map(l => l.key === key ? { ...l, ...patch } : l));

  const selectItem = (key: string, item: InventoryOption) => {
    updateLine(key, {
      inventoryItemId: item.id,
      itemName: item.item_name,
      itemCode: item.item_code,
      unitType: item.unit_type ?? "",
      availableStock: item.available_stock ?? "0",
      warehouseLocation: item.warehouse_location ?? "",
      unitPrice: item.average_price ? parseFloat(item.average_price).toFixed(2) : "",
    });
  };

  const buildPayload = (confirmNow: boolean) => ({
    vendorName: vendorName.trim() || null,
    prDate,
    remarks: remarks.trim() || null,
    confirmNow,
    items: lineItems.filter(l => l.inventoryItemId).map(l => ({
      inventoryItemId: l.inventoryItemId,
      itemName: l.itemName,
      itemCode: l.itemCode,
      quantity: l.quantity,
      unitPrice: l.unitPrice || "0",
      warehouseLocation: l.warehouseLocation || null,
      remarks: l.remarks || null,
    })),
  });

  const validate = () => {
    if (!prDate) { toast({ title: "PR date is required", variant: "destructive" }); return false; }
    const valid = lineItems.filter(l => l.inventoryItemId);
    if (!valid.length) { toast({ title: "Add at least one item", variant: "destructive" }); return false; }
    for (const l of valid) {
      if (!l.quantity || parseFloat(l.quantity) <= 0) {
        toast({ title: `Enter a valid quantity for ${l.itemName}`, variant: "destructive" }); return false;
      }
    }
    return true;
  };

  const handleSave = async (confirmNow: boolean) => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isNew) {
        const r = await customFetch("/api/purchase-receipts", {
          method: "POST",
          body: JSON.stringify(buildPayload(confirmNow)),
        }) as { id: number; pr_number: string; message: string };
        toast({ title: r.message });
        navigate(`/inventory/purchase-receipts/${r.id}`);
      } else {
        await customFetch(`/api/purchase-receipts/${prId}`, {
          method: "PUT",
          body: JSON.stringify(buildPayload(false)),
        });
        toast({ title: "PR updated successfully" });
        loadPr();
      }
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to save PR", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    setActioning(true);
    try {
      const r = await customFetch(`/api/purchase-receipts/${prId}/confirm`, { method: "POST" }) as { message: string };
      toast({ title: r.message });
      loadPr();
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to confirm", variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const handleCancel = async () => {
    setActioning(true);
    try {
      const r = await customFetch(`/api/purchase-receipts/${prId}/cancel`, { method: "POST" }) as { message: string };
      toast({ title: r.message });
      loadPr();
    } catch (e: unknown) {
      toast({ title: (e as { message?: string })?.message ?? "Failed to cancel", variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const isReadOnly = pr && pr.status !== "draft";
  const StatusBadge = ({ s }: { s: string }) => {
    const info = STATUS_MAP[s] ?? STATUS_MAP.draft;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${info.color}`}>
        <info.Icon className="h-3.5 w-3.5" /> {info.label}
      </span>
    );
  };

  if (loadingPr) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F6F0" }}>
        <div className="h-10 w-10 rounded-full border-2 border-[#C6AF4B] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
      <TopNavbar
        username={(me as { name?: string } | undefined)?.name ?? ""}
        role={(me as { role?: string } | undefined)?.role ?? ""}
        onLogout={handleLogout}
        isLoggingOut={false}
      />

      <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/inventory/purchase-receipts")}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-700" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {isNew ? "New Purchase Receipt" : pr?.pr_number ?? "Purchase Receipt"}
                </h1>
                {pr && <StatusBadge s={pr.status} />}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {isNew ? "Record stock received from vendor" : `Created by ${pr?.created_by ?? "—"}`}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <>
                {!isNew && (
                  <button onClick={() => handleSave(false)} disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    <Save className="h-4 w-4" /> Save Draft
                  </button>
                )}
                <button onClick={() => handleSave(isNew)} disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                  style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? "Saving…" : isNew ? "Save & Confirm" : "Save as Draft"}
                </button>
              </>
            )}
            {!isNew && pr?.status === "draft" && (
              <button onClick={handleConfirm} disabled={actioning}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors">
                <CheckCircle2 className="h-4 w-4" /> {actioning ? "Confirming…" : "Confirm PR"}
              </button>
            )}
            {!isNew && pr?.status !== "cancelled" && (
              <button onClick={handleCancel} disabled={actioning}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-orange-600 border border-orange-200 hover:bg-orange-50 disabled:opacity-50 transition-colors">
                <XCircle className="h-4 w-4" /> {actioning ? "Cancelling…" : "Cancel PR"}
              </button>
            )}
          </div>
        </div>

        {/* Status banner for confirmed */}
        {pr?.status === "confirmed" && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            Inventory Updated Successfully — stock levels have been adjusted based on this receipt.
          </div>
        )}
        {pr?.status === "cancelled" && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 text-sm font-medium">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
            This PR is cancelled. If it was previously confirmed, inventory changes have been reversed.
          </div>
        )}

        {/* PR Header Card */}
        <div className={`${card} p-5`}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Receipt Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vendor Name</label>
              <input type="text" placeholder="e.g. Sharma Fabrics" value={vendorName}
                onChange={e => setVendorName(e.target.value)} disabled={!!isReadOnly}
                className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">PR Date <span className="text-red-500">*</span></label>
              <input type="date" value={prDate} onChange={e => setPrDate(e.target.value)} disabled={!!isReadOnly}
                className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
              <input type="text" placeholder="Optional notes…" value={remarks}
                onChange={e => setRemarks(e.target.value)} disabled={!!isReadOnly}
                className="w-full px-3 py-2 text-sm text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className={card}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color: G }} />
              <h2 className="text-sm font-semibold text-gray-900">Items Received</h2>
              <span className="text-xs text-gray-400">({lineItems.filter(l => l.inventoryItemId).length} item{lineItems.filter(l => l.inventoryItemId).length !== 1 ? "s" : ""})</span>
            </div>
            {!isReadOnly && (
              <button onClick={addLine}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[#C6AF4B]/30 text-[#A8943E] hover:bg-[#C6AF4B]/10 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Item
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8F6F0] border-b border-[#C6AF4B]/15">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide w-[280px]">Item</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Avail Stock</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Qty Received <span className="text-red-400">*</span></th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Unit Price (₹)</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Amount</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Location</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Remarks</th>
                  {!isReadOnly && <th className="px-3 py-2.5 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lineItems.map((line, idx) => (
                  <tr key={line.key} className="hover:bg-[#C6AF4B]/5">
                    <td className="px-3 py-2">
                      {isReadOnly ? (
                        <div>
                          <div className="text-xs font-semibold text-gray-900">{line.itemName}</div>
                          <div className="text-[11px] text-gray-400">{line.itemCode}</div>
                        </div>
                      ) : (
                        <ItemSearchDrop
                          value={line.itemName || ""}
                          onChange={v => updateLine(line.key, { itemName: v, inventoryItemId: null })}
                          onSelect={item => selectItem(line.key, item)}
                          options={inventoryItems}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-gray-500">
                        {line.inventoryItemId ? parseFloat(line.availableStock).toFixed(3) : "—"}
                        {line.unitType ? <span className="ml-1 text-[11px] text-gray-400">{line.unitType}</span> : null}
                      </span>
                    </td>
                    <td className="px-3 py-2 w-[110px]">
                      {isReadOnly ? (
                        <span className="text-xs font-semibold text-gray-900">{parseFloat(line.quantity).toFixed(3)}</span>
                      ) : (
                        <input type="number" placeholder="0.000" min="0" step="0.001"
                          value={line.quantity}
                          onChange={e => updateLine(line.key, { quantity: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs text-gray-900 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#C6AF4B]/50" />
                      )}
                    </td>
                    <td className="px-3 py-2 w-[110px]">
                      {isReadOnly ? (
                        <span className="text-xs text-gray-900">{fmtAmt(line.unitPrice)}</span>
                      ) : (
                        <input type="number" placeholder="0.00" min="0" step="0.01"
                          value={line.unitPrice}
                          onChange={e => updateLine(line.key, { unitPrice: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs text-gray-900 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#C6AF4B]/50" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-semibold text-gray-900">
                        {line.quantity && line.unitPrice
                          ? `₹${((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 w-[130px]">
                      {isReadOnly ? (
                        <span className="text-xs text-gray-500">{line.warehouseLocation || "—"}</span>
                      ) : (
                        <input type="text" placeholder="e.g. Rack A-1"
                          value={line.warehouseLocation}
                          onChange={e => updateLine(line.key, { warehouseLocation: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs text-gray-900 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#C6AF4B]/50" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isReadOnly ? (
                        <span className="text-xs text-gray-500">{line.remarks || "—"}</span>
                      ) : (
                        <input type="text" placeholder="Optional…"
                          value={line.remarks}
                          onChange={e => updateLine(line.key, { remarks: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs text-gray-900 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#C6AF4B]/50" />
                      )}
                    </td>
                    {!isReadOnly && (
                      <td className="px-3 py-2">
                        {lineItems.length > 1 && (
                          <button onClick={() => removeLine(line.key)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex items-center justify-end gap-4 px-5 py-4 border-t border-gray-100 bg-[#FDFBF2] rounded-b-2xl">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 font-medium">Total Amount:</span>
              <span className="text-lg font-bold text-gray-900">
                {totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, style: "currency", currency: "INR" })}
              </span>
            </div>
          </div>
        </div>

        {/* Save actions (bottom) */}
        {!isReadOnly && (
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => navigate("/inventory/purchase-receipts")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
              Discard
            </button>
            {!isNew && (
              <button onClick={() => handleSave(false)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <Save className="h-4 w-4" /> {submitting ? "Saving…" : "Save Draft"}
              </button>
            )}
            <button onClick={() => handleSave(isNew)} disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
              style={{ background: `linear-gradient(135deg, ${G}, ${G_DIM})` }}>
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? "Saving…" : isNew ? "Save & Confirm" : "Save as Draft"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
