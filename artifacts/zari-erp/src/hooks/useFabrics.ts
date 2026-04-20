import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface MasterImage {
  id: string;
  name: string;
  data: string;
  size: number;
}

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
  images: MasterImage[];
  reorderLevel: string | null;
  minimumLevel: string | null;
  maximumLevel: string | null;
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
  images: MasterImage[];
  reorderLevel?: string;
  minimumLevel?: string;
  maximumLevel?: string;
}

export type StatusFilter = "all" | "active" | "inactive";

function fabricKey(params: { search: string; status: StatusFilter; fabricType: string; vendor: string; hsnCode: string; page: number; limit: number }) {
  return ["fabrics", params] as const;
}

export function useFabricList(params: { search: string; status: StatusFilter; fabricType: string; vendor: string; hsnCode: string; page: number; limit: number }) {
  return useQuery<FabricListResponse>({
    queryKey: fabricKey(params),
    queryFn: () => {
      const qs = new URLSearchParams({
        search: params.search,
        status: params.status,
        fabricType: params.fabricType,
        vendor: params.vendor,
        hsnCode: params.hsnCode,
        page: String(params.page),
        limit: String(params.limit),
      }).toString();
      return customFetch<FabricListResponse>(`/api/fabrics?${qs}`);
    },
    placeholderData: (prev) => prev,
  });
}

export function useAllFabrics() {
  return useQuery<FabricRecord[]>({
    queryKey: ["fabrics", "all"],
    queryFn: () => customFetch<FabricRecord[]>("/api/fabrics/all"),
    staleTime: 30_000,
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
