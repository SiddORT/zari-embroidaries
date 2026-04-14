import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, X, Upload, FileText, Building2 } from "lucide-react";
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
  useVendorList, useCreateVendor, useUpdateVendor, useToggleVendorStatus, useDeleteVendor,
  type VendorRecord, type VendorFormData, type BankAccount, type PaymentAttachment, type StatusFilter,
} from "@/hooks/useVendors";
import { COUNTRY_NAMES } from "@/data/countries";

const EMPTY_BANK: BankAccount = { bankName: "", accountNo: "", ifscCode: "" };

const EMPTY_FORM: VendorFormData = {
  brandName: "", contactName: "", email: "", altEmail: "",
  contactNo: "+91", altContactNo: "+91", country: "",
  hasGst: false, gstNo: "",
  bankAccounts: [],
  address1: "", address2: "", pincode: "", state: "", city: "",
  paymentAttachments: [],
  isActive: true,
};

type FormErrors = Partial<Record<keyof VendorFormData | string, string>>;

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

const asVendor = (r: TableRow) => r as unknown as VendorRecord;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function VendorMaster() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [pincodeLoading, setPincodeLoading] = useState(false);

  const { data, isLoading } = useVendorList({ search, status, page, limit });
  const createMutation = useCreateVendor();
  const updateMutation = useUpdateVendor();
  const toggleStatus = useToggleVendorStatus();
  const deleteMutation = useDeleteVendor();

  function openCreate() {
    setEditRecord(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(r: VendorRecord) {
    setEditRecord(r);
    setForm({
      brandName: r.brandName,
      contactName: r.contactName,
      email: r.email ?? "",
      altEmail: r.altEmail ?? "",
      contactNo: r.contactNo || "+91",
      altContactNo: r.altContactNo || "+91",
      country: r.country ?? "",
      hasGst: r.hasGst,
      gstNo: r.gstNo ?? "",
      bankAccounts: r.bankAccounts ?? [],
      address1: r.address1 ?? "",
      address2: r.address2 ?? "",
      pincode: r.pincode ?? "",
      state: r.state ?? "",
      city: r.city ?? "",
      paymentAttachments: r.paymentAttachments ?? [],
      isActive: r.isActive,
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate() {
    const e: FormErrors = {};
    if (!form.brandName.trim()) e.brandName = "Brand Name is required";
    if (!form.contactName.trim()) e.contactName = "Contact Name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required";
    if (form.altEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.altEmail)) e.altEmail = "Valid email required";
    if (form.hasGst && !form.gstNo.trim()) e.gstNo = "GST Number is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: form });
        toast({ title: "Vendor updated" });
      } else {
        await createMutation.mutateAsync(form);
        toast({ title: "Vendor created" });
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
    toast({ title: "Vendor deleted" });
  }

  function addBankAccount() {
    setForm(f => ({ ...f, bankAccounts: [...f.bankAccounts, { ...EMPTY_BANK }] }));
  }

  function removeBankAccount(idx: number) {
    setForm(f => ({ ...f, bankAccounts: f.bankAccounts.filter((_, i) => i !== idx) }));
  }

  function updateBankAccount(idx: number, field: keyof BankAccount, value: string) {
    setForm(f => ({
      ...f,
      bankAccounts: f.bankAccounts.map((acc, i) => i === idx ? { ...acc, [field]: value } : acc),
    }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const raw = ev.target?.result as string;
        const data = raw.split(",")[1] ?? "";
        const attachment: PaymentAttachment = { name: file.name, type: file.type, data, size: file.size };
        setForm(f => ({ ...f, paymentAttachments: [...f.paymentAttachments, attachment] }));
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(idx: number) {
    setForm(f => ({ ...f, paymentAttachments: f.paymentAttachments.filter((_, i) => i !== idx) }));
  }

  async function lookupPincode(pin: string) {
    if (pin.length !== 6 || !/^\d+$/.test(pin)) return;
    setPincodeLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json() as Array<{ Status: string; PostOffice?: Array<{ State: string; District: string; Country: string }> }>;
      if (json[0]?.Status === "Success" && json[0].PostOffice?.length) {
        const po = json[0].PostOffice[0];
        setForm(f => ({ ...f, state: po.State, city: po.District, country: po.Country === "India" ? "India" : f.country }));
      }
    } catch {
    } finally {
      setPincodeLoading(false);
    }
  }

  const rows: TableRow[] = ((data?.data ?? []) as VendorRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "vendorCode", label: "Vendor Code", render: (r) => asVendor(r).vendorCode },
    { key: "brandName", label: "Brand / Vendor Name", render: (r) => asVendor(r).brandName },
    { key: "contactName", label: "Contact", render: (r) => asVendor(r).contactName },
    { key: "contactNo", label: "Contact No", render: (r) => asVendor(r).contactNo || "—" },
    { key: "country", label: "Country", render: (r) => asVendor(r).country || "—" },
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
    { key: "brandName", label: "Brand / Vendor Name" },
    { key: "contactName", label: "Contact Name" },
    { key: "email", label: "Email" },
    { key: "contactNo", label: "Contact No" },
    { key: "country", label: "Country" },
    { key: "hasGst", label: "GST" },
    { key: "gstNo", label: "GST No" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Vendor Master" onAdd={openCreate} addLabel="Add Vendor" />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search vendors…" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ExportExcelButton data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={exportColumns} filename="vendors" />
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        <MasterFormModal open={modalOpen} onClose={() => setModalOpen(false)} size="2xl"
          title={editRecord ? `Edit Vendor — ${editRecord.vendorCode}` : "Add Vendor"}
          onSubmit={handleSubmit} submitting={createMutation.isPending || updateMutation.isPending}>

          {/* Contact Info */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Info</p>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Brand / Vendor Name" value={form.brandName}
                onChange={(e) => setForm(f => ({ ...f, brandName: e.target.value }))}
                error={errors.brandName} required placeholder="Brand or vendor name" />
              <InputField label="Contact Name" value={form.contactName}
                onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))}
                error={errors.contactName} required placeholder="Primary contact person" />
              <InputField label="Email Address" value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                error={errors.email} placeholder="email@example.com" type="email" />
              <InputField label="Alternate Email Address" value={form.altEmail}
                onChange={(e) => setForm(f => ({ ...f, altEmail: e.target.value }))}
                error={errors.altEmail} placeholder="alt@example.com" type="email" />
              <PhoneInput label="Contact No" value={form.contactNo}
                onChange={(v) => setForm(f => ({ ...f, contactNo: v }))}
                placeholder="Phone number" />
              <PhoneInput label="Alternate Contact No" value={form.altContactNo}
                onChange={(v) => setForm(f => ({ ...f, altContactNo: v }))}
                placeholder="Alternate phone" />
              <div className="col-span-2">
                <SearchableSelect label="Country" value={form.country}
                  onChange={(v) => setForm(f => ({ ...f, country: v }))}
                  options={COUNTRY_NAMES} placeholder="Select country" clearable />
              </div>
            </div>
          </div>

          {/* GST */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">GST</p>
            <div className="flex items-center gap-6">
              <label className="text-sm font-medium text-gray-700">GST Registered?</label>
              {["Yes", "No"].map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="vendorHasGst" checked={form.hasGst === (opt === "Yes")}
                    onChange={() => setForm(f => ({ ...f, hasGst: opt === "Yes", gstNo: opt === "No" ? "" : f.gstNo }))}
                    className="accent-gray-900 w-4 h-4" />
                  {opt}
                </label>
              ))}
            </div>
            {form.hasGst && (
              <div className="mt-3 max-w-xs">
                <InputField label="GST Number" value={form.gstNo}
                  onChange={(e) => setForm(f => ({ ...f, gstNo: e.target.value }))}
                  error={errors.gstNo} required placeholder="22AAAAA0000A1Z5" />
              </div>
            )}
          </div>

          {/* Bank Details */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bank Details</p>
              <button type="button" onClick={addBankAccount}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
                <Plus size={13} /> Add Bank Account
              </button>
            </div>
            {form.bankAccounts.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-3 px-4 rounded-lg bg-gray-50 border border-dashed border-gray-200">
                <Building2 size={16} className="text-gray-300" />
                No bank accounts added yet
              </div>
            )}
            <div className="space-y-2">
              {form.bankAccounts.map((acc, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 relative">
                  <button type="button" onClick={() => removeBankAccount(idx)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                  <InputField label="Bank Name" value={acc.bankName}
                    onChange={(e) => updateBankAccount(idx, "bankName", e.target.value)}
                    placeholder="e.g. HDFC Bank" />
                  <InputField label="Account No" value={acc.accountNo}
                    onChange={(e) => updateBankAccount(idx, "accountNo", e.target.value)}
                    placeholder="Account number" />
                  <InputField label="IFSC Code" value={acc.ifscCode}
                    onChange={(e) => updateBankAccount(idx, "ifscCode", e.target.value)}
                    placeholder="HDFC0001234" />
                </div>
              ))}
            </div>
          </div>

          {/* Address */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Address</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <InputField label="Address Line 1" value={form.address1}
                  onChange={(e) => setForm(f => ({ ...f, address1: e.target.value }))}
                  placeholder="Street / building name" />
              </div>
              <div className="col-span-2">
                <InputField label="Address Line 2" value={form.address2}
                  onChange={(e) => setForm(f => ({ ...f, address2: e.target.value }))}
                  placeholder="Area / locality" />
              </div>
              <div>
                <InputField label={pincodeLoading ? "Pincode (looking up…)" : "Pincode"}
                  value={form.pincode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm(f => ({ ...f, pincode: val }));
                    void lookupPincode(val);
                  }}
                  placeholder="6-digit pincode" />
              </div>
              <SearchableSelect label="Country" value={form.country}
                onChange={(v) => setForm(f => ({ ...f, country: v }))}
                options={COUNTRY_NAMES} placeholder="Select country" clearable />
              <InputField label="State" value={form.state}
                onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))}
                placeholder="State" />
              <InputField label="City / District" value={form.city}
                onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="City or district" />
            </div>
          </div>

          {/* Payment Attachments */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Payment Attachments</p>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
                <Upload size={13} /> Upload Files
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            </div>
            {form.paymentAttachments.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-3 px-4 rounded-lg bg-gray-50 border border-dashed border-gray-200">
                <FileText size={16} className="text-gray-300" />
                No attachments uploaded yet
              </div>
            )}
            <div className="space-y-1.5">
              {form.paymentAttachments.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{att.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{formatFileSize(att.size)}</span>
                  </div>
                  <button type="button" onClick={() => removeAttachment(idx)}
                    className="text-gray-400 hover:text-red-500 transition-colors ml-2 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Active Toggle */}
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
          title="Delete Vendor" message="Are you sure you want to delete this vendor? This action cannot be undone." />
      </div>
    </AppLayout>
  );
}
