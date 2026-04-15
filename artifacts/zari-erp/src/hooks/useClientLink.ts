import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface HiddenImage {
  artworkId: number;
  imageType: "wip" | "final";
  imageIndex: number;
}

export interface ClientLinkRecord {
  id: number;
  swatchOrderId: number;
  token: string;
  isPublished: boolean;
  hiddenImages: HiddenImage[];
  portalTitle: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ClientFeedbackRecord {
  id: number;
  clientLinkId: number;
  artworkId: number;
  artworkName: string;
  decision: "Approve" | "Rework";
  comment: string | null;
  isResolved: boolean;
  internalNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export function useClientLink(swatchOrderId: number | null) {
  return useQuery<ClientLinkRecord>({
    queryKey: ["client-link", swatchOrderId],
    enabled: !!swatchOrderId,
    queryFn: async () => {
      const r = await customFetch(`/api/client-links/swatch/${swatchOrderId}`);
      if (!r.ok) throw new Error("Failed to load client link");
      const json = await r.json() as { data: ClientLinkRecord };
      return json.data;
    },
  });
}

export function useClientFeedback(linkId: number | null) {
  return useQuery<ClientFeedbackRecord[]>({
    queryKey: ["client-feedback", linkId],
    enabled: !!linkId,
    queryFn: async () => {
      const r = await customFetch(`/api/client-links/${linkId}/feedback`);
      if (!r.ok) throw new Error("Failed to load feedback");
      const json = await r.json() as { data: ClientFeedbackRecord[] };
      return json.data;
    },
  });
}

export function useUpdateClientLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Pick<ClientLinkRecord, "isPublished" | "hiddenImages" | "portalTitle">> }) => {
      const r = await customFetch(`/api/client-links/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed to update client link");
      const json = await r.json() as { data: ClientLinkRecord };
      return json.data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["client-link", data.swatchOrderId] });
    },
  });
}

export function useRegenerateLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, swatchOrderId }: { id: number; swatchOrderId: number }) => {
      const r = await customFetch(`/api/client-links/${id}/regenerate`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to regenerate link");
      const json = await r.json() as { data: ClientLinkRecord };
      return { ...json.data, swatchOrderId };
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["client-link", data.swatchOrderId] });
    },
  });
}

export function useUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { isResolved?: boolean; internalNote?: string } }) => {
      const r = await customFetch(`/api/client-links/feedback/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed to update feedback");
      const json = await r.json() as { data: ClientFeedbackRecord };
      return json.data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["client-feedback", data.clientLinkId] });
    },
  });
}
