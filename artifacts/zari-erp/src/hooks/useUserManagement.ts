import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

const BASE = "/api/user-management";

export interface UserRecord {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  inviteToken: string | null;
  inviteTokenExpiry: string | null;
  createdAt: string;
}

export interface RoleRecord {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  createdAt: string;
}

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

export function useUsers() {
  return useQuery<{ data: UserRecord[] }>({
    queryKey: ["um-users"],
    queryFn: () => customFetch(`${BASE}/users`),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; username: string; role: string }) =>
      customFetch<{ data: UserRecord; inviteToken: string }>(`${BASE}/users`, {
        method: "POST", body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; username?: string; role?: string; isActive?: boolean }) =>
      customFetch<{ data: UserRecord }>(`${BASE}/users/${id}`, {
        method: "PUT", body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch(`${BASE}/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-users"] }),
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ data: UserRecord; inviteToken: string }>(`${BASE}/users/${id}/resend-invite`, {
        method: "POST", body: JSON.stringify({}),
      }),
  });
}

export function useRoles() {
  return useQuery<{ data: RoleRecord[] }>({
    queryKey: ["um-roles"],
    queryFn: () => customFetch(`${BASE}/roles`),
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      customFetch<{ data: RoleRecord }>(`${BASE}/roles`, {
        method: "POST", body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-roles"] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; description?: string }) =>
      customFetch<{ data: RoleRecord }>(`${BASE}/roles/${id}`, {
        method: "PUT", body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-roles"] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch(`${BASE}/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-roles"] }),
  });
}

export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: string[] }) =>
      customFetch<{ data: RoleRecord }>(`${BASE}/roles/${id}/permissions`, {
        method: "PUT", body: JSON.stringify({ permissions }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-roles"] }),
  });
}

export function usePermissions() {
  return useQuery<{ data: PermissionDef[] }>({
    queryKey: ["um-permissions"],
    queryFn: () => customFetch(`${BASE}/permissions`),
  });
}
