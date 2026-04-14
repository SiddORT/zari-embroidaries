import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import MasterFormModal from "@/components/master/MasterFormModal";
import StatusToggle from "@/components/master/StatusToggle";
import ExportExcelButton, { type ExportColumn } from "@/components/master/ExportExcelButton";
import InputField from "@/components/ui/InputField";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PhoneInput from "@/components/ui/PhoneInput";
import SearchableSelect from "@/components/ui/SearchableSelect";

import {
  useClientList, useCreateClient, useUpdateClient, useToggleClientStatus, useDeleteClient,
  type ClientRecord, type ClientFormData, type StatusFilter,
} from "@/hooks/useClients";
import { COUNTRY_NAMES } from "@/data/countries";

const EMPTY_FORM: ClientFormData = {
  brandName: "", contactName: "", email: "", altEmail: "",
  contactNo: "+91", altContactNo: "+91", country: "", isActive: true,
};
type FormErrors = Partial<Record<keyof ClientFormData, string>>;

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asClient = (r: TableRow) => r as unknown as ClientRecord;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function ClientMaster() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  useEffect(() => { if (!token || (!loadingUser && !user)) setLocation("/login"); }, [token, user, loadingUser, setLocation]);
  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync({}); } finally {
      localStorage.removeItem("zarierp_token");
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ClientRecord | null>(null);
  const [form, setForm] = useState<ClientFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useClientList({ search, status, page, limit });
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const toggleStatus = useToggleClientStatus();
  const deleteMutation = useDeleteClient();

  function openCreate() {
    setEditRecord(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(r: ClientRecord) {
    setEditRecord(r);
    setForm({
      brandName: r.brandName,
      contactName: r.contactName,
      email: r.email,
      altEmail: r.altEmail ?? "",
      contactNo: r.contactNo || "+91",
      altContactNo: r.altContactNo ?? "+91",
      country: r.country ?? r.countryOfOrigin ?? "",
      isActive: r.isActive,
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate() {
    const e: FormErrors = {};
    if (!form.brandName.trim()) e.brandName = "Brand Name is required";
    if (!form.contactName.trim()) e.contactName = "Contact Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required";
    if (form.altEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.altEmail)) e.altEmail = "Valid email required";
    const phoneNum = form.contactNo.split(" ").slice(1).join("").trim();
    if (!phoneNum) e.contactNo = "Contact No is required";
    if (!form.country) e.country = "Country is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: form });
        toast({ title: "Client updated" });
      } else {
        await createMutation.mutateAsync(form);
        toast({ title: "Client created" });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast({ title: "Client deleted" });
  }

  const rows: TableRow[] = ((data?.data ?? []) as ClientRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "clientCode", label: "Client Code", render: (r) => asClient(r).clientCode },
    { key: "brandName", label: "Brand / Client Name", render: (r) => asClient(r).brandName },
    { key: "contactName", label: "Contact Name", render: (r) => asClient(r).contactName },
    { key: "email", label: "Email", render: (r) => asClient(r).email },
    { key: "contactNo", label: "Contact No", render: (r) => asClient(r).contactNo },
    { key: "country", label: "Country", render: (r) => asClient(r).country ?? asClient(r).countryOfOrigin ?? "—" },
    { key: "isActive", label: "Status", render: (r) => <StatusToggle isActive={asClient(r).isActive} onToggle={() => toggleStatus.mutate(asClient(r).id)} /> },
    { key: "createdBy", label: "Created By", render: (r) => asClient(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDate(asClient(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: (r) => asClient(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: (r) => formatDate(asClient(r).updatedAt) },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asClient(r);
        return (
          <div className="flex gap-2">
            <button onClick={() => openEdit(rec)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
            <button onClick={() => setDeleteId(rec.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
          </div>
        );
      },
    },
  ];

  const exportColumns: ExportColumn[] = [
    { key: "clientCode", label: "Client Code" },
    { key: "brandName", label: "Brand / Client Name" },
    { key: "contactName", label: "Contact Name" },
    { key: "email", label: "Email" },
    { key: "altEmail", label: "Alternate Email" },
    { key: "contactNo", label: "Contact No" },
    { key: "altContactNo", label: "Alternate Contact No" },
    { key: "country", label: "Country" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Client Master" onAdd={openCreate} addLabel="Add Client" />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search clients…" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ExportExcelButton data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={exportColumns} filename="clients" />
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        <MasterFormModal open={modalOpen} onClose={() => setModalOpen(false)} size="xl"
          title={editRecord ? `Edit Client — ${editRecord.clientCode}` : "Add Client"}
          onSubmit={handleSubmit} submitting={createMutation.isPending || updateMutation.isPending}>

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Brand / Client Name" value={form.brandName}
              onChange={(e) => setForm(f => ({ ...f, brandName: e.target.value }))}
              error={errors.brandName} required placeholder="Brand or client name" />
            <InputField label="Contact Name" value={form.contactName}
              onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))}
              error={errors.contactName} required placeholder="Primary contact person" />
            <InputField label="Email Address" value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              error={errors.email} required placeholder="email@example.com" type="email" />
            <InputField label="Alternate Email Address" value={form.altEmail}
              onChange={(e) => setForm(f => ({ ...f, altEmail: e.target.value }))}
              error={errors.altEmail} placeholder="alt@example.com" type="email" />
            <PhoneInput label="Contact No" value={form.contactNo}
              onChange={(v) => setForm(f => ({ ...f, contactNo: v }))}
              error={errors.contactNo} required placeholder="Phone number" />
            <PhoneInput label="Alternate Contact No" value={form.altContactNo}
              onChange={(v) => setForm(f => ({ ...f, altContactNo: v }))}
              placeholder="Alternate phone" />
            <div className="col-span-2">
              <SearchableSelect label="Country" value={form.country}
                onChange={(v) => setForm(f => ({ ...f, country: v }))}
                options={COUNTRY_NAMES} placeholder="Select country" required
                error={errors.country} clearable />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}
              role="switch" aria-checked={form.isActive}>
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className={`text-sm ${form.isActive ? "text-emerald-600 font-medium" : "text-gray-400"}`}>{form.isActive ? "Active" : "Inactive"}</span>
          </div>
        </MasterFormModal>

        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Client" message="Are you sure you want to delete this client? This action cannot be undone." />
      </div>
    </AppLayout>
  );
}
