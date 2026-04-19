import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export function useCostingPaymentTotals(
  referenceType: "outsource_job" | "custom_charge",
  opts: { swatchOrderId?: number; styleOrderId?: number }
): Map<number, number> {
  const params = new URLSearchParams({ referenceType });
  if (opts.swatchOrderId) params.set("swatchOrderId", String(opts.swatchOrderId));
  if (opts.styleOrderId)  params.set("styleOrderId",  String(opts.styleOrderId));
  const { data } = useQuery<{ referenceId: number; totalPaid: number }[]>({
    queryKey: ["costing-payments-totals", referenceType, opts.swatchOrderId, opts.styleOrderId],
    queryFn: async () => {
      const res = await customFetch<{ data: { referenceId: number; totalPaid: number }[] }>(
        `/api/costing/costing-payments-totals?${params.toString()}`
      );
      return res.data ?? [];
    },
    staleTime: 0,
  });
  const map = new Map<number, number>();
  (data ?? []).forEach(r => map.set(r.referenceId, r.totalPaid));
  return map;
}

export function invalidateCostingPaymentTotals(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["costing-payments-totals"] });
}
