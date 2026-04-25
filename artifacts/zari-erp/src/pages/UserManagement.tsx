import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Shield, Plus, Pencil, Trash2, Copy, Check, RefreshCw, X, ChevronDown, LayoutDashboard, BookOpen, ClipboardList, Package, DollarSign, ShieldCheck, KeyRound, Mail } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/layout/AppLayout";
import InputField from "@/components/ui/InputField";
import ConfirmModal from "@/components/ui/ConfirmModal";

import {
  useUsers, useCreateUser, useUpdateUser, useDeleteUser, useResendInvite, useAdminSendReset,
  useRoles, useCreateRole, useUpdateRole, useDeleteRole, useSetRolePermissions,
  usePermissions,
  type UserRecord, type RoleRecord, type PermissionDef,
} from "@/hooks/useUserManagement";

function buildInviteUrl(token: string) {
  const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/accept-invite?token=${token}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button type="button" onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 transition-colors shrink-0">
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  roles: RoleRecord[];
  onCreated: (result: { emailSent: boolean; inviteUrl: string; inviteToken: string; email: string }) => void;
}

function AddUserModal({ open, onClose, roles, onCreated }: AddUserModalProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateUser();

  useEffect(() => {
    if (open) { setEmail(""); setUsername(""); setRole(""); setErrors({}); }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required";
    if (!username.trim()) errs.username = "Name is required";
    if (!role) errs.role = "Role is required";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    try {
      const res = await create.mutateAsync({ email: email.trim(), username: username.trim(), role });
      onCreated({ emailSent: res.emailSent, inviteUrl: res.inviteUrl, inviteToken: res.inviteToken, email: res.data.email });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? (err instanceof Error ? err.message : "Failed to create user");
      setErrors({ email: msg });
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Invite New User</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField label="Full Name" value={username} onChange={e => setUsername(e.target.value)}
            error={errors.username} required placeholder="e.g. Rahul Sharma" />
          <InputField label="Email Address" value={email} onChange={e => setEmail(e.target.value)}
            error={errors.email} required placeholder="user@company.com" type="email" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="">Select a role…</option>
              {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={create.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-60">
              {create.isPending ? "Sending Invite…" : "Create & Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface InviteLinkModalProps {
  open: boolean;
  onClose: () => void;
  inviteUrl: string;
  email: string;
  emailSent: boolean;
  mode?: "invite" | "reset";
}

function InviteLinkModal({ open, onClose, inviteUrl, email, emailSent, mode = "invite" }: InviteLinkModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === "reset" ? "Password Reset Initiated" : "Invite Sent"}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {emailSent ? (
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <Mail className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                {mode === "reset" ? "Reset email sent!" : "Invite email sent!"}
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                An email has been sent to <strong>{email}</strong> with instructions to {mode === "reset" ? "set a new password" : "set their password and activate their account"}.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <Mail className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Email could not be sent</p>
              <p className="text-xs text-amber-700 mt-0.5">Share the link below manually with <strong>{email}</strong>.</p>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mb-2">Invite link (expires in 7 days):</p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <span className="flex-1 text-xs text-gray-700 font-mono break-all">{inviteUrl}</span>
          <CopyButton text={inviteUrl} />
        </div>

        <div className="flex justify-end mt-5">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800">Done</button>
        </div>
      </div>
    </div>
  );
}

interface EditUserModalProps {
  open: boolean;
  onClose: () => void;
  user: UserRecord;
  roles: RoleRecord[];
}

function EditUserModal({ open, onClose, user, roles }: EditUserModalProps) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [emailError, setEmailError] = useState("");
  const update = useUpdateUser();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setUsername(user.username);
      setEmail(user.email);
      setRole(user.role);
      setIsActive(user.isActive);
      setEmailError("");
    }
  }, [open, user]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    try {
      await update.mutateAsync({ id: user.id, username: username.trim(), email: email.trim(), role, isActive });
      toast({ title: "User updated" });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? (err instanceof Error ? err.message : "Failed");
      if (msg.toLowerCase().includes("email")) {
        setEmailError(msg);
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Edit User</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField label="Full Name" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Full name" />
          <div>
            <InputField label="Email" type="email" value={email} onChange={e => { setEmail(e.target.value); setEmailError(""); }} required placeholder="email@example.com" />
            {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
              {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button type="button" onClick={() => setIsActive(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? "bg-gray-900" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={update.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-60">
              {update.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddRoleModalProps {
  open: boolean;
  onClose: () => void;
}

function AddRoleModal({ open, onClose }: AddRoleModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const create = useCreateRole();

  useEffect(() => {
    if (open) { setName(""); setDescription(""); setError(""); }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Role name is required"); return; }
    try {
      await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Create Role</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField label="Role Name" value={name} onChange={e => { setName(e.target.value); setError(""); }}
            error={error} required placeholder="e.g. Manager" />
          <InputField label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} placeholder="What can this role do?" />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={create.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-60">
              {create.isPending ? "Creating…" : "Create Role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatusBadge({ active, pending }: { active: boolean; pending: boolean }) {
  if (pending) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Pending Invite</span>;
  if (active) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Active</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>;
}

function UsersTab({ roles }: { roles: RoleRecord[] }) {
  const { data, isLoading } = useUsers();
  const { data: meData } = useGetMe();
  const myId: number | undefined = (meData as unknown as { id?: number })?.id;
  const deleteUser = useDeleteUser();
  const resendInvite = useResendInvite();
  const adminReset = useAdminSendReset();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [inviteState, setInviteState] = useState<{ inviteUrl: string; email: string; emailSent: boolean; mode: "invite" | "reset" } | null>(null);

  const users = data?.data ?? [];

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteUser.mutateAsync(deleteId);
      toast({ title: "User deleted" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setDeleteId(null); }
  }

  async function handleResend(user: UserRecord) {
    try {
      const res = await resendInvite.mutateAsync(user.id);
      setInviteState({ inviteUrl: res.inviteUrl, email: user.email, emailSent: res.emailSent, mode: "invite" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  async function handleAdminReset(user: UserRecord) {
    try {
      const res = await adminReset.mutateAsync(user.id);
      setInviteState({ inviteUrl: res.inviteUrl, email: user.email, emailSent: res.emailSent, mode: "reset" });
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? (err instanceof Error ? err.message : "Failed");
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-gray-800 transition-colors">
          <Plus className="h-4 w-4" /> Invite User
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-sm text-gray-400">Loading…</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No users yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Email", "Role", "Status", "Joined", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => {
                const isPending = !u.isActive && !!u.inviteToken;
                const isMe = myId !== undefined && u.id === myId;
                const isSuperuser = u.email === SUPERUSER_EMAIL;
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <span className="flex items-center gap-1.5">
                        {u.username}
                        {isSuperuser && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-900 text-[#C9B45C] leading-none">Super Admin</span>
                        )}
                        {!isSuperuser && isMe && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#C6AF4B]/15 text-[#9a8530] leading-none">You</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize">{u.role}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge active={u.isActive} pending={isPending} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {!isSuperuser && !isMe && (
                          isPending ? (
                            <button onClick={() => handleResend(u)} title="Resend invite email"
                              disabled={resendInvite.isPending}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50">
                              <RefreshCw className="h-3 w-3" /> Resend Invite
                            </button>
                          ) : u.isActive ? (
                            <button onClick={() => handleAdminReset(u)} title="Send password reset email to this user"
                              disabled={adminReset.isPending}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50">
                              <KeyRound className="h-3 w-3" /> Reset Password
                            </button>
                          ) : null
                        )}
                        {!isSuperuser && (
                          <button onClick={() => setEditUser(u)} title="Edit"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!isSuperuser && !isMe && (
                          <button onClick={() => setDeleteId(u.id)} title="Delete"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isSuperuser && (
                          <span className="text-xs text-gray-300 italic pr-1">Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} roles={roles}
        onCreated={(result) => setInviteState({ ...result, mode: "invite" })} />

      {editUser && (
        <EditUserModal open={!!editUser} onClose={() => setEditUser(null)} user={editUser} roles={roles} />
      )}

      <InviteLinkModal
        open={!!inviteState}
        onClose={() => setInviteState(null)}
        inviteUrl={inviteState?.inviteUrl ?? ""}
        email={inviteState?.email ?? ""}
        emailSent={inviteState?.emailSent ?? false}
        mode={inviteState?.mode ?? "invite"}
      />

      <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
        title="Delete User" message="Are you sure you want to delete this user? This cannot be undone." />
    </div>
  );
}

const SUPERUSER_EMAIL = "admin@zarierp";

const MENU_ORDER = ["Dashboard", "Masters", "Orders", "Stock", "Logistics", "Accounts", "Admin"];

const MENU_ICONS: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="h-4 w-4" />,
  Masters:   <BookOpen       className="h-4 w-4" />,
  Orders:    <ClipboardList  className="h-4 w-4" />,
  Stock:     <Package        className="h-4 w-4" />,
  Logistics: <Package        className="h-4 w-4" />,
  Accounts:  <DollarSign     className="h-4 w-4" />,
  Admin:     <ShieldCheck    className="h-4 w-4" />,
};

const ACTION_COLS: Array<{ key: "view" | "add_edit" | "delete" | "download"; label: string; color: string }> = [
  { key: "view",     label: "View",      color: "text-blue-600" },
  { key: "add_edit", label: "Add / Edit",color: "text-green-600" },
  { key: "delete",   label: "Delete",    color: "text-red-500" },
  { key: "download", label: "Download",  color: "text-purple-600" },
];

interface ResourceGroup {
  resource: string;
  label: string;
  actionKeys: Partial<Record<"view" | "add_edit" | "delete" | "download", string>>;
}

interface SubgroupSection { name: string | null; resources: ResourceGroup[] }
interface MenuSection     { menu: string; subgroups: SubgroupSection[] }

function buildResourceTree(allPermissions: PermissionDef[]): MenuSection[] {
  const menuMap = new Map<string, Map<string | null, Map<string, ResourceGroup>>>();
  for (const p of allPermissions) {
    if (!menuMap.has(p.menu)) menuMap.set(p.menu, new Map());
    const sgMap = menuMap.get(p.menu)!;
    if (!sgMap.has(p.subgroup)) sgMap.set(p.subgroup, new Map());
    const rMap = sgMap.get(p.subgroup)!;
    if (!rMap.has(p.resource)) rMap.set(p.resource, { resource: p.resource, label: p.label, actionKeys: {} });
    rMap.get(p.resource)!.actionKeys[p.action] = p.key;
  }
  const result: MenuSection[] = [];
  for (const menu of MENU_ORDER) {
    if (!menuMap.has(menu)) continue;
    const sgMap = menuMap.get(menu)!;
    const subgroups: SubgroupSection[] = [];
    const nullSg = sgMap.get(null);
    if (nullSg) subgroups.push({ name: null, resources: Array.from(nullSg.values()) });
    for (const [sg, rMap] of sgMap) {
      if (sg !== null) subgroups.push({ name: sg, resources: Array.from(rMap.values()) });
    }
    result.push({ menu, subgroups });
  }
  for (const [menu, sgMap] of menuMap) {
    if (!MENU_ORDER.includes(menu)) {
      const subgroups: SubgroupSection[] = [];
      for (const [sg, rMap] of sgMap) subgroups.push({ name: sg, resources: Array.from(rMap.values()) });
      result.push({ menu, subgroups });
    }
  }
  return result;
}

function PermissionsPanel({ role, allPermissions, onSave, saving }: {
  role: RoleRecord;
  allPermissions: PermissionDef[];
  onSave: (permissions: string[]) => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => { setSelected(new Set(role.permissions)); }, [role.id, role.permissions.join(",")]);

  const tree = buildResourceTree(allPermissions);

  function toggle(key: string) {
    setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function toggleResource(rg: ResourceGroup) {
    const keys = Object.values(rg.actionKeys).filter(Boolean) as string[];
    const allOn = keys.every(k => selected.has(k));
    setSelected(s => { const n = new Set(s); keys.forEach(k => allOn ? n.delete(k) : n.add(k)); return n; });
  }

  function toggleAction(action: "view" | "add_edit" | "delete" | "download", allResources: ResourceGroup[]) {
    const keys = allResources.map(r => r.actionKeys[action]).filter(Boolean) as string[];
    const allOn = keys.every(k => selected.has(k));
    setSelected(s => { const n = new Set(s); keys.forEach(k => allOn ? n.delete(k) : n.add(k)); return n; });
  }

  function toggleSection(allResources: ResourceGroup[]) {
    const keys = allResources.flatMap(r => Object.values(r.actionKeys)).filter(Boolean) as string[];
    const allOn = keys.every(k => selected.has(k));
    setSelected(s => { const n = new Set(s); keys.forEach(k => allOn ? n.delete(k) : n.add(k)); return n; });
  }

  function toggleCollapse(menu: string) {
    setCollapsed(s => { const n = new Set(s); n.has(menu) ? n.delete(menu) : n.add(menu); return n; });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 capitalize">{role.name}</h3>
          {role.description && <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>}
        </div>
        <button onClick={() => onSave([...selected])} disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-60 transition-colors">
          {saving ? "Saving…" : "Save Permissions"}
        </button>
      </div>

      <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
        {tree.map(({ menu, subgroups }) => {
          const isCollapsed = collapsed.has(menu);
          const allResources = subgroups.flatMap(sg => sg.resources);
          const allKeys = allResources.flatMap(r => Object.values(r.actionKeys)).filter(Boolean) as string[];
          const allOn  = allKeys.length > 0 && allKeys.every(k => selected.has(k));
          const someOn = allKeys.some(k => selected.has(k));
          const selectedCount = allKeys.filter(k => selected.has(k)).length;

          return (
            <div key={menu} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {/* Section header */}
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={() => toggleCollapse(menu)}>
                <input type="checkbox"
                  checked={allOn}
                  ref={el => { if (el) el.indeterminate = someOn && !allOn; }}
                  onChange={e => { e.stopPropagation(); toggleSection(allResources); }}
                  onClick={e => e.stopPropagation()}
                  className="h-4 w-4 rounded border-gray-300 accent-gray-900 shrink-0"
                />
                <span className="text-[#C9B45C] shrink-0">{MENU_ICONS[menu] ?? <Shield className="h-4 w-4" />}</span>
                <span className="text-sm font-semibold text-gray-800 flex-1">{menu}</span>
                <span className="text-xs text-gray-400 tabular-nums">{selectedCount} / {allKeys.length}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`} />
              </div>

              {/* Resource matrix */}
              {!isCollapsed && (
                <div className="border-t border-gray-100 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70">
                        <th className="text-left px-4 py-2 text-gray-500 font-semibold w-full">Section</th>
                        {ACTION_COLS.map(col => {
                          const colKeys = allResources.map(r => r.actionKeys[col.key]).filter(Boolean) as string[];
                          if (colKeys.length === 0) return null;
                          const colAllOn = colKeys.every(k => selected.has(k));
                          const colSomeOn = colKeys.some(k => selected.has(k));
                          return (
                            <th key={col.key} className="px-3 py-2 text-center whitespace-nowrap">
                              <label className="flex flex-col items-center gap-1 cursor-pointer">
                                <input type="checkbox"
                                  checked={colAllOn}
                                  ref={el => { if (el) el.indeterminate = colSomeOn && !colAllOn; }}
                                  onChange={() => toggleAction(col.key, allResources)}
                                  className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-900"
                                />
                                <span className={`font-semibold ${col.color}`}>{col.label}</span>
                              </label>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {subgroups.map(({ name: sgName, resources }) => (
                        <React.Fragment key={sgName ?? "__root__"}>
                          {sgName && (
                            <tr className="bg-gray-50/50">
                              <td colSpan={5} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">{sgName}</td>
                            </tr>
                          )}
                          {resources.map(rg => {
                            const rgKeys = Object.values(rg.actionKeys).filter(Boolean) as string[];
                            const rgAllOn = rgKeys.every(k => selected.has(k));
                            const rgSomeOn = rgKeys.some(k => selected.has(k));
                            return (
                              <tr key={rg.resource} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-2.5">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox"
                                      checked={rgAllOn}
                                      ref={el => { if (el) el.indeterminate = rgSomeOn && !rgAllOn; }}
                                      onChange={() => toggleResource(rg)}
                                      className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-900 shrink-0"
                                    />
                                    <span className="text-gray-700 font-medium">{rg.label}</span>
                                  </label>
                                </td>
                                {ACTION_COLS.map(col => {
                                  const colKeys = allResources.map(r => r.actionKeys[col.key]).filter(Boolean) as string[];
                                  if (colKeys.length === 0) return null;
                                  const permKey = rg.actionKeys[col.key];
                                  return (
                                    <td key={col.key} className="px-3 py-2.5 text-center">
                                      {permKey ? (
                                        <input type="checkbox"
                                          checked={selected.has(permKey)}
                                          onChange={() => toggle(permKey)}
                                          className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-900"
                                        />
                                      ) : (
                                        <span className="text-gray-200 select-none">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RolesTab() {
  const { data: rolesData, isLoading } = useRoles();
  const { data: permsData } = usePermissions();
  const deleteRole = useDeleteRole();
  const setPerms = useSetRolePermissions();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleRecord | null>(null);

  const roles = rolesData?.data ?? [];
  const allPerms = permsData?.data ?? [];

  useEffect(() => {
    if (roles.length > 0 && !selectedRole) setSelectedRole(roles[0]);
  }, [roles.length]);

  useEffect(() => {
    if (selectedRole) {
      const updated = roles.find(r => r.id === selectedRole.id);
      if (updated) setSelectedRole(updated);
    }
  }, [rolesData]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteRole.mutateAsync(deleteId);
      toast({ title: "Role deleted" });
      if (selectedRole?.id === deleteId) setSelectedRole(roles.find(r => r.id !== deleteId) ?? null);
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setDeleteId(null); }
  }

  async function handleSavePerms(permissions: string[]) {
    if (!selectedRole) return;
    try {
      await setPerms.mutateAsync({ id: selectedRole.id, permissions });
      toast({ title: "Permissions saved" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  if (isLoading) return <div className="text-center py-12 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="grid grid-cols-[240px_1fr] gap-5 min-h-[500px]">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-1">Roles</span>
        {roles.map(role => (
          <div key={role.id}
            onClick={() => setSelectedRole(role)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors group ${
              selectedRole?.id === role.id ? "bg-gray-900 text-[#C9B45C]" : "hover:bg-gray-100 text-gray-700"
            }`}>
            <div>
              <p className="text-sm font-medium capitalize">{role.name}</p>
              {role.isSystem && (
                <p className={`text-xs ${selectedRole?.id === role.id ? "text-gray-300" : "text-gray-400"}`}>System</p>
              )}
            </div>
            {!role.isSystem && (
              <button onClick={e => { e.stopPropagation(); setDeleteId(role.id); }}
                className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                  selectedRole?.id === role.id ? "hover:bg-gray-700 text-gray-300" : "hover:bg-red-50 text-gray-400 hover:text-red-500"
                }`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setAddOpen(true)}
          className="mt-1 flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
          <Plus className="h-4 w-4" /> Add Role
        </button>
      </div>

      <div className="bg-gray-50/70 rounded-2xl border border-gray-200 p-5">
        {selectedRole ? (
          <PermissionsPanel role={selectedRole} allPermissions={allPerms}
            onSave={handleSavePerms} saving={setPerms.isPending} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Select a role to manage permissions
          </div>
        )}
      </div>

      <AddRoleModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
        title="Delete Role" message="Are you sure you want to delete this role? Users with this role will need to be reassigned." />
    </div>
  );
}

export default function UserManagement() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"users" | "roles">("users");

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();
  const { data: rolesData } = useRoles();

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("zarierp_token");
        qc.removeQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
      },
    });
  }

  if (loadingUser) return null;
  if (!user) { setLocation("/login"); return null; }

  const roles = rolesData?.data ?? [];

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage users, roles and permissions</p>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {(["users", "roles"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t === "users" ? <Users className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              {t === "users" ? "Users" : "Roles & Permissions"}
            </button>
          ))}
        </div>

        <div>
          {tab === "users" ? <UsersTab roles={roles} /> : <RolesTab />}
        </div>
      </div>
    </AppLayout>
  );
}
