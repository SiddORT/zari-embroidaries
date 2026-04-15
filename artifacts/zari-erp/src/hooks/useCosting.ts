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
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["swatch-prs"] }); },
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
