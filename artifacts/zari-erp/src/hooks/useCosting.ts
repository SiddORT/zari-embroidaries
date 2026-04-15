import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface MaterialSearchResult {
  id: number;
  type: "material" | "fabric";
  code: string;
  name: string;
  currentStock: string;
  avgUnitPrice: string;
  unitType: string;
  warehouseLocation: string;
}

export interface BomRecord {
  id: number;
  swatchOrderId: number;
  materialType: string;
  materialId: number;
  materialCode: string;
  materialName: string;
  currentStock: string;
  avgUnitPrice: string;
  unitType: string;
  warehouseLocation: string;
  requiredQty: string;
  estimatedAmount: string;
  consumedQty: string;
  createdAt: string;
}

export interface PoLineItem {
  bomRowId: number;
  materialCode: string;
  materialName: string;
  unitType: string;
  targetPrice: string;
  quantity: string;
}

export interface PurchaseOrderRecord {
  id: number;
  poNumber: string;
  swatchOrderId: number;
  vendorId: number;
  vendorName: string;
  poDate: string;
  status: string;
  notes: string | null;
  bomRowIds: number[];
  bomItems: PoLineItem[];
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface PurchaseReceiptRecord {
  id: number;
  prNumber: string;
  poId: number;
  bomRowId: number | null;
  swatchOrderId: number;
  vendorName: string;
  receivedDate: string;
  receivedQty: string;
  actualPrice: string;
  warehouseLocation: string;
  status: string;
  createdAt: string;
}

export interface PrPaymentRecord {
  id: number;
  prId: number;
  paymentType: string;
  paymentDate: string;
  paymentMode: string;
  amount: string;
  transactionStatus: string;
  paymentStatus: string;
  attachment: { name: string; type: string; data: string; size: number } | null;
  createdAt: string;
}

export function useMaterialSearch(q: string) {
  return useQuery({
    queryKey: ["costing-material-search", q],
    queryFn: () => customFetch<{ data: MaterialSearchResult[] }>(`/api/costing/material-search?q=${encodeURIComponent(q)}`).then(r => r.data),
    enabled: q.length >= 1,
    staleTime: 30_000,
  });
}

export function useSwatchBom(swatchOrderId: number) {
  return useQuery({
    queryKey: ["swatch-bom", swatchOrderId],
    queryFn: () => customFetch<{ data: BomRecord[] }>(`/api/costing/bom/${swatchOrderId}`).then(r => r.data),
    enabled: !!swatchOrderId,
  });
}

export function useAddBomRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: BomRecord }>("/api/costing/bom", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["swatch-bom"] }); },
  });
}

export function useUpdateBomRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; consumedQty?: string }) =>
      customFetch<{ data: BomRecord }>(`/api/costing/bom/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["swatch-bom"] }); },
  });
}

export function useDeleteBomRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/bom/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["swatch-bom"] }); },
  });
}

export function useSwatchPOs(swatchOrderId: number) {
  return useQuery({
    queryKey: ["swatch-pos", swatchOrderId],
    queryFn: () => customFetch<{ data: PurchaseOrderRecord[] }>(`/api/costing/po/${swatchOrderId}`).then(r => r.data),
    enabled: !!swatchOrderId,
  });
}

export function useCreatePO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: PurchaseOrderRecord }>("/api/costing/po", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["swatch-pos"] }); },
  });
}

export function useUpdatePO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; status?: string; notes?: string }) =>
      customFetch<{ data: PurchaseOrderRecord }>(`/api/costing/po/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["swatch-pos"] }); },
  });
}

export function useDeletePO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/po/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["swatch-pos"] }); },
  });
}

export function useSwatchPRs(swatchOrderId: number) {
  return useQuery({
    queryKey: ["swatch-prs", swatchOrderId],
    queryFn: () => customFetch<{ data: PurchaseReceiptRecord[] }>(`/api/costing/pr/${swatchOrderId}`).then(r => r.data),
    enabled: !!swatchOrderId,
  });
}

export function useCreatePR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: PurchaseReceiptRecord }>("/api/costing/pr", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["swatch-prs"] });
      void qc.invalidateQueries({ queryKey: ["swatch-pos"] });
    },
  });
}

export function useUpdatePR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; status?: string }) =>
      customFetch<{ data: PurchaseReceiptRecord }>(`/api/costing/pr/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["swatch-prs"] }); },
  });
}

export function useDeletePR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/pr/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["swatch-prs"] }); },
  });
}

export function usePrPayments(prId: number | null) {
  return useQuery({
    queryKey: ["pr-payments", prId],
    queryFn: () => customFetch<{ data: PrPaymentRecord[] }>(`/api/costing/payments/${prId}`).then(r => r.data),
    enabled: !!prId,
  });
}

export function useAddPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: PrPaymentRecord }>("/api/costing/payments", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["pr-payments"] }); },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/payments/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["pr-payments"] }); },
  });
}

export interface ConsumptionLogRecord {
  id: number;
  swatchOrderId: number;
  bomRowId: number;
  materialCode: string;
  materialName: string;
  materialType: string;
  unitType: string;
  consumedQty: string;
  consumedBy: string;
  consumedAt: string;
  notes: string | null;
  createdAt: string;
}

export function useSwatchConsumptionLog(swatchOrderId: number) {
  return useQuery({
    queryKey: ["consumption-log", swatchOrderId],
    queryFn: () => customFetch<{ data: ConsumptionLogRecord[] }>(`/api/costing/consumption/${swatchOrderId}`).then(r => r.data),
    enabled: !!swatchOrderId,
  });
}

export function useAddConsumptionEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: ConsumptionLogRecord }>("/api/costing/consumption", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consumption-log"] });
      void qc.invalidateQueries({ queryKey: ["swatch-bom"] });
    },
  });
}

export function useDeleteConsumptionEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/consumption/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consumption-log"] });
      void qc.invalidateQueries({ queryKey: ["swatch-bom"] });
    },
  });
}

// ─── Vendor / HSN search for outsource jobs ───────────────────────────────────
export interface VendorSearchResult {
  id: number;
  brandName: string;
  vendorCode: string;
  contactName: string;
}
export interface HsnSearchResult {
  id: number;
  hsnCode: string;
  gstPercentage: string;
  govtDescription: string;
}

export function useVendorSearch(q: string) {
  return useQuery({
    queryKey: ["costing-vendor-search", q],
    queryFn: () => customFetch<{ data: VendorSearchResult[] }>(`/api/costing/vendor-search?q=${encodeURIComponent(q)}`).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useHsnSearch(q: string) {
  return useQuery({
    queryKey: ["costing-hsn-search", q],
    queryFn: () => customFetch<{ data: HsnSearchResult[] }>(`/api/costing/hsn-search?q=${encodeURIComponent(q)}`).then(r => r.data),
    staleTime: 30_000,
  });
}

// ─── Artisan Timesheets ───────────────────────────────────────────────────────
export interface ArtisanTimesheetRecord {
  id: number;
  swatchOrderId: number;
  noOfArtisans: number;
  startDate: string;
  endDate: string;
  shiftType: string;
  totalHours: string;
  hourlyRate: string;
  totalRate: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export function useArtisanTimesheets(swatchOrderId: number) {
  return useQuery({
    queryKey: ["artisan-timesheets", swatchOrderId],
    queryFn: () => customFetch<{ data: ArtisanTimesheetRecord[] }>(`/api/costing/artisan-timesheets/${swatchOrderId}`).then(r => r.data),
    enabled: !!swatchOrderId,
  });
}

export function useCreateArtisanTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: ArtisanTimesheetRecord }>("/api/costing/artisan-timesheets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["artisan-timesheets"] }); },
  });
}

export function useDeleteArtisanTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/artisan-timesheets/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["artisan-timesheets"] }); },
  });
}

// ─── Outsource Jobs ───────────────────────────────────────────────────────────
export interface OutsourceJobRecord {
  id: number;
  swatchOrderId: number;
  vendorId: number;
  vendorName: string;
  hsnId: number;
  hsnCode: string;
  gstPercentage: string;
  issueDate: string;
  targetDate: string | null;
  deliveryDate: string | null;
  totalCost: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export function useOutsourceJobs(swatchOrderId: number) {
  return useQuery({
    queryKey: ["outsource-jobs", swatchOrderId],
    queryFn: () => customFetch<{ data: OutsourceJobRecord[] }>(`/api/costing/outsource-jobs/${swatchOrderId}`).then(r => r.data),
    enabled: !!swatchOrderId,
  });
}

export function useCreateOutsourceJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: OutsourceJobRecord }>("/api/costing/outsource-jobs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["outsource-jobs"] }); },
  });
}

export function useDeleteOutsourceJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/outsource-jobs/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["outsource-jobs"] }); },
  });
}

// ─── Custom Charges ───────────────────────────────────────────────────────────
export interface CustomChargeRecord {
  id: number;
  swatchOrderId: number;
  vendorId: number;
  vendorName: string;
  hsnId: number;
  hsnCode: string;
  gstPercentage: string;
  description: string;
  unitPrice: string;
  quantity: string;
  totalAmount: string;
  createdBy: string;
  createdAt: string;
}

export function useCustomCharges(swatchOrderId: number) {
  return useQuery({
    queryKey: ["custom-charges", swatchOrderId],
    queryFn: () => customFetch<{ data: CustomChargeRecord[] }>(`/api/costing/custom-charges/${swatchOrderId}`).then(r => r.data),
    enabled: !!swatchOrderId,
  });
}

export function useCreateCustomCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: CustomChargeRecord }>("/api/costing/custom-charges", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["custom-charges"] }); },
  });
}

export function useDeleteCustomCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/custom-charges/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["custom-charges"] }); },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE ORDER COSTING HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useStyleBom(styleOrderId: number) {
  return useQuery({
    queryKey: ["style-bom", styleOrderId],
    queryFn: () => customFetch<{ data: BomRecord[] }>(`/api/costing/style-bom/${styleOrderId}`).then(r => r.data),
    enabled: !!styleOrderId,
  });
}

export function useAddStyleBomRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: BomRecord }>("/api/costing/style-bom", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-bom"] }); },
  });
}

export function useUpdateStyleBomRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; consumedQty?: string }) =>
      customFetch<{ data: BomRecord }>(`/api/costing/bom/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-bom"] }); },
  });
}

export function useDeleteStyleBomRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/bom/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-bom"] }); },
  });
}

export function useStylePOs(styleOrderId: number) {
  return useQuery({
    queryKey: ["style-pos", styleOrderId],
    queryFn: () => customFetch<{ data: PurchaseOrderRecord[] }>(`/api/costing/style-po/${styleOrderId}`).then(r => r.data),
    enabled: !!styleOrderId,
  });
}

export function useCreateStylePO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: PurchaseOrderRecord }>("/api/costing/style-po", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-pos"] }); },
  });
}

export function useUpdateStylePO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; status?: string; notes?: string }) =>
      customFetch<{ data: PurchaseOrderRecord }>(`/api/costing/po/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-pos"] }); },
  });
}

export function useDeleteStylePO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/po/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-pos"] }); },
  });
}

export function useStylePRs(styleOrderId: number) {
  return useQuery({
    queryKey: ["style-prs", styleOrderId],
    queryFn: () => customFetch<{ data: PurchaseReceiptRecord[] }>(`/api/costing/style-pr/${styleOrderId}`).then(r => r.data),
    enabled: !!styleOrderId,
  });
}

export function useCreateStylePR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: PurchaseReceiptRecord }>("/api/costing/style-pr", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["style-prs"] });
      void qc.invalidateQueries({ queryKey: ["style-pos"] });
    },
  });
}

export function useUpdateStylePR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; status?: string }) =>
      customFetch<{ data: PurchaseReceiptRecord }>(`/api/costing/pr/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-prs"] }); },
  });
}

export function useDeleteStylePR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/pr/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-prs"] }); },
  });
}

export interface StyleConsumptionLogRecord extends ConsumptionLogRecord {
  styleOrderId: number | null;
  styleOrderProductId: number | null;
  styleOrderProductName: string | null;
}

export function useStyleConsumptionLog(styleOrderId: number) {
  return useQuery({
    queryKey: ["style-consumption-log", styleOrderId],
    queryFn: () => customFetch<{ data: StyleConsumptionLogRecord[] }>(`/api/costing/style-consumption/${styleOrderId}`).then(r => r.data),
    enabled: !!styleOrderId,
  });
}

export function useAddStyleConsumptionEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: StyleConsumptionLogRecord }>("/api/costing/style-consumption", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["style-consumption-log"] });
      void qc.invalidateQueries({ queryKey: ["style-bom"] });
    },
  });
}

export function useDeleteStyleConsumptionEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/consumption/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["style-consumption-log"] });
      void qc.invalidateQueries({ queryKey: ["style-bom"] });
    },
  });
}

export interface StyleArtisanTimesheetRecord extends ArtisanTimesheetRecord {
  styleOrderId: number | null;
  styleOrderProductId: number | null;
  styleOrderProductName: string | null;
}

export function useStyleArtisanTimesheets(styleOrderId: number) {
  return useQuery({
    queryKey: ["style-artisan-timesheets", styleOrderId],
    queryFn: () => customFetch<{ data: StyleArtisanTimesheetRecord[] }>(`/api/costing/style-artisan-timesheets/${styleOrderId}`).then(r => r.data),
    enabled: !!styleOrderId,
  });
}

export function useCreateStyleArtisanTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: StyleArtisanTimesheetRecord }>("/api/costing/style-artisan-timesheets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-artisan-timesheets"] }); },
  });
}

export function useDeleteStyleArtisanTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/artisan-timesheets/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-artisan-timesheets"] }); },
  });
}

export interface StyleOutsourceJobRecord extends OutsourceJobRecord {
  styleOrderId: number | null;
  styleOrderProductId: number | null;
  styleOrderProductName: string | null;
}

export function useStyleOutsourceJobs(styleOrderId: number) {
  return useQuery({
    queryKey: ["style-outsource-jobs", styleOrderId],
    queryFn: () => customFetch<{ data: StyleOutsourceJobRecord[] }>(`/api/costing/style-outsource-jobs/${styleOrderId}`).then(r => r.data),
    enabled: !!styleOrderId,
  });
}

export function useCreateStyleOutsourceJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: StyleOutsourceJobRecord }>("/api/costing/style-outsource-jobs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-outsource-jobs"] }); },
  });
}

export function useDeleteStyleOutsourceJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/outsource-jobs/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-outsource-jobs"] }); },
  });
}

export interface StyleCustomChargeRecord extends CustomChargeRecord {
  styleOrderId: number | null;
  styleOrderProductId: number | null;
  styleOrderProductName: string | null;
}

export function useStyleCustomCharges(styleOrderId: number) {
  return useQuery({
    queryKey: ["style-custom-charges", styleOrderId],
    queryFn: () => customFetch<{ data: StyleCustomChargeRecord[] }>(`/api/costing/style-custom-charges/${styleOrderId}`).then(r => r.data),
    enabled: !!styleOrderId,
  });
}

export function useCreateStyleCustomCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => customFetch<{ data: StyleCustomChargeRecord }>("/api/costing/style-custom-charges", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-custom-charges"] }); },
  });
}

export function useDeleteStyleCustomCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ success: boolean }>(`/api/costing/custom-charges/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["style-custom-charges"] }); },
  });
}
