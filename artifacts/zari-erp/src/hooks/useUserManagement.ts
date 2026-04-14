import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("zarierp_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options?.headers ?? {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

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
    queryFn: () => apiFetch(`${API}/user-management/users`),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; username: string; role: string }) =>
      apiFetch<{ data: UserRecord; inviteToken: string }>(`${API}/user-management/users`, {
        method: "POST", body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; username?: string; role?: string; isActive?: boolean }) =>
      apiFetch<{ data: UserRecord }>(`${API}/user-management/users/${id}`, {
        method: "PUT", body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`${API}/user-management/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-users"] }),
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ data: UserRecord; inviteToken: string }>(`${API}/user-management/users/${id}/resend-invite`, {
        method: "POST", body: JSON.stringify({}),
      }),
  });
}

export function useRoles() {
  return useQuery<{ data: RoleRecord[] }>({
    queryKey: ["um-roles"],
    queryFn: () => apiFetch(`${API}/user-management/roles`),
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      apiFetch<{ data: RoleRecord }>(`${API}/user-management/roles`, {
        method: "POST", body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-roles"] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; description?: string }) =>
      apiFetch<{ data: RoleRecord }>(`${API}/user-management/roles/${id}`, {
        method: "PUT", body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-roles"] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`${API}/user-management/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-roles"] }),
  });
}

export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: string[] }) =>
      apiFetch<{ data: RoleRecord }>(`${API}/user-management/roles/${id}/permissions`, {
        method: "PUT", body: JSON.stringify({ permissions }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["um-roles"] }),
  });
}

export function usePermissions() {
  return useQuery<{ data: PermissionDef[] }>({
    queryKey: ["um-permissions"],
    queryFn: () => apiFetch(`${API}/user-management/permissions`),
  });
}
