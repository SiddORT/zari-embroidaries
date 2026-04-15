import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type ReferenceItem = { id: string; label: string; remark: string };
export type FileAttachment = { name: string; type: string; data: string; size: number };

export type StyleOrderRecord = {
  id: number;
  orderCode: string;
  styleName: string;
  styleNo: string | null;
  clientId: string | null;
  clientName: string | null;
  quantity: string | null;
  priority: string;
  orderStatus: string;
  season: string | null;
  colorway: string | null;
  sampleSize: string | null;
  fabricType: string | null;
  orderIssueDate: string | null;
  deliveryDate: string | null;
  targetHours: string | null;
  issuedTo: string | null;
  department: string | null;
  description: string | null;
  internalNotes: string | null;
  clientInstructions: string | null;
  isChargeable: boolean;
  styleReferences: ReferenceItem[];
  swatchReferences: ReferenceItem[];
  refDocs: FileAttachment[];
  refImages: FileAttachment[];
  estimate: Record<string, unknown>[];
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

const BASE = "/api/style-orders";
const QK = "style-orders";

export function useStyleOrderList(params: { search: string; status: string; priority: string; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, params],
    queryFn: () =>
      customFetch<{ data: StyleOrderRecord[]; total: number; page: number; limit: number }>(
        `${BASE}?search=${encodeURIComponent(params.search)}&status=${params.status}&priority=${params.priority}&page=${params.page}&limit=${params.limit}`,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useStyleOrder(id: number | null) {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => customFetch<{ data: StyleOrderRecord }>(`${BASE}/${id}`),
    enabled: id !== null,
  });
}

export function useCreateStyleOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<StyleOrderRecord>) =>
      customFetch<{ data: StyleOrderRecord }>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateStyleOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StyleOrderRecord> }) =>
      customFetch<{ data: StyleOrderRecord }>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteStyleOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
