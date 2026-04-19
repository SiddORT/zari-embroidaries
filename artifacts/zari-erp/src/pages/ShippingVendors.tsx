import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Pencil, Power, Phone, Mail, ChevronDown } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import MasterFormModal from "@/components/master/MasterFormModal";
import StatusToggle from "@/components/master/StatusToggle";
import InputField from "@/components/ui/InputField";
import ConfirmModal from "@/components/ui/ConfirmModal";

/* ─── Country codes ─── */
const COUNTRIES = [
  { code: "IN", dial: "+91",  flag: "🇮🇳", name: "India" },
  { code: "US", dial: "+1",   flag: "🇺🇸", name: "United States" },
  { code: "GB", dial: "+44",  flag: "🇬🇧", name: "United Kingdom" },
  { code: "AE", dial: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "CN", dial: "+86",  flag: "🇨🇳", name: "China" },
  { code: "DE", dial: "+49",  flag: "🇩🇪", name: "Germany" },
  { code: "FR", dial: "+33",  flag: "🇫🇷", name: "France" },
  { code: "IT", dial: "+39",  flag: "🇮🇹", name: "Italy" },
  { code: "JP", dial: "+81",  flag: "🇯🇵", name: "Japan" },
  { code: "KR", dial: "+82",  flag: "🇰🇷", name: "South Korea" },
  { code: "AU", dial: "+61",  flag: "🇦🇺", name: "Australia" },
  { code: "CA", dial: "+1",   flag: "🇨🇦", name: "Canada" },
  { code: "SG", dial: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "MY", dial: "+60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "BD", dial: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "PK", dial: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "LK", dial: "+94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "NP", dial: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "HK", dial: "+852", flag: "🇭🇰", name: "Hong Kong" },
  { code: "SA", dial: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
];

/* ─── Phone input ─── */
interface PhoneInputProps {
  dialCode: string;
  number: string;
  onDialChange: (d: string) => void;
  onNumberChange: (n: string) => void;
  error?: string;
}

function PhoneInput({ dialCode, number, onDialChange, onNumberChange, error }: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const selected = COUNTRIES.find(c => c.dial === dialCode) ?? COUNTRIES[0];
  const filtered = search
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search)
      )
    : COUNTRIES;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">Phone</label>
      <div className="flex gap-2 min-w-0">
        {/* Country picker trigger */}
        <div className="relative shrink-0" ref={ref}>
          <button
            type="button"
            onClick={() => { setOpen(v => !v); setSearch(""); }}
            className={`flex items-center gap-1.5 h-[42px] px-3 rounded-lg border bg-white text-sm transition focus:outline-none focus:ring-2 whitespace-nowrap ${
              error
                ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
                : "border-gray-300 focus:border-gray-900 focus:ring-gray-900/10"
            }`}
          >
            <span className="text-base leading-none">{selected.flag}</span>
            <span className="text-gray-700 font-medium">{selected.dial}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-1 w-60 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search country…"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 outline-none focus:border-gray-400"
                />
              </div>
              <ul className="max-h-52 overflow-y-auto py-1">
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-sm text-gray-400">No results</li>
                )}
                {filtered.map(c => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => { onDialChange(c.dial); setOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left ${
                        c.dial === dialCode ? "bg-amber-50 font-medium" : ""
                      }`}
                    >
                      <span className="text-base">{c.flag}</span>
                      <span className="flex-1 text-gray-800">{c.name}</span>
                      <span className="text-gray-400 text-xs">{c.dial}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Number input — min-w-0 prevents flex overflow */}
        <input
          type="tel"
          value={number}
          onChange={e => onNumberChange(e.target.value)}
          placeholder="Mobile / Landline"
          className={`min-w-0 flex-1 rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:ring-2 ${
            error
              ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
              : "border-gray-300 focus:border-gray-900 focus:ring-gray-900/10"
          }`}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Types ─── */
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
  updated_at: string;
}

const EMPTY_FORM = {
  vendor_name: "", contact_person: "", phone_dial: "+91", phone_number: "",
  email_address: "", weight_rate_per_kg: "", minimum_charge: "", remarks: "",
};

/* ─── Helpers ─── */
function splitPhone(raw: string | null): { dial: string; num: string } {
  if (!raw) return { dial: "+91", num: "" };
  const match = COUNTRIES.find(c => raw.startsWith(c.dial));
  if (match) return { dial: match.dial, num: raw.slice(match.dial.length).trim() };
  return { dial: "+91", num: raw };
}

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return String(val); }
}

const fmt = (n: string | number) =>
  parseFloat(String(n)).toLocaleString("en-IN", { minimumFractionDigits: 2 });

/* ─── Page ─── */
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
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<Vendor | null>(null);
  const [toggling, setToggling] = useState(false);

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
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      const j = await customFetch<any>(`/api/shipping/vendors/all?${params}`);
      setVendors(j.data);
      setTotal(j.total);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true);
  }
  function openEdit(v: Vendor) {
    const { dial, num } = splitPhone(v.phone_number);
    setEditing(v);
    setForm({
      vendor_name: v.vendor_name,
      contact_person: v.contact_person ?? "",
      phone_dial: dial,
      phone_number: num,
      email_address: v.email_address ?? "",
      weight_rate_per_kg: v.weight_rate_per_kg,
      minimum_charge: v.minimum_charge,
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
      const combined = form.phone_number.trim()
        ? `${form.phone_dial} ${form.phone_number.trim()}` : "";
      const body = {
        vendor_name: form.vendor_name,
        contact_person: form.contact_person,
        phone_number: combined,
        email_address: form.email_address,
        weight_rate_per_kg: parseFloat(form.weight_rate_per_kg) || 0,
        minimum_charge: parseFloat(form.minimum_charge) || 0,
        remarks: form.remarks,
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
    setToggling(true);
    try {
      await customFetch(`/api/shipping/vendors/${v.id}/status`, { method: "PATCH" });
      toast({ title: v.is_active ? "Vendor deactivated" : "Vendor activated" });
      setToggleTarget(null);
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  }

  /* ─── Columns ─── */
  const asV = (r: TableRow) => r as unknown as Vendor;

  const columns: Column[] = [
    {
      key: "vendor_name",
      label: "Vendor",
      render: (r) => (
        <div>
          <p className="font-semibold text-gray-900">{asV(r).vendor_name}</p>
          {asV(r).remarks && (
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{asV(r).remarks}</p>
          )}
        </div>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      render: (r) => (
        <div className="space-y-0.5">
          {asV(r).contact_person && <p className="text-gray-800">{asV(r).contact_person}</p>}
          {asV(r).phone_number && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Phone size={10} className="shrink-0" />{asV(r).phone_number}
            </p>
          )}
          {asV(r).email_address && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Mail size={10} className="shrink-0" />{asV(r).email_address}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "weight_rate_per_kg",
      label: "Rate / KG",
      className: "text-right",
      render: (r) => <span className="font-semibold text-gray-900">₹{fmt(asV(r).weight_rate_per_kg)}</span>,
    },
    {
      key: "minimum_charge",
      label: "Min Charge",
      className: "text-right",
      render: (r) => <span>₹{fmt(asV(r).minimum_charge)}</span>,
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <StatusToggle
          isActive={asV(r).is_active}
          onToggle={() => { if (isAdmin) setToggleTarget(asV(r)); }}
          loading={toggling && toggleTarget?.id === asV(r).id}
        />
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (r) => (
        <span className="text-gray-500 whitespace-nowrap">{formatDate(asV(r).created_at)}</span>
      ),
    },
    {
      key: "updated_at",
      label: "Updated",
      render: (r) => (
        <span className="text-gray-500 whitespace-nowrap">{formatDate(asV(r).updated_at)}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(asV(r))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const inp = "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10";

  return (
    <AppLayout
      username={user?.name ?? user?.email ?? ""}
      role={user?.role ?? ""}
      onLogout={handleLogout}
      isLoggingOut={logoutMutation.isPending}
    >
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        <MasterHeader title="Shipping Vendors" addLabel="Add Vendor" onAdd={openCreate} />

        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by vendor name, contact, phone…"
        />

        <MasterTable
          columns={columns}
          rows={vendors as unknown as TableRow[]}
          loading={loading}
          emptyText="No shipping vendors found."
          rowKey={(r) => asV(r).id}
          showSerial
          pagination={{
            page, limit, total,
            onPageChange: setPage,
            onLimitChange: (l) => { setLimit(l); setPage(1); },
          }}
        />
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

      {/* Add / Edit modal */}
      <MasterFormModal
        open={modalOpen}
        title={editing ? "Edit Shipping Vendor" : "Add Shipping Vendor"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
        submitting={saving}
        submitLabel={editing ? "Update Vendor" : "Add Vendor"}
      >
        <div className="space-y-4">

          <InputField
            label="Vendor Name"
            required
            value={form.vendor_name}
            onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
            placeholder="e.g. Blue Dart, DTDC, FedEx"
            error={errors.vendor_name}
          />

          <InputField
            label="Contact Person"
            value={form.contact_person}
            onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
            placeholder="Full name"
          />

          {/* Phone — full width to avoid overflow */}
          <PhoneInput
            dialCode={form.phone_dial}
            number={form.phone_number}
            onDialChange={d => setForm(f => ({ ...f, phone_dial: d }))}
            onNumberChange={n => setForm(f => ({ ...f, phone_number: n }))}
            error={errors.phone_number}
          />

          <InputField
            label="Email"
            type="email"
            value={form.email_address}
            onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))}
            placeholder="vendor@example.com"
          />

          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Rate per KG (₹)"
              required
              type="number"
              step="0.01"
              value={form.weight_rate_per_kg}
              onChange={e => setForm(f => ({ ...f, weight_rate_per_kg: e.target.value }))}
              placeholder="0.00"
              error={errors.weight_rate_per_kg}
            />
            <InputField
              label="Minimum Charge (₹)"
              type="number"
              step="0.01"
              value={form.minimum_charge}
              onChange={e => setForm(f => ({ ...f, minimum_charge: e.target.value }))}
              placeholder="0.00"
              error={errors.minimum_charge}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Remarks</label>
            <textarea
              value={form.remarks}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              rows={2}
              placeholder="Optional notes"
              className={inp + " resize-none"}
            />
          </div>

        </div>
      </MasterFormModal>
    </AppLayout>
  );
}
