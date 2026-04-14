import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type ClientRecord = {
  id: number; clientCode: string; brandName: string; contactName: string; email: string;
  altEmail: string | null; contactNo: string; altContactNo: string | null;
  countryOfOrigin: string; hasGst: boolean; gstNo: string | null;
  address1: string; address2: string | null; country: string | null; state: string | null;
  city: string | null; pincode: string | null; isActive: boolean; isDeleted: boolean;
  createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null;
};

export type ClientFormData = {
  brandName: string; contactName: string; email: string; altEmail: string; contactNo: string;
  altContactNo: string; countryOfOrigin: string; hasGst: boolean; gstNo: string;
  address1: string; address2: string; country: string; state: string; city: string; pincode: string; isActive: boolean;
};

export type StatusFilter = "all" | "active" | "inactive";

const BASE = "/api/clients";
const QK = "clients";

export function useClientList(p: { search: string; status: StatusFilter; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, p],
    queryFn: () => customFetch<{ data: ClientRecord[]; total: number; page: number; limit: number }>(
      `${BASE}?search=${encodeURIComponent(p.search)}&status=${p.status}&page=${p.page}&limit=${p.limit}`),
    placeholderData: (prev) => prev,
  });
}

export function useAllClients() {
  return useQuery({ queryKey: [QK, "all"], queryFn: () => customFetch<ClientRecord[]>(`${BASE}/all`) });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientFormData) => customFetch<ClientRecord>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ClientFormData> }) =>
      customFetch<ClientRecord>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useToggleClientStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<ClientRecord>(`${BASE}/${id}/status`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
