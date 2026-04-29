import { useState, useEffect, useRef, useCallback } from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, X, MapPin, Star, Loader2, CheckCircle2, Save,
  Globe, DollarSign, IndianRupee,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import TopNavbar from "@/components/layout/TopNavbar";
import InputField from "@/components/ui/InputField";
import PhoneInput from "@/components/ui/PhoneInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  useClient, useCreateClient, useUpdateClient,
  type ClientFormData, type ClientAddress,
} from "@/hooks/useClients";
import { COUNTRY_NAMES } from "@/data/countries";

const G = "#C6AF4B";

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const CONTACT_DIGITS_REGEX = /^[0-9]{10}$/;

function getContactDigits(val: string): string {
  const parts = val.split(" ");
  if (parts.length < 2) return "";
  return parts.slice(1).join("").replace(/\D/g, "");
}

const ADDR_TYPES: ClientAddress["type"][] = ["Billing Address", "Delivery Address", "Other"];

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR — Indian Rupee (₹)", symbol: "₹" },
  { value: "USD", label: "USD — US Dollar ($)", symbol: "$" },
  { value: "EUR", label: "EUR — Euro (€)", symbol: "€" },
  { value: "GBP", label: "GBP — British Pound (£)", symbol: "£" },
  { value: "AED", label: "AED — UAE Dirham (د.إ)", symbol: "د.إ" },
  { value: "SGD", label: "SGD — Singapore Dollar (S$)", symbol: "S$" },
  { value: "AUD", label: "AUD — Australian Dollar (A$)", symbol: "A$" },
  { value: "CAD", label: "CAD — Canadian Dollar (CA$)", symbol: "CA$" },
  { value: "JPY", label: "JPY — Japanese Yen (¥)", symbol: "¥" },
];

function getCurrencyDefault(country: string) {
  if (!country || country === "India") return "INR";
  return "USD";
}

function makeAddrId() { return Math.random().toString(36).slice(2, 10); }

function emptyAddress(): ClientAddress {
  return {
    id: makeAddrId(),
    type: "Billing Address",
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

const EMPTY_FORM: ClientFormData = {
  brandName: "", contactName: "", email: "", altEmail: "",
  contactNo: "+91", altContactNo: "+91", country: "",
  addresses: [],
  invoiceCurrency: "INR",
  isActive: true,
};

type FormErrors = Partial<Record<string, string>>;

const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";
const sectionLabel = "text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3";
const inputCls = "w-full px-2.5 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30";

export default function ClientForm() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const isNew = params.id === "new";
  const numId = isNew ? null : parseInt(params.id ?? "", 10);

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ query: { enabled: !!token } as any });
  useEffect(() => { if (!token || (!loadingUser && !user)) setLocation("/login"); }, [token, user, loadingUser, setLocation]);
  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync(); } finally {
      localStorage.removeItem("zarierp_token");
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  const { data: existingClient, isLoading: loadingClient } = useClient(numId);
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();

  const [form, setForm] = useState<ClientFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [pincodeLoading, setPincodeLoading] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const savedFormRef = useRef<ClientFormData>(EMPTY_FORM);
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedFormRef.current);

  useEffect(() => {
    if (existingClient && !isNew) {
      const legacyAddr: ClientAddress[] = [];
      if ((existingClient as any).address1 && (!(existingClient as any).addresses || (existingClient as any).addresses.length === 0)) {
        legacyAddr.push({
          id: makeAddrId(),
          type: "Billing Address",
          name: existingClient.contactName,
          contactNo: existingClient.contactNo ?? "",
          address1: (existingClient as any).address1 ?? "",
          address2: (existingClient as any).address2 ?? "",
          city: (existingClient as any).city ?? "",
          state: (existingClient as any).state ?? "",
          pincode: (existingClient as any).pincode ?? "",
          country: existingClient.country ?? "India",
          isBillingDefault: true,
        });
      }
      const loaded: ClientFormData = {
        brandName: existingClient.brandName,
        contactName: existingClient.contactName,
        email: existingClient.email,
        altEmail: existingClient.altEmail ?? "",
        contactNo: existingClient.contactNo || "+91",
        altContactNo: existingClient.altContactNo ?? "+91",
        country: existingClient.country ?? existingClient.countryOfOrigin ?? "",
        addresses: existingClient.addresses && existingClient.addresses.length > 0
          ? existingClient.addresses
          : legacyAddr,
        invoiceCurrency: existingClient.invoiceCurrency ?? getCurrencyDefault(existingClient.country ?? ""),
        isActive: existingClient.isActive,
      };
      setForm(loaded);
      savedFormRef.current = loaded;
    }
  }, [existingClient, isNew]);

  function handleCountryChange(country: string) {
    const defaultCurrency = getCurrencyDefault(country);
    setForm(f => ({
      ...f,
      country,
      invoiceCurrency: isNew ? defaultCurrency : f.invoiceCurrency,
    }));
  }

  function validate() {
    const e: FormErrors = {};
    const bn = form.brandName.trim();
    const cn = form.contactName.trim();
    if (!bn) e.brandName = "Client Name is required.";
    else if (!NAME_REGEX.test(bn)) e.brandName = "Client Name must contain only letters and spaces (max 100 characters).";
    if (!cn) e.contactName = "Contact Name is required.";
    else if (!NAME_REGEX.test(cn)) e.contactName = "Contact Name must contain only letters and spaces (max 100 characters).";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required";
    if (form.altEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.altEmail)) e.altEmail = "Valid email required";
    const digits = getContactDigits(form.contactNo);
    if (!CONTACT_DIGITS_REGEX.test(digits)) e.contactNo = "Contact Number must be exactly 10 digits.";
    if (!form.country) e.country = "Country is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function isFormValid(): boolean {
    const bn = form.brandName.trim();
    const cn = form.contactName.trim();
    const digits = getContactDigits(form.contactNo);
    return (
      bn.length > 0 && NAME_REGEX.test(bn) && bn.length <= 100 &&
      cn.length > 0 && NAME_REGEX.test(cn) && cn.length <= 100 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
      (!form.altEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.altEmail)) &&
      CONTACT_DIGITS_REGEX.test(digits) &&
      !!form.country
    );
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isNew) {
        await createMutation.mutateAsync(form);
        toast({ title: "Client created successfully" });
      } else {
        await updateMutation.mutateAsync({ id: numId!, data: form });
        toast({ title: "Client updated successfully" });
      }
      savedFormRef.current = form;
      setLocation("/masters/clients");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "An error occurred", variant: "destructive" });
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

  function updateAddress(id: string, updates: Partial<ClientAddress>) {
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
      }
    } catch { /* ignore */ }
    finally { setPincodeLoading(prev => ({ ...prev, [addrId]: false })); }
  }

  const selectedCurrency = CURRENCY_OPTIONS.find(c => c.value === form.invoiceCurrency) ?? CURRENCY_OPTIONS[0];

  if (!user) return null;
  if (!isNew && loadingClient) {
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
            <button onClick={() => setLocation("/masters/clients")}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Clients
            </button>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-bold text-gray-900">
              {isNew ? "Add Client" : `Edit Client — ${existingClient?.clientCode ?? ""}`}
            </h1>
          </div>
          <button onClick={() => void handleSave()} disabled={saving || !isFormValid()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: `linear-gradient(135deg, ${G}, #a8922e)` }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : isNew ? "Create Client" : "Save Changes"}
          </button>
        </div>

        {/* Contact Info */}
        <div className={`${card} p-5`}>
          <p className={sectionLabel}>Contact Information</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Brand / Client Name<span className="text-red-500 ml-0.5">*</span></label>
                <span className={`text-xs ${form.brandName.length > 90 ? "text-orange-500" : "text-gray-400"}`}>{form.brandName.length}/100</span>
              </div>
              <input
                value={form.brandName}
                maxLength={100}
                placeholder="Brand or client name"
                onChange={e => {
                  const val = e.target.value.replace(/  +/g, " ");
                  if (val.length <= 100) {
                    setForm(f => ({ ...f, brandName: val }));
                    const t = val.trim();
                    if (t && !NAME_REGEX.test(t)) {
                      setErrors(prev => ({ ...prev, brandName: "Client Name must contain only letters and spaces (max 100 characters)." }));
                    } else {
                      setErrors(prev => ({ ...prev, brandName: undefined }));
                    }
                  }
                }}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 ${errors.brandName ? "border-red-400 focus:border-red-400 focus:ring-red-400/10" : "border-gray-300 hover:border-gray-400"}`}
              />
              {errors.brandName && <p className="text-xs text-red-500">{errors.brandName}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Contact Name<span className="text-red-500 ml-0.5">*</span></label>
                <span className={`text-xs ${form.contactName.length > 90 ? "text-orange-500" : "text-gray-400"}`}>{form.contactName.length}/100</span>
              </div>
              <input
                value={form.contactName}
                maxLength={100}
                placeholder="Primary contact person"
                onChange={e => {
                  const val = e.target.value.replace(/  +/g, " ");
                  if (val.length <= 100) {
                    setForm(f => ({ ...f, contactName: val }));
                    const t = val.trim();
                    if (t && !NAME_REGEX.test(t)) {
                      setErrors(prev => ({ ...prev, contactName: "Contact Name must contain only letters and spaces (max 100 characters)." }));
                    } else {
                      setErrors(prev => ({ ...prev, contactName: undefined }));
                    }
                  }
                }}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 ${errors.contactName ? "border-red-400 focus:border-red-400 focus:ring-red-400/10" : "border-gray-300 hover:border-gray-400"}`}
              />
              {errors.contactName && <p className="text-xs text-red-500">{errors.contactName}</p>}
            </div>
            <InputField label="Email Address" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              error={errors.email} required placeholder="email@example.com" type="email" />
            <InputField label="Alternate Email" value={form.altEmail}
              onChange={e => setForm(f => ({ ...f, altEmail: e.target.value }))}
              error={errors.altEmail} placeholder="alt@example.com" type="email" />
            <PhoneInput label="Contact No" value={form.contactNo}
              onChange={v => {
                setForm(f => ({ ...f, contactNo: v }));
                const digits = getContactDigits(v);
                if (digits && !CONTACT_DIGITS_REGEX.test(digits)) {
                  setErrors(prev => ({ ...prev, contactNo: "Contact Number must be exactly 10 digits." }));
                } else {
                  setErrors(prev => ({ ...prev, contactNo: undefined }));
                }
              }}
              error={errors.contactNo} required placeholder="Phone number" />
            <PhoneInput label="Alternate Contact No" value={form.altContactNo}
              onChange={v => setForm(f => ({ ...f, altContactNo: v }))} placeholder="Alternate phone" />
            <div className="col-span-2">
              <SearchableSelect label="Country" value={form.country}
                onChange={handleCountryChange}
                options={COUNTRY_NAMES} placeholder="Select country" required
                error={errors.country} clearable />
            </div>
          </div>
        </div>

        {/* Currency Preference */}
        <div className={`${card} p-5`}>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[#C6AF4B]/10">
              <Globe className="h-4 w-4" style={{ color: G }} />
            </div>
            <div>
              <p className={sectionLabel + " mb-0.5"}>Invoice Currency</p>
              <p className="text-xs text-gray-400">
                {form.country && form.country !== "India"
                  ? `This client is from ${form.country}. Default is USD, but you can choose any currency below.`
                  : form.country === "India"
                    ? "This client is in India. Default is INR for domestic invoicing."
                    : "Select the currency to use on invoices for this client."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {CURRENCY_OPTIONS.map(curr => {
              const selected = form.invoiceCurrency === curr.value;
              return (
                <button key={curr.value} type="button"
                  onClick={() => setForm(f => ({ ...f, invoiceCurrency: curr.value }))}
                  className={`relative flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    selected
                      ? "border-[#C6AF4B] bg-[#C6AF4B]/10 shadow-sm"
                      : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white"
                  }`}>
                  {selected && (
                    <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 shrink-0" style={{ color: G }} />
                  )}
                  <div className="flex items-baseline gap-1.5 pr-5">
                    <span className={`text-base font-bold leading-none ${selected ? "text-[#8a7a2e]" : "text-gray-500"}`}>
                      {curr.symbol}
                    </span>
                    <span className={`text-sm font-bold ${selected ? "text-[#5a4e1e]" : "text-gray-700"}`}>
                      {curr.value}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    {curr.label.split("—")[1]?.trim()}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-2">
            {form.invoiceCurrency === "INR" ? (
              <IndianRupee className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <DollarSign className="h-3.5 w-3.5 text-gray-400" />
            )}
            <p className="text-xs text-gray-500">
              Invoices for <strong>{form.brandName || "this client"}</strong> will be issued in{" "}
              <strong>{selectedCurrency.value} ({selectedCurrency.symbol})</strong> — {selectedCurrency.label.split("—")[1]?.trim()}
            </p>
          </div>
        </div>

        {/* Addresses */}
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={sectionLabel + " mb-0.5"}>Addresses</p>
              <p className="text-xs text-gray-400">Add up to 5 addresses — billing, delivery, or other. A client can order for different firms.</p>
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
                    onChange={e => updateAddress(addr.id, { type: e.target.value as ClientAddress["type"] })}
                    className={`${inputCls} flex-1 max-w-[180px]`}>
                    {ADDR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <button type="button" onClick={() => setDefaultBilling(addr.id)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all ${addr.isBillingDefault
                      ? "border-[#C6AF4B] text-[#8a7a2e] bg-[#C6AF4B]/10"
                      : "border-gray-200 text-gray-400 hover:border-[#C6AF4B]/50 hover:text-[#a8922e]"}`}>
                    <Star size={12} className={addr.isBillingDefault ? "fill-[#C6AF4B]" : ""} />
                    {addr.isBillingDefault ? "Default Billing" : "Set as Billing Default"}
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Name at this Address
                      <span className="text-gray-400 font-normal ml-1">(who to contact / deliver to)</span>
                    </label>
                    <input value={addr.name}
                      onChange={e => updateAddress(addr.id, { name: e.target.value })}
                      placeholder="e.g. John Smith or ABC Pvt Ltd" className={inputCls} />
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
                        updateAddress(addr.id, { pincode: val });
                        void lookupPincodeForAddress(addr.id, val);
                      }}
                      placeholder="6-digit pincode" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                    <select value={addr.country}
                      onChange={e => updateAddress(addr.id, { country: e.target.value })}
                      className={inputCls}>
                      <option value="">Select country</option>
                      {COUNTRY_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                    <input value={addr.state}
                      onChange={e => updateAddress(addr.id, { state: e.target.value })}
                      placeholder="State" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">City / District</label>
                    <input value={addr.city}
                      onChange={e => updateAddress(addr.id, { city: e.target.value })}
                      placeholder="City or district" className={inputCls} />
                  </div>
                </div>
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
            <button type="button" onClick={() => setLocation("/masters/clients")}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || !isFormValid()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${G}, #a8922e)` }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? "Saving…" : isNew ? "Create Client" : "Save Changes"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
