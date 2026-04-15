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
  closedThreads: number[];
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

export interface ClientMessageRecord {
  id: number;
  clientLinkId: number;
  artworkId: number;
  artworkName: string;
  sender: "client" | "team";
  message: string | null;
  attachment: { name: string; type: string; data: string; size: number } | null;
  createdAt: string;
}

export function useClientLink(swatchOrderId: number | null) {
  return useQuery<ClientLinkRecord>({
    queryKey: ["client-link", swatchOrderId],
    enabled: !!swatchOrderId,
    queryFn: async () => {
      const result = await customFetch<{ data: ClientLinkRecord }>(
        `/api/client-links/swatch/${swatchOrderId}`
      );
      return result.data;
    },
  });
}

export function useClientFeedback(linkId: number | null) {
  return useQuery<ClientFeedbackRecord[]>({
    queryKey: ["client-feedback", linkId],
    enabled: !!linkId,
    queryFn: async () => {
      const result = await customFetch<{ data: ClientFeedbackRecord[] }>(
        `/api/client-links/${linkId}/feedback`
      );
      return result.data;
    },
  });
}

export function useClientMessages(linkId: number | null) {
  return useQuery<ClientMessageRecord[]>({
    queryKey: ["client-messages", linkId],
    enabled: !!linkId,
    queryFn: async () => {
      const result = await customFetch<{ data: ClientMessageRecord[] }>(
        `/api/client-links/${linkId}/messages`
      );
      return result.data;
    },
  });
}

export function useUpdateClientLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<Pick<ClientLinkRecord, "isPublished" | "hiddenImages" | "portalTitle" | "closedThreads">>;
    }) => {
      const result = await customFetch<{ data: ClientLinkRecord }>(
        `/api/client-links/${id}`,
        { method: "PATCH", body: JSON.stringify(data) }
      );
      return result.data;
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
      const result = await customFetch<{ data: ClientLinkRecord }>(
        `/api/client-links/${id}/regenerate`,
        { method: "POST" }
      );
      return { ...result.data, swatchOrderId };
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["client-link", data.swatchOrderId] });
    },
  });
}

export function useUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { isResolved?: boolean; internalNote?: string };
    }) => {
      const result = await customFetch<{ data: ClientFeedbackRecord }>(
        `/api/client-links/feedback/${id}`,
        { method: "PATCH", body: JSON.stringify(data) }
      );
      return result.data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["client-feedback", data.clientLinkId] });
    },
  });
}

export function useSendTeamMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      linkId,
      artworkId,
      artworkName,
      message,
      attachment,
    }: {
      linkId: number;
      artworkId: number;
      artworkName: string;
      message?: string;
      attachment?: { name: string; type: string; data: string; size: number };
    }) => {
      const result = await customFetch<{ data: ClientMessageRecord }>(
        `/api/client-links/${linkId}/messages`,
        { method: "POST", body: JSON.stringify({ artworkId, artworkName, message, attachment }) }
      );
      return result.data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["client-messages", data.clientLinkId] });
    },
  });
}

export function useToggleThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      linkId,
      swatchOrderId,
      artworkId,
      closed,
    }: {
      linkId: number;
      swatchOrderId: number;
      artworkId: number;
      closed: boolean;
    }) => {
      const result = await customFetch<{ data: ClientLinkRecord }>(
        `/api/client-links/${linkId}/threads/toggle`,
        { method: "PATCH", body: JSON.stringify({ artworkId, closed }) }
      );
      return { ...result.data, swatchOrderId };
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["client-link", data.swatchOrderId] });
    },
  });
}
