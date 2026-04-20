import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("zarierp_token");
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
  return j;
}

export interface AccountInvoice {
  id: number;
  invoice_no: string;
  invoice_direction: string;
  invoice_type: string;
  invoice_status: string;
  client_id: number | null;
  vendor_id: number | null;
  party_name: string;
  vendor_name: string;
  currency_code: string;
  exchange_rate_snapshot: number;
  total_amount: number;
  received_amount: number;
  pending_amount: number;
  invoice_date: string;
  due_date: string;
  payment_count: number;
  last_payment_date: string | null;
}

export interface InvoicePayment {
  payment_id: number;
  invoice_id: number;
  payment_direction: string;
  party_id: number | null;
  payment_type: string;
  payment_amount: number;
  currency_code: string;
  exchange_rate_snapshot: number;
  base_currency_amount: number;
  transaction_reference: string;
  payment_status: string;
  payment_date: string;
  remarks: string;
  created_by: string;
  created_at: string;
}

export interface AccountsFilters {
  direction?: string;
  status?: string;
  search?: string;
  page?: number;
}

export function useAccountInvoices(filters: AccountsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.direction && filters.direction !== "all") params.set("direction", filters.direction);
  if (filters.status && filters.status !== "all")       params.set("status", filters.status);
  if (filters.search)                                    params.set("search", filters.search);
  if (filters.page)                                      params.set("page", String(filters.page));

  return useQuery<{ data: AccountInvoice[]; total: number; page: number; limit: number }>({
    queryKey: ["account-invoices", filters],
    queryFn: () => apiFetch(`/invoice-payments/accounts?${params}`),
  });
}

export function useInvoicePaymentsList(invoiceId: number | null) {
  return useQuery<{ data: InvoicePayment[] }>({
    queryKey: ["invoice-payments", invoiceId],
    queryFn: () => apiFetch(`/invoice-payments?invoice_id=${invoiceId}`),
    enabled: !!invoiceId,
  });
}

export function useAddInvoicePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch("/invoice-payments", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useDeleteInvoicePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/invoice-payments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
