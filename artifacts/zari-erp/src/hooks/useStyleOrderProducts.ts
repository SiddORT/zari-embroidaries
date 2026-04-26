import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface FileAttachment {
  name: string;
  type: string;
  data: string;
  size: number;
}

export interface StyleOrderProductRecord {
  id: number;
  styleOrderId: number;
  productName: string;
  styleCategoryId: string | null;
  styleCategoryName: string | null;
  productStatus: string;
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
  refDocs: FileAttachment[];
  refImages: FileAttachment[];
  videos: FileAttachment[];
  patternType: string | null;
  patternMakingCost: string | null;
  patternDoc: FileAttachment[];
  patternOuthouseDoc: FileAttachment[];
  patternVendorId: string | null;
  patternVendorName: string | null;
  patternPaymentType: string | null;
  patternPaymentMode: string | null;
  patternPaymentStatus: string | null;
  patternPaymentAmount: string | null;
  patternTransactionId: string | null;
  patternPaymentDate: string | null;
  patternRemarks: string | null;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

const BASE = "/api/style-order-products";
const QK = "style-order-products";

export function useStyleOrderProducts(styleOrderId: number | null) {
  return useQuery<{ data: StyleOrderProductRecord[] }>({
    queryKey: [QK, styleOrderId],
    queryFn: () => customFetch(`${BASE}?styleOrderId=${styleOrderId}`),
    enabled: !!styleOrderId,
  });
}

export function useCreateStyleOrderProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<StyleOrderProductRecord>) =>
      customFetch<{ data: StyleOrderProductRecord }>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: [QK, (vars as any).styleOrderId] }),
  });
}

export function useUpdateStyleOrderProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StyleOrderProductRecord> }) =>
      customFetch<{ data: StyleOrderProductRecord }>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: [QK, res.data.styleOrderId] }),
  });
}

export function useDeleteStyleOrderProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, styleOrderId }: { id: number; styleOrderId: number }) =>
      customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }).then(r => ({ ...r, styleOrderId })),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: [QK, (res as any).styleOrderId] }),
  });
}
