import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type OrderRecord = {
  id: number;
  orderId: string;
  orderType: "swatch" | "style";
  client: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  deliveryDate: string | null;
  remarks: string | null;
  productionMode: string;
  costStatus: string;
  approvalStatus: string;
  invoiceStatus: string;
  invoiceNumber: string | null;
  paymentStatus: string;
  fabric: string | null;
  swatchLength: string | null;
  swatchWidth: string | null;
  quantity: string | null;
  referenceSwatchId: string | null;
  referenceStyleId: string | null;
  product: string | null;
  pattern: string | null;
  sizeBreakdown: string | null;
  colorVariants: string | null;
  materials: string | null;
  consumption: string | null;
  artisanAssignment: string | null;
  outsourceAssignment: string | null;
  artworkHours: string | null;
  artworkRate: string | null;
  artworkFeedback: string | null;
  materialCost: string | null;
  artisanCost: string | null;
  outsourceCost: string | null;
  customCharges: string | null;
  totalCost: string | null;
  clientComments: string | null;
  shareLink: string | null;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type OrderFormData = {
  orderType: "swatch" | "style";
  client: string;
  status: string;
  priority: string;
  assignedTo: string;
  deliveryDate: string;
  remarks: string;
  productionMode: string;
  fabric: string;
  swatchLength: string;
  swatchWidth: string;
  quantity: string;
  referenceSwatchId: string;
  referenceStyleId: string;
  product: string;
  pattern: string;
  sizeBreakdown: string;
  colorVariants: string;
};

export type StatusFilter = "all" | string;

const BASE = "/api/orders";
const QK = "orders";

export function useOrderList(params: { search: string; status: string; orderType: string; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, params],
    queryFn: () =>
      customFetch<{ data: OrderRecord[]; total: number; page: number; limit: number }>(
        `${BASE}?search=${encodeURIComponent(params.search)}&status=${params.status}&orderType=${params.orderType}&page=${params.page}&limit=${params.limit}`,
      ),
  });
}

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => customFetch<OrderRecord>(`${BASE}/${id}`),
    enabled: id !== null,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OrderFormData) =>
      customFetch<OrderRecord>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OrderFormData> }) =>
      customFetch<OrderRecord>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function usePatchOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, string> }) =>
      customFetch<OrderRecord>(`${BASE}/${id}/status`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
