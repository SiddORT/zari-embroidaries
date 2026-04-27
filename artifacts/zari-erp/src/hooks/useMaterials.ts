import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface MasterImage {
  id: string;
  name: string;
  data: string;
  size: number;
}

export interface LocationStock {
  location: string;
  stock: string;
}

export interface MaterialRecord {
  id: number;
  materialCode: string;
  materialName: string | null;
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
  locationStocks: LocationStock[];
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

interface MaterialListResponse {
  data: MaterialRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface MaterialFormData {
  materialName?: string;
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
  locationStocks: LocationStock[];
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

export interface MaterialImportRow {
  row: number;
  status: "success" | "error";
  materialCode?: string;
  errors?: string[];
}

export interface MaterialImportResult {
  succeeded: number;
  failed: number;
  results: MaterialImportRow[];
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

export async function fetchAllMaterialsForExport(filters: {
  search: string;
  status: string;
  hsnCode: string;
  type: string;
  vendor: string;
}): Promise<MaterialRecord[]> {
  const qs = new URLSearchParams({
    search: filters.search,
    status: filters.status,
    hsnCode: filters.hsnCode,
    type: filters.type,
    vendor: filters.vendor,
  }).toString();
  return customFetch<MaterialRecord[]>(`/api/materials/export-all?${qs}`);
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

export function useImportMaterials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      customFetch<MaterialImportResult>("/api/materials/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}
