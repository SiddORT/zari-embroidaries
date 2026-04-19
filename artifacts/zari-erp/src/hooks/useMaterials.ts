import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface MasterImage {
  id: string;
  name: string;
  data: string;
  size: number;
}

export interface MaterialRecord {
  id: number;
  materialCode: string;
  itemType: string;
  quality: string;
  type: string | null;
  color: string | null;
  hexCode: string | null;
  colorName: string;
  size: string;
  unitPrice: string;
  unitType: string;
  currentStock: string;
  hsnCode: string;
  gstPercent: string;
  vendor: string | null;
  location: string | null;
  images: MasterImage[];
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface MaterialListResponse {
  data: MaterialRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface MaterialFormData {
  itemType: string;
  quality: string;
  type?: string;
  color?: string;
  hexCode?: string;
  colorName: string;
  size: string;
  unitPrice: string;
  unitType: string;
  currentStock: string;
  hsnCode: string;
  gstPercent: string;
  vendor?: string;
  location?: string;
  isActive: boolean;
  images: MasterImage[];
}

export type StatusFilter = "all" | "active" | "inactive";

export interface MaterialFilters {
  search: string;
  status: StatusFilter;
  hsnCode: string;
  type: string;
  vendor: string;
  page: number;
  limit: number;
}

export function useMaterialList(params: MaterialFilters) {
  return useQuery<MaterialListResponse>({
    queryKey: ["materials", params],
    queryFn: () => {
      const qs = new URLSearchParams({
        search: params.search,
        status: params.status,
        hsnCode: params.hsnCode,
        type: params.type,
        vendor: params.vendor,
        page: String(params.page),
        limit: String(params.limit),
      }).toString();
      return customFetch<MaterialListResponse>(`/api/materials?${qs}`);
    },
    placeholderData: (prev) => prev,
  });
}

export function useAllMaterials() {
  return useQuery<MaterialRecord[]>({
    queryKey: ["materials", "all"],
    queryFn: () => customFetch<MaterialRecord[]>("/api/materials/all"),
    staleTime: 0,
    refetchOnMount: "always",
    retry: 2,
  });
}

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MaterialFormData) =>
      customFetch<MaterialRecord>("/api/materials", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MaterialFormData> }) =>
      customFetch<MaterialRecord>(`/api/materials/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}

export function useToggleMaterialStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<MaterialRecord>(`/api/materials/${id}/status`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string; record: MaterialRecord }>(`/api/materials/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}
