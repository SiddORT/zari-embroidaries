import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface ClientAddress {
  id: string;
  type: "Billing Address" | "Delivery Address" | "Other";
  name: string;
  contactNo: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isBillingDefault: boolean;
}

export type ClientRecord = {
  id: number; clientCode: string; brandName: string; contactName: string; email: string;
  altEmail: string | null; contactNo: string; altContactNo: string | null;
  country: string | null; countryOfOrigin: string | null;
  addresses: ClientAddress[] | null;
  invoiceCurrency: string | null;
  isActive: boolean; isDeleted: boolean;
  createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null;
};

export type ClientFormData = {
  brandName: string;
  contactName: string;
  email: string;
  altEmail: string;
  contactNo: string;
  altContactNo: string;
  country: string;
  addresses: ClientAddress[];
  invoiceCurrency: string;
  isActive: boolean;
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

export function useClient(id: number | null) {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => customFetch<ClientRecord>(`${BASE}/${id}`),
    enabled: id !== null && id > 0,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientFormData) => customFetch<ClientRecord>(BASE, {
      method: "POST",
      body: JSON.stringify({ ...data, countryOfOrigin: data.country }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ClientFormData> }) =>
      customFetch<ClientRecord>(`${BASE}/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...data, countryOfOrigin: data.country }),
      }),
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
