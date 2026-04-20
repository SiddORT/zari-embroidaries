import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Shield, Plus, Pencil, Trash2, Copy, Check, RefreshCw, X, ChevronDown, LayoutDashboard, BookOpen, ClipboardList, Package, DollarSign, ShieldCheck } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/layout/AppLayout";
import InputField from "@/components/ui/InputField";
import ConfirmModal from "@/components/ui/ConfirmModal";

import {
  useUsers, useCreateUser, useUpdateUser, useDeleteUser, useResendInvite,
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
  onCreated: (token: string, email: string) => void;
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
      onCreated(res.inviteToken, res.data.email);
      onClose();
    } catch (err: unknown) {
      setErrors({ email: err instanceof Error ? err.message : "Failed to create user" });
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
              {create.isPending ? "Sending…" : "Create & Get Invite Link"}
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
  token: string;
  email: string;
}

function InviteLinkModal({ open, onClose, token, email }: InviteLinkModalProps) {
  if (!open) return null;
  const url = buildInviteUrl(token);
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Invite Link Ready</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Share the link below with <strong>{email}</strong>. They'll use it to set their password and activate their account. The link expires in <strong>7 days</strong>.
        </p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <span className="flex-1 text-xs text-gray-700 font-mono break-all">{url}</span>
          <CopyButton text={url} />
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
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const update = useUpdateUser();
  const { toast } = useToast();

  useEffect(() => {
    if (open) { setUsername(user.username); setRole(user.role); setIsActive(user.isActive); }
  }, [open, user]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: user.id, username: username.trim(), role, isActive });
      toast({ title: "User updated" });
      onClose();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
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
  const deleteUser = useDeleteUser();
  const resendInvite = useResendInvite();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [inviteState, setInviteState] = useState<{ token: string; email: string } | null>(null);

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
      setInviteState({ token: res.inviteToken, email: user.email });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
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
                {["Name", "Email", "Role", "Status", "Joined", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => {
                const isPending = !u.isActive && !!u.inviteToken;
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
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
                        {isPending && (
                          <button onClick={() => handleResend(u)} title="Resend invite"
                            className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => setEditUser(u)} title="Edit"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(u.id)} title="Delete"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
        onCreated={(token, email) => setInviteState({ token, email })} />

      {editUser && (
        <EditUserModal open={!!editUser} onClose={() => setEditUser(null)} user={editUser} roles={roles} />
      )}

      <InviteLinkModal open={!!inviteState} onClose={() => setInviteState(null)}
        token={inviteState?.token ?? ""} email={inviteState?.email ?? ""} />

      <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
        title="Delete User" message="Are you sure you want to delete this user? This cannot be undone." />
    </div>
  );
}

const MENU_ORDER = ["Dashboard", "Masters", "Orders", "Stock", "Accounts", "Admin"];

const MENU_ICONS: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="h-4 w-4" />,
  Masters:   <BookOpen       className="h-4 w-4" />,
  Orders:    <ClipboardList  className="h-4 w-4" />,
  Stock:     <Package        className="h-4 w-4" />,
  Accounts:  <DollarSign     className="h-4 w-4" />,
  Admin:     <ShieldCheck    className="h-4 w-4" />,
};

function buildMenuTree(allPermissions: PermissionDef[]) {
  const map = new Map<string, PermissionDef[]>();
  for (const p of allPermissions) {
    const m = p.menu;
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(p);
  }
  const ordered: Array<{ menu: string; perms: PermissionDef[] }> = [];
  for (const m of MENU_ORDER) {
    if (map.has(m)) ordered.push({ menu: m, perms: map.get(m)! });
  }
  for (const [m, perms] of map) {
    if (!MENU_ORDER.includes(m)) ordered.push({ menu: m, perms });
  }
  return ordered;
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

  const tree = buildMenuTree(allPermissions);

  function toggle(key: string) {
    setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function toggleMenu(perms: PermissionDef[]) {
    const keys = perms.map(p => p.key);
    const allOn = keys.every(k => selected.has(k));
    setSelected(s => {
      const n = new Set(s);
      keys.forEach(k => allOn ? n.delete(k) : n.add(k));
      return n;
    });
  }

  function toggleCollapse(menu: string) {
    setCollapsed(s => { const n = new Set(s); n.has(menu) ? n.delete(menu) : n.add(menu); return n; });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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

      {/* Nav tree */}
      <div className="space-y-1.5 overflow-y-auto flex-1 pr-0.5">
        {tree.map(({ menu, perms }) => {
          const isCollapsed = collapsed.has(menu);
          const keys = perms.map(p => p.key);
          const allOn  = keys.every(k => selected.has(k));
          const someOn = keys.some(k => selected.has(k));
          const isSingle = perms.length === 1;

          /* collect unique subgroups in declaration order */
          const subgroups: string[] = [];
          for (const p of perms) {
            if (p.subgroup && !subgroups.includes(p.subgroup)) subgroups.push(p.subgroup);
          }
          const hasSubgroups = subgroups.length > 0;

          const countLabel = isSingle
            ? null
            : `${keys.filter(k => selected.has(k)).length} / ${keys.length}`;

          return (
            <div key={menu} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">

              {/* Menu header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 select-none"
                style={{ cursor: isSingle ? "default" : "pointer" }}
                onClick={() => !isSingle && toggleCollapse(menu)}
              >
                <input
                  type="checkbox"
                  checked={isSingle ? selected.has(keys[0]) : allOn}
                  ref={el => { if (el && !isSingle) el.indeterminate = someOn && !allOn; }}
                  onChange={e => {
                    e.stopPropagation();
                    isSingle ? toggle(keys[0]) : toggleMenu(perms);
                  }}
                  onClick={e => e.stopPropagation()}
                  className="h-4 w-4 rounded border-gray-300 accent-gray-900 shrink-0"
                />
                <span className="text-[#C9B45C] shrink-0">{MENU_ICONS[menu] ?? <Shield className="h-4 w-4" />}</span>
                <span className="text-sm font-semibold text-gray-800 flex-1">{menu}</span>
                {countLabel && (
                  <span className="text-xs font-medium text-gray-400 tabular-nums">{countLabel}</span>
                )}
                {!isSingle && (
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`} />
                )}
              </div>

              {/* Submenu items */}
              {!isSingle && !isCollapsed && (
                <div className="border-t border-gray-100 px-4 pt-2 pb-3">
                  {hasSubgroups ? (
                    /* Render each subgroup with a header, then items with no subgroup first */
                    <>
                      {perms.filter(p => !p.subgroup).length > 0 && (
                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 mb-2">
                          {perms.filter(p => !p.subgroup).map(p => (
                            <PermItem key={p.key} p={p} selected={selected} toggle={toggle} />
                          ))}
                        </div>
                      )}
                      {subgroups.map(sg => (
                        <div key={sg} className="mb-2 last:mb-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-1.5 border-b border-gray-100 mb-1.5">
                            {sg}
                          </p>
                          <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 pl-1">
                            {perms.filter(p => p.subgroup === sg).map(p => (
                              <PermItem key={p.key} p={p} selected={selected} toggle={toggle} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-6">
                      {perms.map(p => (
                        <PermItem key={p.key} p={p} selected={selected} toggle={toggle} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PermItem({ p, selected, toggle }: { p: PermissionDef; selected: Set<string>; toggle: (key: string) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group py-0.5">
      <input
        type="checkbox"
        checked={selected.has(p.key)}
        onChange={() => toggle(p.key)}
        className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-900 shrink-0"
      />
      <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-tight">{p.label}</span>
    </label>
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
