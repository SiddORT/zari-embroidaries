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
  swatchOrderId: number | null;
  styleOrderId: number | null;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientAddress: string;
  clientGstin: string;
  clientEmail: string;
  clientPhone: string;
  clientState: string;
  items: InvoiceLineItem[];
  discountType: string;
  discountValue: string;
  cgstRate: string;
  sgstRate: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  bankUpi: string;
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

export function useStyleInvoice(styleOrderId: number) {
  return useQuery({
    queryKey: ["invoice-style", styleOrderId],
    queryFn: () => customFetch<{ data: InvoiceRecord | null }>(`/api/invoices/style/${styleOrderId}`).then(r => r.data),
    enabled: !!styleOrderId,
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoice"] });
      void qc.invalidateQueries({ queryKey: ["invoice-style"] });
      void qc.invalidateQueries({ queryKey: ["invoice-next-no"] });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown>) =>
      customFetch<{ data: InvoiceRecord }>(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoice"] });
      void qc.invalidateQueries({ queryKey: ["invoice-style"] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ success: boolean }>(`/api/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoice"] });
      void qc.invalidateQueries({ queryKey: ["invoice-style"] });
    },
  });
}
