import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Plus, Edit2, Power, Phone, Mail, Package, IndianRupee } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";
import ZariButton from "@/components/ui/ZariButton";
import ConfirmModal from "@/components/ui/ConfirmModal";

const G = "#C6AF4B";

interface Vendor {
  id: number;
  vendor_name: string;
  contact_person: string | null;
  phone_number: string | null;
  email_address: string | null;
  weight_rate_per_kg: string;
  minimum_charge: string;
  remarks: string | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_FORM = {
  vendor_name: "", contact_person: "", phone_number: "",
  email_address: "", weight_rate_per_kg: "", minimum_charge: "", remarks: "",
};

export default function ShippingVendors() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("zarierp_token");
  const { data: user, isError } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();
  const isAdmin = user?.role === "admin";

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<Vendor | null>(null);

  const LIMIT = 15;

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSettled: () => { localStorage.removeItem("zarierp_token"); qc.clear(); setLocation("/login"); },
    });
  }

  useEffect(() => {
    if (!token || isError) { localStorage.removeItem("zarierp_token"); setLocation("/login"); }
  }, [token, isError]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set("search", search);
      const j = await customFetch<any>(`/api/shipping/vendors/all?${params}`);
      setVendors(j.data);
      setTotal(j.total);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); }
  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({
      vendor_name: v.vendor_name, contact_person: v.contact_person ?? "",
      phone_number: v.phone_number ?? "", email_address: v.email_address ?? "",
      weight_rate_per_kg: v.weight_rate_per_kg, minimum_charge: v.minimum_charge,
      remarks: v.remarks ?? "",
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.vendor_name.trim()) e.vendor_name = "Vendor name is required";
    if (form.weight_rate_per_kg && isNaN(parseFloat(form.weight_rate_per_kg))) e.weight_rate_per_kg = "Must be a number";
    if (form.minimum_charge && isNaN(parseFloat(form.minimum_charge))) e.minimum_charge = "Must be a number";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        weight_rate_per_kg: parseFloat(form.weight_rate_per_kg) || 0,
        minimum_charge: parseFloat(form.minimum_charge) || 0,
      };
      if (editing) {
        await customFetch(`/api/shipping/vendors/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast({ title: "Vendor updated" });
      } else {
        await customFetch(`/api/shipping/vendors`, { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Vendor created" });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(v: Vendor) {
    try {
      await customFetch(`/api/shipping/vendors/${v.id}/status`, { method: "PATCH" });
      toast({ title: v.is_active ? "Vendor deactivated" : "Vendor activated" });
      setToggleTarget(null);
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const totalPages = Math.ceil(total / LIMIT);
  const fmt = (n: string | number) => parseFloat(String(n)).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
  const inp = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20 transition";

  return (
    <AppLayout username={user?.name ?? user?.email ?? ""} role={user?.role ?? ""} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shipping Vendors</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage courier partners and their rate cards</p>
          </div>
          {isAdmin && (
            <ZariButton onClick={openCreate}>
              <Plus size={16} /> Add Vendor
            </ZariButton>
          )}
        </div>

        {/* Search */}
        <div className={`${card} p-4`}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by vendor name, contact, phone…"
            className={inp}
          />
        </div>

        {/* Table */}
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C6AF4B]/15">
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-400">Vendor Name</th>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-400">Contact</th>
                  <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-400">Rate/KG</th>
                  <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-400">Min Charge</th>
                  <th className="text-center px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-400">Status</th>
                  <th className="text-center px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : vendors.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No shipping vendors found</td></tr>
                ) : vendors.map(v => (
                  <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900">{v.vendor_name}</p>
                      {v.remarks && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{v.remarks}</p>}
                    </td>
                    <td className="px-5 py-3">
                      {v.contact_person && <p className="text-gray-700">{v.contact_person}</p>}
                      {v.phone_number && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Phone size={10} />{v.phone_number}</p>}
                      {v.email_address && <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10} />{v.email_address}</p>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">₹{fmt(v.weight_rate_per_kg)}</td>
                    <td className="px-5 py-3 text-right text-gray-700">₹{fmt(v.minimum_charge)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${v.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                        {v.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        {isAdmin && (
                          <button onClick={() => setToggleTarget(v)} className={`p-1.5 rounded-lg transition ${v.is_active ? "hover:bg-red-50 text-red-400 hover:text-red-600" : "hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600"}`} title={v.is_active ? "Deactivate" : "Activate"}>
                            <Power size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">{total} vendors</span>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-xs rounded-lg transition ${page === p ? "text-white font-semibold" : "text-gray-500 hover:bg-gray-100"}`} style={page === p ? { background: G } : undefined}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toggle confirm */}
      {toggleTarget && (
        <ConfirmModal
          title={toggleTarget.is_active ? "Deactivate Vendor" : "Activate Vendor"}
          message={`Are you sure you want to ${toggleTarget.is_active ? "deactivate" : "activate"} "${toggleTarget.vendor_name}"?`}
          confirmLabel={toggleTarget.is_active ? "Deactivate" : "Activate"}
          onConfirm={() => handleToggle(toggleTarget)}
          onCancel={() => setToggleTarget(null)}
        />
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className={`${card} w-full max-w-lg p-6`}>
            <h2 className="text-lg font-bold text-gray-900 mb-5">{editing ? "Edit Shipping Vendor" : "Add Shipping Vendor"}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Vendor Name *</label>
                <input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} className={inp} placeholder="e.g. Blue Dart, DTDC" />
                {errors.vendor_name && <p className="text-red-500 text-xs mt-1">{errors.vendor_name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact Person</label>
                  <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} className={inp} placeholder="Name" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
                  <input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} className={inp} placeholder="Mobile / Landline" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
                <input value={form.email_address} onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))} className={inp} type="email" placeholder="vendor@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rate per KG (₹) *</label>
                  <input value={form.weight_rate_per_kg} onChange={e => setForm(f => ({ ...f, weight_rate_per_kg: e.target.value }))} className={inp} type="number" step="0.01" placeholder="0.00" />
                  {errors.weight_rate_per_kg && <p className="text-red-500 text-xs mt-1">{errors.weight_rate_per_kg}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Minimum Charge (₹)</label>
                  <input value={form.minimum_charge} onChange={e => setForm(f => ({ ...f, minimum_charge: e.target.value }))} className={inp} type="number" step="0.01" placeholder="0.00" />
                  {errors.minimum_charge && <p className="text-red-500 text-xs mt-1">{errors.minimum_charge}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Remarks</label>
                <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={inp + " resize-none"} rows={2} placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <ZariButton variant="secondary" onClick={() => setModalOpen(false)}>Cancel</ZariButton>
              <ZariButton loading={saving} onClick={handleSave}>{editing ? "Update Vendor" : "Add Vendor"}</ZariButton>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
