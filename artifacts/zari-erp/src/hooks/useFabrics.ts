import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface FabricRecord {
  id: number;
  fabricCode: string;
  fabricType: string;
  quality: string;
  color: string | null;
  hexCode: string | null;
  colorName: string;
  width: string;
  widthUnitType: string;
  pricePerMeter: string;
  unitType: string;
  currentStock: string;
  hsnCode: string;
  gstPercent: string;
  vendor: string | null;
  location: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface FabricListResponse {
  data: FabricRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface FabricFormData {
  fabricType: string;
  quality: string;
  color?: string;
  hexCode?: string;
  colorName: string;
  width: string;
  widthUnitType: string;
  pricePerMeter: string;
  unitType: string;
  currentStock: string;
  hsnCode: string;
  gstPercent: string;
  vendor?: string;
  location?: string;
  isActive: boolean;
}

export type StatusFilter = "all" | "active" | "inactive";

function fabricKey(params: { search: string; status: StatusFilter; page: number; limit: number }) {
  return ["fabrics", params] as const;
}

export function useFabricList(params: { search: string; status: StatusFilter; page: number; limit: number }) {
  return useQuery<FabricListResponse>({
    queryKey: fabricKey(params),
    queryFn: () => {
      const qs = new URLSearchParams({
        search: params.search,
        status: params.status,
        page: String(params.page),
        limit: String(params.limit),
      }).toString();
      return customFetch<FabricListResponse>(`/api/fabrics?${qs}`);
    },
    placeholderData: (prev) => prev,
  });
}

export function useCreateFabric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FabricFormData) =>
      customFetch<FabricRecord>("/api/fabrics", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fabrics"] }),
  });
}

export function useUpdateFabric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FabricFormData> }) =>
      customFetch<FabricRecord>(`/api/fabrics/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fabrics"] }),
  });
}

export function useToggleFabricStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<FabricRecord>(`/api/fabrics/${id}/status`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fabrics"] }),
  });
}

export function useDeleteFabric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string; record: FabricRecord }>(`/api/fabrics/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fabrics"] }),
  });
}
