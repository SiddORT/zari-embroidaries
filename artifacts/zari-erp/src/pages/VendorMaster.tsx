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

import {
  useVendorList, useCreateVendor, useUpdateVendor, useToggleVendorStatus, useDeleteVendor,
  type VendorRecord, type VendorFormData, type StatusFilter,
} from "@/hooks/useVendors";

const EMPTY_FORM: VendorFormData = {
  brandName: "", contactName: "", email: "", altEmail: "", contactNo: "", altContactNo: "",
  hasGst: false, gstNo: "", bankName: "", accountNo: "", ifscCode: "",
  address1: "", address2: "", country: "", state: "", city: "", pincode: "", isActive: true,
};
type FormErrors = Partial<Record<keyof VendorFormData, string>>;

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asVendor = (r: TableRow) => r as unknown as VendorRecord;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
];

export default function VendorMaster() {
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
  const [editRecord, setEditRecord] = useState<VendorRecord | null>(null);
  const [form, setForm] = useState<VendorFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useVendorList({ search, status, page, limit });
  const createMutation = useCreateVendor();
  const updateMutation = useUpdateVendor();
  const toggleStatus = useToggleVendorStatus();
  const deleteMutation = useDeleteVendor();

  function openCreate() { setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); }
  function openEdit(r: VendorRecord) {
    setEditRecord(r);
    setForm({
      brandName: r.brandName, contactName: r.contactName, email: r.email ?? "",
      altEmail: r.altEmail ?? "", contactNo: r.contactNo ?? "", altContactNo: r.altContactNo ?? "",
      hasGst: r.hasGst, gstNo: r.gstNo ?? "", bankName: r.bankName ?? "",
      accountNo: r.accountNo ?? "", ifscCode: r.ifscCode ?? "", address1: r.address1 ?? "",
      address2: r.address2 ?? "", country: r.country ?? "", state: r.state ?? "",
      city: r.city ?? "", pincode: r.pincode ?? "", isActive: r.isActive,
    });
    setErrors({}); setModalOpen(true);
  }
  function validate() {
    const e: FormErrors = {};
    if (!form.brandName.trim()) e.brandName = "Brand Name is required";
    if (!form.contactName.trim()) e.contactName = "Contact Name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required";
    setErrors(e); return Object.keys(e).length === 0;
  }
  async function handleSubmit() {
    if (!validate()) return;
    try {
      if (editRecord) { await updateMutation.mutateAsync({ id: editRecord.id, data: form }); toast({ title: "Vendor updated" }); }
      else { await createMutation.mutateAsync(form); toast({ title: "Vendor created" }); }
      setModalOpen(false);
    } catch (err: unknown) { toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" }); }
  }
  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId); setDeleteId(null); toast({ title: "Vendor deleted" });
  }

  const rows: TableRow[] = ((data?.data ?? []) as VendorRecord[]).map((r, i) => ({ ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1 }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "vendorCode", label: "Vendor Code", render: (r) => asVendor(r).vendorCode },
    { key: "brandName", label: "Brand Name", render: (r) => asVendor(r).brandName },
    { key: "contactName", label: "Contact", render: (r) => asVendor(r).contactName },
    { key: "contactNo", label: "Contact No", render: (r) => asVendor(r).contactNo || "—" },
    { key: "hasGst", label: "GST", render: (r) => asVendor(r).hasGst ? "Yes" : "No" },
    { key: "isActive", label: "Status", render: (r) => <StatusToggle isActive={asVendor(r).isActive} onToggle={() => toggleStatus.mutate(asVendor(r).id)} /> },
    { key: "createdBy", label: "Created By", render: (r) => asVendor(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDate(asVendor(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: (r) => asVendor(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: (r) => formatDate(asVendor(r).updatedAt) },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asVendor(r);
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
    { key: "vendorCode", label: "Vendor Code" },
    { key: "brandName", label: "Brand Name" },
    { key: "contactName", label: "Contact Name" },
    { key: "email", label: "Email" },
    { key: "contactNo", label: "Contact No" },
    { key: "bankName", label: "Bank Name" },
    { key: "ifscCode", label: "IFSC Code" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Vendor Master" onAdd={openCreate} addLabel="Add Vendor" />

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search vendors…" />
          <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="ml-auto">
            <ExportExcelButton data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={exportColumns} filename="vendors" />
          </div>
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        <MasterFormModal open={modalOpen} onClose={() => setModalOpen(false)} size="xl"
          title={editRecord ? "Edit Vendor" : "Add Vendor"}
          onSubmit={handleSubmit} submitting={createMutation.isPending || updateMutation.isPending}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0">
            <InputField label="Brand Name" value={form.brandName} onChange={(e) => setForm(f => ({ ...f, brandName: e.target.value }))} error={errors.brandName} required placeholder="Brand name" />
            <InputField label="Contact Name" value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} error={errors.contactName} required placeholder="Primary contact" />
            <InputField label="Email Address" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} error={errors.email} placeholder="email@example.com" type="email" />
            <InputField label="Alternate Email" value={form.altEmail} onChange={(e) => setForm(f => ({ ...f, altEmail: e.target.value }))} placeholder="alt@example.com" type="email" />
            <InputField label="Contact No" value={form.contactNo} onChange={(e) => setForm(f => ({ ...f, contactNo: e.target.value }))} placeholder="+91 98765 43210" />
            <InputField label="Alternate Contact No" value={form.altContactNo} onChange={(e) => setForm(f => ({ ...f, altContactNo: e.target.value }))} placeholder="Alternate number" />
            <div className="flex flex-col gap-1 py-2">
              <label className="text-sm font-medium text-gray-700">GST</label>
              <div className="flex gap-4 pt-1">
                {["Yes", "No"].map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="vendorHasGst" checked={form.hasGst === (opt === "Yes")}
                      onChange={() => setForm(f => ({ ...f, hasGst: opt === "Yes" }))} className="accent-gray-900" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            {form.hasGst && <InputField label="GST No" value={form.gstNo} onChange={(e) => setForm(f => ({ ...f, gstNo: e.target.value }))} placeholder="22AAAAA0000A1Z5" />}
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2 pb-1">Bank Details</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0">
            <InputField label="Bank Name" value={form.bankName} onChange={(e) => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="Bank name" />
            <InputField label="Account Number" value={form.accountNo} onChange={(e) => setForm(f => ({ ...f, accountNo: e.target.value }))} placeholder="Account number" />
            <InputField label="IFSC Code" value={form.ifscCode} onChange={(e) => setForm(f => ({ ...f, ifscCode: e.target.value }))} placeholder="SBIN0001234" />
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2 pb-1">Address</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0">
            <div className="col-span-2"><InputField label="Address Line 1" value={form.address1} onChange={(e) => setForm(f => ({ ...f, address1: e.target.value }))} placeholder="Street address" /></div>
            <div className="col-span-2"><InputField label="Address Line 2" value={form.address2} onChange={(e) => setForm(f => ({ ...f, address2: e.target.value }))} placeholder="Apt, suite, etc." /></div>
            <InputField label="Country" value={form.country} onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Country" />
            <InputField label="State" value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} placeholder="State" />
            <InputField label="City" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
            <InputField label="Pincode" value={form.pincode} onChange={(e) => setForm(f => ({ ...f, pincode: e.target.value }))} placeholder="000000" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </MasterFormModal>

        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Vendor" message="Are you sure you want to delete this vendor?" />
      </div>
    </AppLayout>
  );
}
