import { useState, useEffect, useRef, useCallback } from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, X, Upload, FileText, Building2,
  MapPin, Star, Loader2, CheckCircle2, Save, Lock, Info,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import TopNavbar from "@/components/layout/TopNavbar";
import InputField from "@/components/ui/InputField";
import PhoneInput from "@/components/ui/PhoneInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  useVendor, useCreateVendor, useUpdateVendor,
  type VendorFormData, type VendorAddress, type BankAccount, type PaymentAttachment,
} from "@/hooks/useVendors";
import { COUNTRY_NAMES } from "@/data/countries";

const G = "#C6AF4B";
const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NAME_MAX = 100;
const CONTACT_DIGITS_REGEX = /^[0-9]{10}$/;
const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf", "image/jpeg", "image/jpg", "image/png",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".xls", ".xlsx"];
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

function getContactDigits(val: string): string {
  return val.replace(/^\+\d+\s*/, "").replace(/\D/g, "");
}

const ADDR_TYPES: VendorAddress["type"][] = ["Home", "Warehouse", "Office", "Factory", "Other"];

function makeAddrId() { return Math.random().toString(36).slice(2, 10); }

function emptyAddress(): VendorAddress {
  return {
    id: makeAddrId(),
    type: "Office",
    name: "",
    contactNo: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    isBillingDefault: false,
  };
}

const EMPTY_BANK: BankAccount = { bankName: "", accountNo: "", ifscCode: "" };

const EMPTY_FORM: VendorFormData = {
  brandName: "", contactName: "", email: "", altEmail: "",
  contactNo: "+91", altContactNo: "+91", country: "",
  hasGst: false, gstNo: "",
  bankAccounts: [],
  address1: "", address2: "", pincode: "", state: "", city: "",
  addresses: [],
  paymentAttachments: [],
  isActive: true,
};

type FormErrors = Partial<Record<string, string>>;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";
const sectionLabel = "text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3";
const inputCls = "w-full px-2.5 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30";

export default function VendorForm() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNew = params.id === "new";
  const numId = isNew ? null : parseInt(params.id ?? "", 10);

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

  const { data: existingVendor, isLoading: loadingVendor } = useVendor(numId);
  const createMutation = useCreateVendor();
  const updateMutation = useUpdateVendor();

  const [form, setForm] = useState<VendorFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [pincodeLoading, setPincodeLoading] = useState<Record<string, boolean>>({});
  const [pincodeAutoFilled, setPincodeAutoFilled] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const savedFormRef = useRef<VendorFormData>(EMPTY_FORM);
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedFormRef.current);

  useEffect(() => {
    if (existingVendor && !isNew) {
      const legacyAddr: VendorAddress[] = [];
      if (existingVendor.address1 && (!existingVendor.addresses || existingVendor.addresses.length === 0)) {
        legacyAddr.push({
          id: makeAddrId(),
          type: "Office",
          name: existingVendor.contactName,
          contactNo: existingVendor.contactNo ?? "",
          address1: existingVendor.address1 ?? "",
          address2: existingVendor.address2 ?? "",
          city: existingVendor.city ?? "",
          state: existingVendor.state ?? "",
          pincode: existingVendor.pincode ?? "",
          country: existingVendor.country ?? "India",
          isBillingDefault: true,
        });
      }
      const loaded: VendorFormData = {
        brandName: existingVendor.brandName,
        contactName: existingVendor.contactName,
        email: existingVendor.email ?? "",
        altEmail: existingVendor.altEmail ?? "",
        contactNo: existingVendor.contactNo || "+91",
        altContactNo: existingVendor.altContactNo || "+91",
        country: existingVendor.country ?? "",
        hasGst: existingVendor.hasGst,
        gstNo: existingVendor.gstNo ?? "",
        bankAccounts: existingVendor.bankAccounts ?? [],
        address1: existingVendor.address1 ?? "",
        address2: existingVendor.address2 ?? "",
        pincode: existingVendor.pincode ?? "",
        state: existingVendor.state ?? "",
        city: existingVendor.city ?? "",
        addresses: existingVendor.addresses && existingVendor.addresses.length > 0
          ? existingVendor.addresses
          : legacyAddr,
        paymentAttachments: existingVendor.paymentAttachments ?? [],
        isActive: existingVendor.isActive,
      };
      setForm(loaded);
      savedFormRef.current = loaded;
    }
  }, [existingVendor, isNew]);

  function validateBrandName(val: string): string | undefined {
    const t = val.trim().replace(/  +/g, " ");
    if (!t) return "Brand / Vendor Name is required.";
    if (t.length > NAME_MAX) return `Vendor Name must be ${NAME_MAX} characters or fewer.`;
    if (!NAME_REGEX.test(t)) return "Vendor Name must contain only letters and spaces (max 100 characters).";
    return undefined;
  }

  function validateContactName(val: string): string | undefined {
    const t = val.trim().replace(/  +/g, " ");
    if (!t) return "Contact Name is required.";
    if (t.length > NAME_MAX) return `Contact Name must be ${NAME_MAX} characters or fewer.`;
    if (!NAME_REGEX.test(t)) return "Contact Name must contain only letters and spaces (max 100 characters).";
    return undefined;
  }

  function validateContactNo(val: string): string | undefined {
    const digits = getContactDigits(val);
    if (!digits) return undefined;
    if (!CONTACT_DIGITS_REGEX.test(digits)) return "Contact Number must be exactly 10 digits.";
    return undefined;
  }

  function isFormValid(): boolean {
    if (validateBrandName(form.brandName)) return false;
    if (validateContactName(form.contactName)) return false;
    if (validateContactNo(form.contactNo)) return false;
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return false;
    if (form.altEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.altEmail)) return false;
    if (form.hasGst && !form.gstNo.trim()) return false;
    return true;
  }

  function validate(): boolean {
    const e: FormErrors = {};
    const bnErr = validateBrandName(form.brandName);
    if (bnErr) e.brandName = bnErr;
    const cnErr = validateContactName(form.contactName);
    if (cnErr) e.contactName = cnErr;
    const noErr = validateContactNo(form.contactNo);
    if (noErr) e.contactNo = noErr;
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required.";
    if (form.altEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.altEmail)) e.altEmail = "Valid email required.";
    if (form.hasGst && !form.gstNo.trim()) e.gstNo = "GST Number is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        brandName: form.brandName.trim().replace(/  +/g, " "),
        contactName: form.contactName.trim().replace(/  +/g, " "),
      };
      if (isNew) {
        await createMutation.mutateAsync(payload);
        toast({ title: "Vendor saved successfully." });
      } else {
        await updateMutation.mutateAsync({ id: numId!, data: payload });
        toast({ title: "Vendor saved successfully." });
      }
      savedFormRef.current = payload;
      setLocation("/masters/vendors");
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? (err instanceof Error ? err.message : "An error occurred.");
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const handleSaveForGuard = useCallback(async () => { await handleSave(); }, [form, isNew, numId]);
  useUnsavedChanges(isDirty, handleSaveForGuard);

  function addAddress() {
    if (form.addresses.length >= 5) {
      toast({ title: "Maximum 5 addresses allowed", variant: "destructive" });
      return;
    }
    const newAddr = emptyAddress();
    if (form.addresses.length === 0) newAddr.isBillingDefault = true;
    setForm(f => ({ ...f, addresses: [...f.addresses, newAddr] }));
  }

  function removeAddress(id: string) {
    setForm(f => {
      const remaining = f.addresses.filter(a => a.id !== id);
      if (remaining.length > 0 && !remaining.some(a => a.isBillingDefault)) {
        remaining[0].isBillingDefault = true;
      }
      return { ...f, addresses: remaining };
    });
  }

  function updateAddress(id: string, updates: Partial<VendorAddress>) {
    setForm(f => ({ ...f, addresses: f.addresses.map(a => a.id === id ? { ...a, ...updates } : a) }));
  }

  function setDefaultBilling(id: string) {
    setForm(f => ({
      ...f,
      addresses: f.addresses.map(a => ({ ...a, isBillingDefault: a.id === id })),
    }));
  }

  async function lookupPincodeForAddress(addrId: string, pin: string) {
    if (pin.length !== 6 || !/^\d+$/.test(pin)) return;
    setPincodeLoading(prev => ({ ...prev, [addrId]: true }));
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json() as Array<{ Status: string; PostOffice?: Array<{ State: string; District: string }> }>;
      if (json[0]?.Status === "Success" && json[0].PostOffice?.length) {
        const po = json[0].PostOffice[0];
        updateAddress(addrId, { state: po.State, city: po.District });
        setPincodeAutoFilled(prev => ({ ...prev, [addrId]: true }));
      }
    } catch { /* ignore */ }
    finally { setPincodeLoading(prev => ({ ...prev, [addrId]: false })); }
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
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const isTypeOk = ALLOWED_ATTACHMENT_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);
      if (!isTypeOk) {
        toast({ title: "Invalid File Type", description: `"${file.name}" is not allowed. Only PDF, JPG, PNG, XLS, XLSX files up to 5MB are allowed.`, variant: "destructive" });
        return;
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast({ title: "File Too Large", description: `"${file.name}" exceeds the 5MB limit.`, variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const raw = ev.target?.result as string;
        const data = raw.split(",")[1] ?? "";
        const att: PaymentAttachment = { name: file.name, type: file.type, data, size: file.size };
        setForm(f => ({ ...f, paymentAttachments: [...f.paymentAttachments, att] }));
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(idx: number) {
    setForm(f => ({ ...f, paymentAttachments: f.paymentAttachments.filter((_, i) => i !== idx) }));
  }

  if (!user) return null;
  if (!isNew && loadingVendor) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F6F0" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: G }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F8F6F0" }}>
      <TopNavbar username={(user as any)?.name ?? user.username ?? ""} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending} />

      <div className="py-6 px-6 max-w-screen-xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/masters/vendors")}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Vendors
            </button>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-bold text-gray-900">
              {isNew ? "Add Vendor" : `Edit Vendor — ${existingVendor?.vendorCode ?? ""}`}
            </h1>
          </div>
          <button onClick={() => void handleSave()} disabled={saving || !isFormValid()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            title={!isFormValid() ? "Please fix validation errors before saving." : undefined}
            style={{ background: `linear-gradient(135deg, ${G}, #a8922e)` }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : isNew ? "Create Vendor" : "Save Changes"}
          </button>
        </div>

        {/* Contact Info */}
        <div className={`${card} p-5`}>
          <p className={sectionLabel}>Contact Information</p>
          <div className="grid grid-cols-2 gap-4">
            {/* Brand Name */}
            <div className="flex flex-col gap-1">
              <InputField label="Brand / Vendor Name" value={form.brandName}
                maxLength={NAME_MAX} required placeholder="Brand or vendor name"
                onChange={e => {
                  const val = e.target.value;
                  setForm(f => ({ ...f, brandName: val }));
                  setErrors(prev => ({ ...prev, brandName: validateBrandName(val) }));
                }}
                error={errors.brandName} />
              <p className={`text-xs text-right -mt-1 ${form.brandName.length > NAME_MAX ? "text-red-500" : "text-gray-400"}`}>
                {form.brandName.length} / {NAME_MAX} characters used
              </p>
            </div>
            {/* Contact Name */}
            <div className="flex flex-col gap-1">
              <InputField label="Contact Name" value={form.contactName}
                maxLength={NAME_MAX} required placeholder="Primary contact person"
                onChange={e => {
                  const val = e.target.value;
                  setForm(f => ({ ...f, contactName: val }));
                  setErrors(prev => ({ ...prev, contactName: validateContactName(val) }));
                }}
                error={errors.contactName} />
              <p className={`text-xs text-right -mt-1 ${form.contactName.length > NAME_MAX ? "text-red-500" : "text-gray-400"}`}>
                {form.contactName.length} / {NAME_MAX} characters used
              </p>
            </div>
            <InputField label="Email Address" value={form.email}
              onChange={e => {
                const val = e.target.value;
                setForm(f => ({ ...f, email: val }));
                const err = val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? "Valid email required." : undefined;
                setErrors(prev => ({ ...prev, email: err }));
              }}
              error={errors.email} placeholder="email@example.com" type="email" />
            <InputField label="Alternate Email" value={form.altEmail}
              onChange={e => {
                const val = e.target.value;
                setForm(f => ({ ...f, altEmail: val }));
                const err = val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? "Valid email required." : undefined;
                setErrors(prev => ({ ...prev, altEmail: err }));
              }}
              error={errors.altEmail} placeholder="alt@example.com" type="email" />
            <PhoneInput label="Contact No" value={form.contactNo}
              onChange={v => {
                setForm(f => ({ ...f, contactNo: v }));
                setErrors(prev => ({ ...prev, contactNo: validateContactNo(v) }));
              }} placeholder="10-digit number" error={errors.contactNo} />
            <PhoneInput label="Alternate Contact No" value={form.altContactNo}
              onChange={v => setForm(f => ({ ...f, altContactNo: v }))} placeholder="Alternate phone" />
            <div className="col-span-2">
              <SearchableSelect label="Country (General)" value={form.country}
                onChange={v => setForm(f => ({ ...f, country: v }))}
                options={COUNTRY_NAMES} placeholder="Select country" clearable />
            </div>
          </div>
        </div>

        {/* GST */}
        <div className={`${card} p-5`}>
          <p className={sectionLabel}>GST Details</p>
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
                onChange={e => setForm(f => ({ ...f, gstNo: e.target.value }))}
                error={errors.gstNo} required placeholder="22AAAAA0000A1Z5" />
            </div>
          )}
        </div>

        {/* Addresses */}
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={sectionLabel + " mb-0.5"}>Addresses</p>
              <p className="text-xs text-gray-400">Add up to 5 addresses. Mark one as the default billing address.</p>
            </div>
            <button type="button" onClick={addAddress} disabled={form.addresses.length >= 5}
              className="flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
              style={{ background: G }}>
              <Plus size={14} />
              Add Address
              <span className="text-xs opacity-70">({form.addresses.length}/5)</span>
            </button>
          </div>

          {form.addresses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-xl gap-2">
              <MapPin className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">No addresses added yet</p>
              <button type="button" onClick={addAddress}
                className="text-xs font-medium px-3 py-1.5 rounded-lg text-white mt-1"
                style={{ background: G }}>
                Add First Address
              </button>
            </div>
          )}

          <div className="space-y-4">
            {form.addresses.map((addr, i) => (
              <div key={addr.id} className={`rounded-xl border p-4 relative ${addr.isBillingDefault ? "border-[#C6AF4B] bg-[#FAFAF5]" : "border-gray-200 bg-gray-50"}`}>
                {/* Card header */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                  <select value={addr.type}
                    onChange={e => updateAddress(addr.id, { type: e.target.value as VendorAddress["type"] })}
                    className={`${inputCls} flex-1 max-w-[160px]`}>
                    {ADDR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <button type="button" onClick={() => setDefaultBilling(addr.id)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all ${addr.isBillingDefault
                      ? "border-[#C6AF4B] text-[#8a7a2e] bg-[#C6AF4B]/10"
                      : "border-gray-200 text-gray-400 hover:border-[#C6AF4B]/50 hover:text-[#a8922e]"}`}>
                    <Star size={12} className={addr.isBillingDefault ? "fill-[#C6AF4B]" : ""} />
                    {addr.isBillingDefault ? "Default Billing" : "Set as Billing"}
                  </button>

                  {addr.isBillingDefault && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C6AF4B]/20 text-[#8a7a2e] uppercase tracking-wide">
                      Billing Default
                    </span>
                  )}

                  <button type="button" onClick={() => removeAddress(addr.id)}
                    className="ml-auto text-gray-400 hover:text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                {/* Contact row */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name at this Address</label>
                    <input value={addr.name}
                      onChange={e => updateAddress(addr.id, { name: e.target.value })}
                      placeholder="Name of person at this address" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contact Number</label>
                    <input value={addr.contactNo}
                      onChange={e => updateAddress(addr.id, { contactNo: e.target.value })}
                      placeholder="+91 9876543210" className={inputCls} />
                  </div>
                </div>

                {/* Address fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address Line 1</label>
                    <input value={addr.address1}
                      onChange={e => updateAddress(addr.id, { address1: e.target.value })}
                      placeholder="Street / building name" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address Line 2</label>
                    <input value={addr.address2}
                      onChange={e => updateAddress(addr.id, { address2: e.target.value })}
                      placeholder="Area / locality" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {pincodeLoading[addr.id] ? "Pincode (looking up…)" : "Pincode"}
                    </label>
                    <input value={addr.pincode}
                      onChange={e => {
                        const val = e.target.value;
                        updateAddress(addr.id, { pincode: val, state: "", city: "" });
                        setPincodeAutoFilled(prev => ({ ...prev, [addr.id]: false }));
                        void lookupPincodeForAddress(addr.id, val);
                      }}
                      placeholder="6-digit pincode" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                    <select value={addr.country}
                      onChange={e => {
                        updateAddress(addr.id, { country: e.target.value, pincode: "", state: "", city: "" });
                        setPincodeAutoFilled(prev => ({ ...prev, [addr.id]: false }));
                      }}
                      className={`${inputCls} text-gray-900`}>
                      <option value="" className="text-gray-500">Select country</option>
                      {COUNTRY_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                      State
                      {pincodeAutoFilled[addr.id] && <span title="Auto-filled from Pincode"><Lock size={10} className="text-amber-400" /></span>}
                    </label>
                    <input value={addr.state}
                      readOnly={pincodeAutoFilled[addr.id]}
                      onChange={e => !pincodeAutoFilled[addr.id] && updateAddress(addr.id, { state: e.target.value })}
                      placeholder="State"
                      title={pincodeAutoFilled[addr.id] ? "State and City are auto-filled from Pincode." : undefined}
                      className={`${inputCls} ${pincodeAutoFilled[addr.id] ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`} />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                      City / District
                      {pincodeAutoFilled[addr.id] && <span title="Auto-filled from Pincode"><Lock size={10} className="text-amber-400" /></span>}
                    </label>
                    <input value={addr.city}
                      readOnly={pincodeAutoFilled[addr.id]}
                      onChange={e => !pincodeAutoFilled[addr.id] && updateAddress(addr.id, { city: e.target.value })}
                      placeholder="City or district"
                      title={pincodeAutoFilled[addr.id] ? "State and City are auto-filled from Pincode." : undefined}
                      className={`${inputCls} ${pincodeAutoFilled[addr.id] ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bank Details */}
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <p className={sectionLabel + " mb-0"}>Bank Details</p>
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
                  onChange={e => updateBankAccount(idx, "bankName", e.target.value)}
                  placeholder="e.g. HDFC Bank" />
                <InputField label="Account No" value={acc.accountNo}
                  onChange={e => updateBankAccount(idx, "accountNo", e.target.value)}
                  placeholder="Account number" />
                <InputField label="IFSC Code" value={acc.ifscCode}
                  onChange={e => updateBankAccount(idx, "ifscCode", e.target.value)}
                  placeholder="HDFC0001234" />
              </div>
            ))}
          </div>
        </div>

        {/* Payment Attachments */}
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <p className={sectionLabel + " mb-0"}>Payment Attachments</p>
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

        {/* Status + Save */}
        <div className={`${card} p-5 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}
              role="switch" aria-checked={form.isActive}>
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className={`text-sm font-medium ${form.isActive ? "text-emerald-600" : "text-gray-400"}`}>
              {form.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setLocation("/masters/vendors")}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || !isFormValid()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isFormValid() ? "Please fix validation errors before saving." : undefined}
              style={{ background: `linear-gradient(135deg, ${G}, #a8922e)` }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? "Saving…" : isNew ? "Create Vendor" : "Save Changes"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
