import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type ReferenceItem = { id: string; label: string; remark: string };
export type FileAttachment = { name: string; type: string; data: string; size: number };

export type SwatchOrderRecord = {
  id: number;
  orderCode: string;
  swatchName: string;
  clientId: string | null;
  clientName: string | null;
  isChargeable: boolean;
  quantity: string | null;
  priority: string;
  orderStatus: string;
  styleReferences: ReferenceItem[];
  swatchReferences: ReferenceItem[];
  fabricId: string | null;
  fabricName: string | null;
  hasLining: boolean;
  liningFabricId: string | null;
  liningFabricName: string | null;
  unitLength: string | null;
  unitWidth: string | null;
  unitType: string | null;
  orderIssueDate: string | null;
  deliveryDate: string | null;
  targetHours: string | null;
  issuedTo: string | null;
  department: string | null;
  description: string | null;
  internalNotes: string | null;
  clientInstructions: string | null;
  refDocs: FileAttachment[];
  refImages: FileAttachment[];
  actualStartDate: string | null;
  actualStartTime: string | null;
  tentativeDeliveryDate: string | null;
  actualCompletionDate: string | null;
  actualCompletionTime: string | null;
  delayReason: string | null;
  approvalDate: string | null;
  revisionCount: number;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type SwatchOrderFormData = Omit<SwatchOrderRecord, "id" | "orderCode" | "isDeleted" | "createdBy" | "createdAt" | "updatedBy" | "updatedAt">;

const BASE = "/api/swatch-orders";
const QK = "swatch-orders";

export function useSwatchOrderList(params: { search: string; status: string; priority: string; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, params],
    queryFn: () =>
      customFetch<{ data: SwatchOrderRecord[]; total: number; page: number; limit: number }>(
        `${BASE}?search=${encodeURIComponent(params.search)}&status=${params.status}&priority=${params.priority}&page=${params.page}&limit=${params.limit}`,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useSwatchOrder(id: number | null) {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => customFetch<{ data: SwatchOrderRecord }>(`${BASE}/${id}`),
    enabled: id !== null,
  });
}

export function useCreateSwatchOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SwatchOrderFormData>) =>
      customFetch<{ data: SwatchOrderRecord }>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateSwatchOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SwatchOrderFormData> }) =>
      customFetch<{ data: SwatchOrderRecord }>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteSwatchOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
