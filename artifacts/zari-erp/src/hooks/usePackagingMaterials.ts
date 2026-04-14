import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type PackagingMaterialRecord = {
  id: number;
  itemCode: string;
  itemType: string | null;
  itemName: string;
  department: string | null;
  size: string | null;
  unitType: string | null;
  unitPrice: string | null;
  vendor: string | null;
  location: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type PackagingMaterialFormData = {
  itemType: string;
  itemName: string;
  department: string;
  size: string;
  unitType: string;
  unitPrice: string;
  vendor: string;
  location: string;
  isActive: boolean;
};

export type StatusFilter = "all" | "active" | "inactive";

const BASE = "/api/packaging-materials";
const QK = "packaging-materials";

export function usePackagingMaterialList(p: {
  search: string; status: StatusFilter; itemType: string; department: string; vendor: string; location: string; page: number; limit: number;
}) {
  return useQuery({
    queryKey: [QK, p],
    queryFn: () => customFetch<{ data: PackagingMaterialRecord[]; total: number; page: number; limit: number }>(
      `${BASE}?search=${encodeURIComponent(p.search)}&status=${p.status}&itemType=${encodeURIComponent(p.itemType)}&department=${encodeURIComponent(p.department)}&vendor=${encodeURIComponent(p.vendor)}&location=${encodeURIComponent(p.location)}&page=${p.page}&limit=${p.limit}`
    ),
    placeholderData: (prev) => prev,
  });
}

export function useCreatePackagingMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PackagingMaterialFormData) => customFetch<PackagingMaterialRecord>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdatePackagingMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PackagingMaterialFormData> }) =>
      customFetch<PackagingMaterialRecord>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useTogglePackagingMaterialStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<PackagingMaterialRecord>(`${BASE}/${id}/status`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeletePackagingMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["lookups", "departments"],
    queryFn: () => customFetch<{ id: number; name: string }[]>("/api/lookups/departments"),
  });
}

export function useAddDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => customFetch<{ id: number; name: string }>("/api/lookups/departments", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lookups", "departments"] }),
  });
}
