import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface InvoiceLineItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceRecord {
  id: number;
  invoiceNo: string;
  swatchOrderId: number;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientAddress: string;
  clientGstin: string;
  clientEmail: string;
  items: InvoiceLineItem[];
  discountType: string;
  discountValue: string;
  taxLabel: string;
  taxRate: string;
  notes: string;
  paymentTerms: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function useInvoice(swatchOrderId: number) {
  return useQuery({
    queryKey: ["invoice", swatchOrderId],
    queryFn: () => customFetch<{ data: InvoiceRecord | null }>(`/api/invoices/swatch/${swatchOrderId}`).then(r => r.data),
    enabled: !!swatchOrderId,
  });
}

export function useNextInvoiceNo() {
  return useQuery({
    queryKey: ["invoice-next-no"],
    queryFn: () => customFetch<{ data: string }>("/api/invoices/next-number").then(r => r.data),
    staleTime: 0,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      customFetch<{ data: InvoiceRecord }>("/api/invoices", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["invoice"] }); },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown>) =>
      customFetch<{ data: InvoiceRecord }>(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["invoice"] }); },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ success: boolean }>(`/api/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["invoice"] }); },
  });
}
