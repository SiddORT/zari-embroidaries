import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  User, Lock, Globe, ChevronDown, ChevronUp, Save, RefreshCw,
  Eye, EyeOff, Camera, CheckCircle2, AlertCircle, Edit2, X,
  Building2, Activity, Trash2, Star, Plus, Filter, Search,
  CreditCard, Landmark, Download, Warehouse, MapPin, Phone, FileText, Receipt, ToggleLeft, ToggleRight, Info,
  Layers, Check, ChevronRight
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";

const G = "#C6AF4B";

type Tab = "profile" | "currency" | "banks" | "gst" | "logs" | "warehouses" | "templates";

const STATUS_COLORS: Record<string, string> = {
  Active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Inactive: "bg-gray-50 text-gray-500 border-gray-200",
};

interface ProfileData {
  id: number; name: string; email: string;
  phone_number: string; profile_photo: string | null; role: string;
}

interface Currency {
  code: string; name: string; symbol: string;
  decimal_places: number; is_active: boolean; is_base: boolean;
}

interface ExchangeRate {
  currency_code: string; currency_name: string; symbol: string;
  rate: string; source_type: string; is_manual_override: boolean; created_at: string;
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("zarierp_token");
  const { data: user, isError } = useGetMe({ enabled: !!token });
  const logoutMutation = useLogout();

  const [tab, setTab] = useState<Tab>("profile");
  const isAdmin = user?.role === "admin";

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSettled: () => { localStorage.removeItem("zarierp_token"); qc.clear(); setLocation("/login"); },
    });
  }

  useEffect(() => {
    if (!token || isError) { localStorage.removeItem("zarierp_token"); setLocation("/login"); }
  }, [token, isError]);

  const card = "rounded-2xl bg-white border border-[#C6AF4B]/15 shadow-[0_2px_16px_rgba(198,175,75,0.12),0_1px_3px_rgba(0,0,0,0.06)]";
  const inp = "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20 transition disabled:bg-gray-50 disabled:text-gray-400";
  const label = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

  return (
    <AppLayout username={user?.name ?? user?.email ?? ""} role={user?.role ?? ""} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your profile, security, and system preferences</p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-52 shrink-0">
            <div className={`${card} p-2 space-y-0.5`}>
              <NavItem icon={<User size={16} />} label="Profile" active={tab === "profile"} onClick={() => setTab("profile")} />
              {isAdmin && (
                <NavItem icon={<Globe size={16} />} label="Currency" active={tab === "currency"} onClick={() => setTab("currency")} />
              )}
              {isAdmin && (
                <NavItem icon={<Landmark size={16} />} label="Bank Details" active={tab === "banks"} onClick={() => setTab("banks")} />
              )}
              {isAdmin && (
                <NavItem icon={<Receipt size={16} />} label="GST Settings" active={tab === "gst"} onClick={() => setTab("gst")} />
              )}
              <NavItem icon={<Activity size={16} />} label="Activity Logs" active={tab === "logs"} onClick={() => setTab("logs")} />
              {isAdmin && (
                <>
                  <NavItem icon={<Warehouse size={16} />} label="Warehouses" active={tab === "warehouses"} onClick={() => setTab("warehouses")} />
                  <NavItem icon={<Layers size={16} />} label="Invoice Templates" active={tab === "templates"} onClick={() => setTab("templates")} />
                </>
              )}
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {tab === "profile" && <ProfileTab card={card} inp={inp} label={label} toast={toast} userId={user?.id} />}
            {tab === "currency" && isAdmin && <CurrencyTab card={card} inp={inp} label={label} toast={toast} />}
            {tab === "banks" && isAdmin && <BankDetailsTab card={card} inp={inp} label={label} toast={toast} />}
            {tab === "gst" && isAdmin && <GSTSettingsTab card={card} inp={inp} label={label} toast={toast} />}
            {tab === "logs" && <ActivityLogsTab card={card} isAdmin={isAdmin} currentUserEmail={user?.email ?? ""} />}
            {tab === "warehouses" && isAdmin && <WarehouseTab card={card} inp={inp} label={label} toast={toast} />}
            {tab === "templates" && isAdmin && <InvoiceTemplatesTab card={card} toast={toast} />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? "bg-gray-900 text-[#C6AF4B]"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function fmtDateTime(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────────────────

function ProfileTab({ card, inp, label, toast, userId }: any) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ name: "", phone_number: "" });
  const [saving, setSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    customFetch<any>("/api/settings/profile")
      .then(j => {
        setProfile(j.data);
        setForm({ name: j.data.name ?? "", phone_number: j.data.phone_number ?? "" });
        setPhotoPreview(j.data.profile_photo ?? null);
      })
      .catch(() => {});
  }, [userId]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Profile photo must be under 2MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      setPhotoData(base64);
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile() {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await customFetch("/api/settings/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: form.name, phone_number: form.phone_number, profile_photo: photoData ?? photoPreview }),
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 4000);
      toast({ title: "Profile updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setPwError("");
    if (!pwForm.current_password || !pwForm.new_password || !pwForm.confirm_password) {
      setPwError("All fields are required");
      return;
    }
    if (pwForm.new_password.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError("New passwords do not match");
      return;
    }
    setPwSaving(true);
    try {
      await customFetch("/api/settings/password", { method: "PATCH", body: JSON.stringify(pwForm) });
      setPwSuccess(true);
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
      setTimeout(() => setPwSuccess(false), 4000);
      toast({ title: "Password updated successfully" });
    } catch (err: any) {
      const msg = err.message?.replace(/^HTTP \d+[^:]*:\s*/, "") ?? err.message;
      setPwError(msg);
    } finally {
      setPwSaving(false);
    }
  }

  const initials = form.name
    ? form.name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="space-y-5">
      {/* Profile Info */}
      <div className={`${card} p-6`}>
        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
          <User size={18} style={{ color: G }} />
          <h2 className="font-bold text-gray-900 text-base">Profile Information</h2>
        </div>

        {/* Photo */}
        <div className="flex items-center gap-5 mb-6">
          <div className="relative">
            {photoPreview ? (
              <img src={photoPreview} alt="Profile" className="h-20 w-20 rounded-full object-cover border-2 border-[#C6AF4B]/30" />
            ) : (
              <div className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0" style={{ backgroundColor: "#111", color: G }}>
                {initials}
              </div>
            )}
            <button
              onClick={() => photoRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-gray-900 flex items-center justify-center hover:bg-gray-700 transition shadow-md"
              title="Change photo"
            >
              <Camera size={13} className="text-[#C6AF4B]" />
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{form.name || profile?.email}</p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{profile?.role}</p>
            <button
              onClick={() => photoRef.current?.click()}
              className="mt-2 text-xs text-[#C6AF4B] hover:text-amber-600 font-medium transition"
            >
              {photoPreview ? "Replace photo" : "Upload photo"}
            </button>
            {photoPreview && (
              <button
                onClick={() => { setPhotoPreview(null); setPhotoData(null); }}
                className="ml-3 text-xs text-red-400 hover:text-red-600 font-medium transition"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Full Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="Your full name" />
            </div>
            <div>
              <label className={label}>Phone Number</label>
              <input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} className={inp} placeholder="+91 9876543210" />
            </div>
          </div>
          <div>
            <label className={label}>Email Address</label>
            <input value={profile?.email ?? ""} disabled className={inp} />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
          </div>

          {profileSuccess && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm">
              <CheckCircle2 size={16} /> Profile updated successfully
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
              style={{ backgroundColor: G }}
            >
              {saving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Password Change */}
      <div className={`${card} p-6`}>
        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
          <Lock size={18} style={{ color: G }} />
          <h2 className="font-bold text-gray-900 text-base">Change Password</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className={label}>Current Password *</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={pwForm.current_password}
                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                className={inp + " pr-10"}
                placeholder="Enter current password"
              />
              <button onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>New Password *</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                  className={inp + " pr-10"}
                  placeholder="Min 8 characters"
                />
                <button onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {pwForm.new_password && pwForm.new_password.length < 8 && (
                <p className="text-xs text-amber-600 mt-1">At least 8 characters required</p>
              )}
            </div>
            <div>
              <label className={label}>Confirm New Password *</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={pwForm.confirm_password}
                  onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                  className={inp + " pr-10"}
                  placeholder="Repeat new password"
                />
                <button onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
          </div>

          {pwError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm">
              <AlertCircle size={16} /> {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm">
              <CheckCircle2 size={16} /> Password updated successfully
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={pwSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-60"
            >
              {pwSaving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock size={14} />}
              Update Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CURRENCY TAB
// ─────────────────────────────────────────────────────────

const CURR_PER_PAGE = 10;

function CurrencyTab({ card, inp, label, toast }: any) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [innerTab, setInnerTab] = useState<"currencies" | "rates">("currencies");
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [baseSaving, setBaseSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editRate, setEditRate] = useState<{ code: string; value: string } | null>(null);
  const [savingRate, setSavingRate] = useState(false);
  const [currencySuccess, setCurrencySuccess] = useState("");
  const [currencySearch, setCurrencySearch] = useState("");
  const [currencyPage, setCurrencyPage] = useState(1);
  const [ratesSearch, setRatesSearch] = useState("");
  const [ratesPage, setRatesPage] = useState(1);

  const baseCurrency = currencies.find(c => c.is_base);

  const filteredCurrencies = currencies.filter(c =>
    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.symbol.toLowerCase().includes(currencySearch.toLowerCase())
  );
  const totalCurrencyPages = Math.max(1, Math.ceil(filteredCurrencies.length / CURR_PER_PAGE));
  const pagedCurrencies = filteredCurrencies.slice((currencyPage - 1) * CURR_PER_PAGE, currencyPage * CURR_PER_PAGE);

  const filteredRates = rates.filter(r =>
    r.currency_code.toLowerCase().includes(ratesSearch.toLowerCase()) ||
    r.currency_name.toLowerCase().includes(ratesSearch.toLowerCase())
  );
  const totalRatesPages = Math.max(1, Math.ceil(filteredRates.length / CURR_PER_PAGE));
  const pagedRates = filteredRates.slice((ratesPage - 1) * CURR_PER_PAGE, ratesPage * CURR_PER_PAGE);

  const loadCurrencies = useCallback(async () => {
    try {
      const j = await customFetch<any>("/api/settings/currencies");
      setCurrencies(j.data);
    } catch {} finally { setLoading(false); }
  }, []);

  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const j = await customFetch<any>("/api/settings/exchange-rates");
      setRates(j.data);
    } catch {} finally { setRatesLoading(false); }
  }, []);

  useEffect(() => { loadCurrencies(); loadRates(); }, []);

  async function handleSetBase(code: string) {
    setBaseSaving(true);
    try {
      await customFetch("/api/settings/currencies/base", { method: "PATCH", body: JSON.stringify({ code }) });
      setCurrencySuccess("Currency settings updated successfully");
      setTimeout(() => setCurrencySuccess(""), 4000);
      loadCurrencies();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setBaseSaving(false); }
  }

  async function handleToggle(code: string) {
    setToggling(code);
    try {
      await customFetch(`/api/settings/currencies/${code}/toggle`, { method: "PATCH" });
      loadCurrencies();
    } catch (err: any) {
      toast({ title: "Error", description: err.message?.replace(/^HTTP \d+[^:]*:\s*/, ""), variant: "destructive" });
    } finally { setToggling(null); }
  }

  async function handleRefreshRates() {
    setRefreshing(true);
    try {
      const j = await customFetch<any>("/api/settings/exchange-rates/refresh", { method: "POST" });
      toast({ title: "Exchange rates updated successfully", description: (j as any).message });
      loadRates();
    } catch (err: any) {
      toast({ title: "Error", description: err.message?.replace(/^HTTP \d+[^:]*:\s*/, ""), variant: "destructive" });
    } finally { setRefreshing(false); }
  }

  async function handleSaveRate() {
    if (!editRate) return;
    const rate = parseFloat(editRate.value);
    if (isNaN(rate) || rate <= 0) {
      toast({ title: "Enter a valid positive rate", variant: "destructive" });
      return;
    }
    setSavingRate(true);
    try {
      await customFetch(`/api/settings/exchange-rates/${editRate.code}`, { method: "PATCH", body: JSON.stringify({ rate }) });
      toast({ title: `Exchange rate for ${editRate.code} updated` });
      setEditRate(null);
      loadRates();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSavingRate(false); }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const tabBtn = (id: "currencies" | "rates", label: string) => (
    <button
      onClick={() => setInnerTab(id)}
      className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
        innerTab === id
          ? "border-[#C6AF4B] text-[#C6AF4B] bg-[#C6AF4B]/5"
          : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {currencySuccess && (
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm">
          <CheckCircle2 size={16} /> {currencySuccess}
        </div>
      )}

      {/* Inner tab strip */}
      <div className={`${card} overflow-hidden`}>
        {/* Base Currency — always visible above tabs */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <Globe size={16} style={{ color: G }} />
            <div>
              <p className="font-bold text-gray-900 text-sm">Base Currency</p>
              <p className="text-xs text-gray-400">All exchange rates are calculated relative to this currency</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <select
                value={baseCurrency?.code ?? ""}
                onChange={e => handleSetBase(e.target.value)}
                disabled={baseSaving || loading}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#C6AF4B] bg-white disabled:opacity-60"
              >
                {currencies.filter(c => c.is_active || c.is_base).map(c => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
                ))}
              </select>
            </div>
            {baseCurrency && (
              <div className="px-4 py-2 rounded-xl border border-[#C6AF4B]/30 bg-[#C6AF4B]/8 text-center min-w-[60px]">
                <p className="text-2xl font-bold" style={{ color: G }}>{baseCurrency.symbol}</p>
                <p className="text-xs text-gray-500 mt-0.5">{baseCurrency.code}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-100">
          {tabBtn("currencies", "Active Currencies")}
          {tabBtn("rates", "Exchange Rates")}
        </div>

        {/* ── TAB: Currencies ──────────────────────────────── */}
        {innerTab === "currencies" && (
          <div>
            {/* Search bar */}
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by code, name or symbol…"
                  value={currencySearch}
                  onChange={e => { setCurrencySearch(e.target.value); setCurrencyPage(1); }}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#C6AF4B] bg-white"
                />
              </div>
            </div>

            {/* Currencies table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["#", "Code", "Name", "Symbol", "Decimals", "Status", "Action"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : pagedCurrencies.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm">No currencies match your search.</td></tr>
                  ) : pagedCurrencies.map((c, idx) => (
                    <tr key={c.code} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                      <td className="px-5 py-3 text-xs text-gray-400 font-medium">{(currencyPage - 1) * CURR_PER_PAGE + idx + 1}</td>
                      <td className="px-5 py-3 font-mono font-bold text-gray-900">
                        {c.code}
                        {c.is_base && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full border border-[#C6AF4B]/40 text-[#C6AF4B] bg-[#C6AF4B]/8">Base</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-700">{c.name}</td>
                      <td className="px-5 py-3 text-gray-700 font-medium">{c.symbol}</td>
                      <td className="px-5 py-3 text-gray-500">{c.decimal_places}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${c.is_active ? STATUS_COLORS.Active : STATUS_COLORS.Inactive}`}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {!c.is_base && (
                          <button
                            onClick={() => handleToggle(c.code)}
                            disabled={toggling === c.code}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${
                              c.is_active
                                ? "border-gray-200 text-gray-600 hover:bg-gray-50"
                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            {toggling === c.code ? "…" : c.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filteredCurrencies.length > CURR_PER_PAGE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  Showing {(currencyPage - 1) * CURR_PER_PAGE + 1}–{Math.min(currencyPage * CURR_PER_PAGE, filteredCurrencies.length)} of {filteredCurrencies.length}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setCurrencyPage(p => Math.max(1, p - 1))} disabled={currencyPage === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">Previous</button>
                  {Array.from({ length: totalCurrencyPages }, (_, i) => i + 1).map(pg => (
                    <button key={pg} onClick={() => setCurrencyPage(pg)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition ${pg === currencyPage ? "border-[#C6AF4B] text-[#C6AF4B] bg-[#C6AF4B]/8 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {pg}
                    </button>
                  ))}
                  <button onClick={() => setCurrencyPage(p => Math.min(totalCurrencyPages, p + 1))} disabled={currencyPage === totalCurrencyPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Exchange Rates ──────────────────────────── */}
        {innerTab === "rates" && (
          <div>
            {/* Header with search + refresh button */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search currency…"
                  value={ratesSearch}
                  onChange={e => { setRatesSearch(e.target.value); setRatesPage(1); }}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#C6AF4B] bg-white"
                />
              </div>
              <p className="text-xs text-gray-400 hidden sm:block flex-1">
                Rates vs {baseCurrency ? `${baseCurrency.name} (${baseCurrency.symbol})` : "base currency"}
              </p>
              <button
                onClick={handleRefreshRates}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#C6AF4B]/40 text-[#C6AF4B] hover:bg-[#C6AF4B]/8 transition disabled:opacity-60 shrink-0"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing…" : "Refresh Rates"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["#", "Currency", `1 CCY = X ${baseCurrency?.code ?? "Base"}`, `1 ${baseCurrency?.code ?? "Base"} = X CCY`, "Last Updated", "Source", "Action"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ratesLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : rates.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm">
                      No exchange rates yet. Click "Refresh Rates" to fetch current rates.
                    </td></tr>
                  ) : pagedRates.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm">No currencies match your search.</td></tr>
                  ) : pagedRates.map((r, idx) => {
                    const rate = parseFloat(r.rate);
                    const inverseRate = rate > 0 ? 1 / rate : 0;
                    const base = baseCurrency;
                    return (
                      <tr key={r.currency_code} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                        <td className="px-5 py-3 text-xs text-gray-400 font-medium">{(ratesPage - 1) * CURR_PER_PAGE + idx + 1}</td>
                        <td className="px-5 py-3">
                          <p className="font-mono font-bold text-gray-900">{r.currency_code}</p>
                          <p className="text-xs text-gray-400">{r.currency_name}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-semibold text-gray-900">
                            {base?.symbol}{inverseRate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5">
                            1 {r.currency_code} = {base?.symbol}{inverseRate.toFixed(2)} {base?.code}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          {editRate?.code === r.currency_code ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.0001"
                                value={editRate.value}
                                onChange={e => setEditRate(v => v ? { ...v, value: e.target.value } : null)}
                                className="w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#C6AF4B]"
                                autoFocus
                              />
                              <button onClick={handleSaveRate} disabled={savingRate} className="text-xs px-2.5 py-1.5 rounded-lg text-white font-medium transition disabled:opacity-60" style={{ backgroundColor: G }}>
                                {savingRate ? "…" : "Save"}
                              </button>
                              <button onClick={() => setEditRate(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className="font-semibold text-gray-700">{rate.toFixed(4)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(r.created_at)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${r.is_manual_override ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-600 border-blue-200"}`}>
                            {r.source_type}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setEditRate({ code: r.currency_code, value: r.rate })}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                            title="Override rate manually"
                          >
                            <Edit2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!ratesLoading && filteredRates.length > CURR_PER_PAGE && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  Showing {(ratesPage - 1) * CURR_PER_PAGE + 1}–{Math.min(ratesPage * CURR_PER_PAGE, filteredRates.length)} of {filteredRates.length}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setRatesPage(p => Math.max(1, p - 1))} disabled={ratesPage === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">Previous</button>
                  {Array.from({ length: totalRatesPages }, (_, i) => i + 1).map(pg => (
                    <button key={pg} onClick={() => setRatesPage(pg)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition ${pg === ratesPage ? "border-[#C6AF4B] text-[#C6AF4B] bg-[#C6AF4B]/8 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {pg}
                    </button>
                  ))}
                  <button onClick={() => setRatesPage(p => Math.min(totalRatesPages, p + 1))} disabled={ratesPage === totalRatesPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BANK DETAILS TAB
// ─────────────────────────────────────────────────────────

interface BankAccount {
  id: number;
  bank_name: string;
  account_no: string;
  ifsc_code: string;
  branch: string;
  account_name: string;
  bank_upi: string;
  is_default: boolean;
  created_at: string;
}

const BLANK_BANK = { bank_name: "", account_no: "", ifsc_code: "", branch: "", account_name: "", bank_upi: "", is_default: false };

function BankDetailsTab({ card, inp, label, toast }: any) {
  const token = localStorage.getItem("zarierp_token");
  const hdrs = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...BLANK_BANK });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/settings/bank-accounts", { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      setBanks(j.data ?? []);
    } catch { toast({ title: "Failed to load bank accounts", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  function openNew() { setForm({ ...BLANK_BANK }); setEditId(null); setShowForm(true); }
  function openEdit(b: BankAccount) {
    setForm({ bank_name: b.bank_name, account_no: b.account_no, ifsc_code: b.ifsc_code, branch: b.branch, account_name: b.account_name, bank_upi: b.bank_upi, is_default: b.is_default });
    setEditId(b.id); setShowForm(true);
  }

  async function handleSave() {
    if (!form.bank_name.trim()) { toast({ title: "Bank name required", variant: "destructive" }); return; }
    if (!form.account_no.trim()) { toast({ title: "Account number required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const method = editId ? "PUT" : "POST";
      const url = editId ? `/api/settings/bank-accounts/${editId}` : "/api/settings/bank-accounts";
      const r = await fetch(url, { method, headers: hdrs, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast({ title: editId ? "Bank account updated" : "Bank account added" });
      setShowForm(false); load();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleSetDefault(id: number) {
    try {
      await fetch(`/api/settings/bank-accounts/${id}/default`, { method: "PATCH", headers: hdrs });
      toast({ title: "Default bank account updated" });
      load();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await fetch(`/api/settings/bank-accounts/${id}`, { method: "DELETE", headers: hdrs });
      toast({ title: "Bank account deleted" });
      load();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setDeletingId(null); }
  }

  const inpClass = `${inp}`;
  const lbl = label;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`${card} p-5`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Landmark size={18} style={{ color: G }} />
            <h2 className="text-base font-bold text-gray-900">Bank Details</h2>
          </div>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
            style={{ backgroundColor: G }}
          >
            <Plus size={15} /> Add Bank Account
          </button>
        </div>
        <p className="text-sm text-gray-500">Manage bank accounts that appear on invoices. Mark one as default to pre-fill on new invoices.</p>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{editId ? "Edit Bank Account" : "Add Bank Account"}</h3>
            <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Bank Name *</label>
              <input className={inpClass} value={form.bank_name} onChange={e => setF("bank_name", e.target.value)} placeholder="e.g. HDFC Bank" />
            </div>
            <div>
              <label className={lbl}>Account Holder Name</label>
              <input className={inpClass} value={form.account_name} onChange={e => setF("account_name", e.target.value)} placeholder="Name on account" />
            </div>
            <div>
              <label className={lbl}>Account Number *</label>
              <input className={inpClass} value={form.account_no} onChange={e => setF("account_no", e.target.value)} placeholder="e.g. 0012345678900" />
            </div>
            <div>
              <label className={lbl}>IFSC Code</label>
              <input className={inpClass} value={form.ifsc_code} onChange={e => setF("ifsc_code", e.target.value.toUpperCase())} placeholder="e.g. HDFC0001234" />
            </div>
            <div>
              <label className={lbl}>Branch</label>
              <input className={inpClass} value={form.branch} onChange={e => setF("branch", e.target.value)} placeholder="e.g. Surat Main Branch" />
            </div>
            <div>
              <label className={lbl}>UPI ID</label>
              <input className={inpClass} value={form.bank_upi} onChange={e => setF("bank_upi", e.target.value)} placeholder="e.g. business@hdfc" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={e => setF("is_default", e.target.checked)}
                className="w-4 h-4 rounded accent-[#C6AF4B]"
              />
              <span className="text-sm font-medium text-gray-700">Set as default bank account for invoices</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60" style={{ backgroundColor: G }}>
              {saving ? "Saving…" : "Save Account"}
            </button>
          </div>
        </div>
      )}

      {/* Banks list */}
      <div className={`${card} p-0 overflow-hidden`}>
        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-gray-300" />
          </div>
        ) : banks.length === 0 ? (
          <div className="p-14 text-center">
            <CreditCard size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">No bank accounts added yet.</p>
            <button onClick={openNew} className="mt-4 text-sm font-medium underline" style={{ color: G }}>Add your first bank account</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {banks.map(b => (
              <div key={b.id} className={`flex items-start justify-between p-5 hover:bg-gray-50/50 transition ${b.is_default ? "bg-amber-50/30" : ""}`}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${G}18` }}>
                    <Landmark size={18} style={{ color: G }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-gray-900 text-sm">{b.bank_name}</span>
                      {b.is_default && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                          <Star size={10} fill="currentColor" /> Default
                        </span>
                      )}
                    </div>
                    {b.account_name && <p className="text-xs text-gray-500 mb-0.5">{b.account_name}</p>}
                    <div className="flex flex-wrap gap-x-5 gap-y-0.5 mt-1">
                      <span className="text-xs text-gray-600"><span className="text-gray-400">A/C:</span> {b.account_no}</span>
                      {b.ifsc_code && <span className="text-xs text-gray-600"><span className="text-gray-400">IFSC:</span> {b.ifsc_code}</span>}
                      {b.branch && <span className="text-xs text-gray-600"><span className="text-gray-400">Branch:</span> {b.branch}</span>}
                      {b.bank_upi && <span className="text-xs text-gray-600"><span className="text-gray-400">UPI:</span> {b.bank_upi}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {!b.is_default && (
                    <button
                      onClick={() => handleSetDefault(b.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600 transition"
                      title="Set as default"
                    >
                      Set Default
                    </button>
                  )}
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    disabled={deletingId === b.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ACTIVITY LOGS TAB
// ─────────────────────────────────────────────────────────

interface ActivityLog {
  id: number;
  user_email: string;
  user_name: string;
  method: string;
  url: string;
  action: string;
  status_code: number;
  ip_address: string;
  created_at: string;
}

const METHOD_COLORS: Record<string, string> = {
  POST:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  PUT:    "bg-blue-50 text-blue-700 border-blue-200",
  PATCH:  "bg-amber-50 text-amber-700 border-amber-200",
  DELETE: "bg-red-50 text-red-600 border-red-200",
};

function toPlainEnglish(method: string, url: string): string {
  const path = url.replace(/^\/api\//, "");
  const parts = path.split("/").filter(Boolean);
  const seg = (i: number) => parts[i] ?? "";
  const isId = (s: string) => /^\d+$/.test(s) || /^[0-9a-f-]{36}$/i.test(s);
  const M = method.toUpperCase();
  const verb = M === "POST" ? "Created" : M === "DELETE" ? "Deleted" : "Updated";

  if (seg(0) === "auth") {
    if (seg(1) === "login") return "Logged in";
    if (seg(1) === "logout") return "Logged out";
    if (seg(1) === "register" || seg(1) === "users") return "Created new user account";
    return "Authentication action";
  }

  if (seg(0) === "settings") {
    const s1 = seg(1);
    if (s1 === "currencies") {
      if (seg(2) === "base") return "Changed base currency";
      if (seg(3) === "toggle") return `Toggled currency ${seg(2).toUpperCase()}`;
      return `${verb} currency`;
    }
    if (s1 === "exchange-rates") {
      if (seg(2) === "refresh") return "Refreshed exchange rates from live data";
      if (seg(2) && !isId(seg(2))) return `Updated exchange rate for ${seg(2).toUpperCase()}`;
      return "Updated exchange rates";
    }
    if (s1 === "company") return "Updated company profile";
    if (s1 === "banks") return M === "DELETE" ? "Removed bank account" : seg(2) ? "Updated bank account" : "Added bank account";
    if (s1 === "gst") return "Updated GST settings";
    if (s1 === "users") return M === "DELETE" ? "Removed user" : seg(2) ? "Updated user account" : "Created user account";
    if (s1 === "warehouses") return M === "DELETE" ? "Removed warehouse location" : seg(2) ? "Updated warehouse location" : "Added warehouse location";
    if (s1 === "activity-logs") return "Viewed activity logs";
    if (s1 === "password") return "Changed password";
    return "Updated settings";
  }

  if (seg(0) === "procurement") {
    const s1 = seg(1);
    if (s1 === "purchase-orders") {
      const action = seg(3);
      if (action === "approve") return "Approved Purchase Order";
      if (action === "cancel") return "Cancelled Purchase Order";
      if (action === "items") return "Updated Purchase Order items";
      if (M === "DELETE") return "Deleted Purchase Order";
      return seg(2) ? "Updated Purchase Order" : "Created Purchase Order";
    }
    if (s1 === "purchase-receipts") {
      const action = seg(3);
      if (action === "confirm") return "Confirmed Purchase Receipt";
      if (action === "cancel") return "Cancelled Purchase Receipt";
      if (action === "vendor-invoice") return M === "DELETE" ? "Removed vendor invoice from Purchase Receipt" : "Uploaded vendor invoice to Purchase Receipt";
      if (M === "DELETE") return "Deleted Purchase Receipt";
      return seg(2) ? "Updated Purchase Receipt" : "Created Purchase Receipt";
    }
    if (s1 === "vendors") return M === "DELETE" ? "Deleted Vendor" : seg(2) ? "Updated Vendor" : "Added Vendor";
    if (s1 === "approved-pos") return "Viewed approved Purchase Orders";
    return `${verb} procurement record`;
  }

  if (seg(0) === "masters") {
    const names: Record<string, string> = {
      clients: "Client", products: "Product", vendors: "Vendor",
      "product-categories": "Product Category", "hsn-codes": "HSN Code",
      "unit-of-measure": "Unit of Measure",
    };
    const name = names[seg(1)] ?? seg(1).replace(/-/g, " ");
    if (M === "DELETE") return `Deleted ${name}`;
    return seg(2) ? `Updated ${name}` : `Created ${name}`;
  }

  if (seg(0) === "invoices") {
    const action = seg(2);
    if (action === "send") return "Sent Invoice to client";
    if (action === "cancel") return "Cancelled Invoice";
    if (M === "DELETE") return "Deleted Invoice";
    return seg(1) ? "Updated Invoice" : "Created Invoice";
  }

  if (seg(0) === "shipping") return "Updated shipping settings";
  if (seg(0) === "vendor-ledger") return "Viewed Vendor Ledger";

  const resource = parts.filter(p => !isId(p)).join(" › ").replace(/-/g, " ");
  return `${verb} ${resource}`.trim() || `${verb} record`;
}

function ActivityLogsTab({ card, isAdmin, currentUserEmail }: any) {
  const token = localStorage.getItem("zarierp_token");
  const hdrs = { Authorization: `Bearer ${token}` };

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [users, setUsers] = useState<{ user_email: string; user_name: string }[]>([]);
  const [filters, setFilters] = useState({ user_email: "", from: "", to: "", search: "" });
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
      if (filters.user_email) q.set("user_email", filters.user_email);
      if (filters.from) q.set("from", filters.from);
      if (filters.to) q.set("to", filters.to);
      if (filters.search) q.set("search", filters.search);
      const r = await fetch(`/api/settings/activity-logs?${q}`, { headers: hdrs });
      const j = await r.json();
      setLogs(j.data ?? []);
      setTotal(j.total ?? 0);
    } catch {}
    finally { setLoading(false); }
  }, [token, filters, page]);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetch("/api/settings/activity-logs/users", { headers: hdrs });
      const j = await r.json();
      setUsers(j.data ?? []);
    } catch {}
  }, [token, isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const setF = (k: string, v: string) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };
  const hasFilters = filters.user_email || filters.from || filters.to || filters.search;

  const totalPages = Math.ceil(total / PER_PAGE);

  async function handleExportCSV() {
    setExporting(true);
    try {
      const q = new URLSearchParams({ page: "1", limit: "10000" });
      if (filters.user_email) q.set("user_email", filters.user_email);
      if (filters.from) q.set("from", filters.from);
      if (filters.to) q.set("to", filters.to);
      const r = await fetch(`/api/settings/activity-logs?${q}`, { headers: hdrs });
      const j = await r.json();
      const all: ActivityLog[] = j.data ?? [];
      const header = ["#", "User Email", "User Name", "Method", "Action", "URL", "Status", "IP Address", "Date & Time"];
      const rows = all.map((l, i) => [
        i + 1, l.user_email, l.user_name, l.method, l.action, l.url, l.status_code, l.ip_address, fmtDateTime(l.created_at)
      ]);
      const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `activity-logs-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    } catch {}
    finally { setExporting(false); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`${card} p-5`}>
        <div className="flex items-center gap-2 mb-1">
          <Activity size={18} style={{ color: G }} />
          <h2 className="text-base font-bold text-gray-900">Activity Logs</h2>
          <div className="ml-auto flex items-center gap-3">
            {total > 0 && <span className="text-xs text-gray-400 font-medium">{total.toLocaleString()} total entries</span>}
            {isAdmin && (
              <button
                onClick={handleExportCSV}
                disabled={exporting || logs.length === 0}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                <Download size={13} /> {exporting ? "Exporting…" : "Export CSV"}
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {isAdmin ? "View all user activity across the system. Filter by user, date, or time range." : "Your recent activity in the system."}
        </p>
      </div>

      {/* Filters */}
      <div className={`${card} px-4 py-3`}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">
            <Filter size={12} /> Filters
          </div>

          <div className="w-px h-5 bg-gray-200 shrink-0" />

          <div className="flex items-center gap-3 flex-wrap flex-1">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search activity…"
                value={filters.search}
                onChange={e => setF("search", e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#C6AF4B] bg-white"
              />
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">User</span>
                <select
                  value={filters.user_email}
                  onChange={e => setF("user_email", e.target.value)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20 bg-white min-w-36"
                >
                  <option value="">All users</option>
                  {users.map(u => (
                    <option key={u.user_email} value={u.user_email}>{u.user_name || u.user_email}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">From</span>
              <input
                type="datetime-local"
                value={filters.from}
                onChange={e => setF("from", e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20 bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">To</span>
              <input
                type="datetime-local"
                value={filters.to}
                onChange={e => setF("to", e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20 bg-white"
              />
            </div>

            {hasFilters && (
              <button
                onClick={() => { setFilters({ user_email: "", from: "", to: "", search: "" }); setPage(1); }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={12} /> Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Logs table */}
      <div className={`${card} overflow-hidden`}>
        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-gray-300" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-14 text-center">
            <Activity size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">No activity logs found for the selected filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {(isAdmin
                      ? ["#", "User", "Type", "What Happened", "Result", "IP", "Date & Time"]
                      : ["#", "Type", "What Happened", "Result", "Date & Time"]
                    ).map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                      <td className="px-4 py-2.5 text-xs text-gray-400 font-medium">{(page - 1) * PER_PAGE + idx + 1}</td>
                      {isAdmin && (
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-semibold text-gray-800">
                            {log.user_name && log.user_name !== log.user_email ? log.user_name : "—"}
                          </p>
                          <p className="text-xs text-gray-400">{log.user_email}</p>
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${METHOD_COLORS[log.method] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {log.method === "POST" ? "New" : log.method === "DELETE" ? "Delete" : log.method === "PATCH" ? "Update" : log.method === "PUT" ? "Update" : log.method}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-700 max-w-xs">
                        <p className="font-medium leading-snug">
                          {/^(GET|POST|PUT|PATCH|DELETE) /.test(log.action)
                            ? toPlainEnglish(log.method, log.url)
                            : log.action}
                        </p>
                        <p className="text-gray-400 mt-0.5 font-mono truncate max-w-[220px]" title={log.url}>{log.url}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold ${log.status_code >= 400 ? "text-red-500" : log.status_code >= 300 ? "text-amber-500" : "text-emerald-600"}`}>
                          {log.status_code >= 400 ? "Failed" : log.status_code >= 300 ? "Redirected" : "Success"}
                        </span>
                      </td>
                      {isAdmin && <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{log.ip_address || "—"}</td>}
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 flex-wrap gap-2">
                <span className="text-xs text-gray-400">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()} entries
                </span>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
                    Previous
                  </button>
                  {(() => {
                    const pages: (number | "…")[] = [];
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (page > 3) pages.push("…");
                      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                      if (page < totalPages - 2) pages.push("…");
                      pages.push(totalPages);
                    }
                    return pages.map((pg, i) =>
                      pg === "…" ? (
                        <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-xs text-gray-400">…</span>
                      ) : (
                        <button key={pg} onClick={() => setPage(pg as number)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition ${pg === page ? "border-[#C6AF4B] text-[#C6AF4B] bg-[#C6AF4B]/8 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                          {pg}
                        </button>
                      )
                    );
                  })()}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// WAREHOUSE LOCATIONS TAB
// ─────────────────────────────────────────────────────────

interface WarehouseLocation {
  id: number;
  name: string;
  code: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  is_active: boolean;
  notes: string;
  created_at: string;
}

const BLANK_WH: Omit<WarehouseLocation, "id" | "created_at"> = {
  name: "", code: "", address_line1: "", address_line2: "", city: "", state: "",
  pincode: "", country: "India", contact_name: "", contact_phone: "", contact_email: "",
  is_active: true, notes: "",
};

function WarehouseTab({ card, inp, label, toast }: any) {
  const token = localStorage.getItem("zarierp_token");
  const hdrs = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [warehouses, setWarehouses] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...BLANK_WH });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/settings/warehouses", { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      setWarehouses(j.data ?? []);
    } catch { toast({ title: "Failed to load warehouses", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  function openNew() { setForm({ ...BLANK_WH }); setEditId(null); setShowForm(true); }
  function openEdit(w: WarehouseLocation) {
    const { id: _id, created_at: _ca, ...rest } = w;
    setForm(rest); setEditId(w.id); setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast({ title: "Warehouse name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const method = editId ? "PUT" : "POST";
      const url = editId ? `/api/settings/warehouses/${editId}` : "/api/settings/warehouses";
      const r = await fetch(url, { method, headers: hdrs, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast({ title: editId ? "Warehouse updated" : "Warehouse added" });
      setShowForm(false); load();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await fetch(`/api/settings/warehouses/${id}`, { method: "DELETE", headers: hdrs });
      toast({ title: "Warehouse deleted" });
      load();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setDeletingId(null); }
  }

  async function handleExportPDF() {
    setExportingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const G_HEX = [198, 175, 75] as [number, number, number];

      // Header
      doc.setFillColor(...G_HEX);
      doc.rect(0, 0, 297, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("ZARI EMBROIDERIES — Warehouse Locations", 14, 12);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, 283, 12, { align: "right" });

      // Table
      autoTable(doc, {
        startY: 24,
        head: [["Code", "Name", "Address", "City / State", "Pincode", "Country", "Contact Person", "Phone", "Email", "Status", "Notes"]],
        body: warehouses.map(w => [
          w.code || "—",
          w.name,
          [w.address_line1, w.address_line2].filter(Boolean).join(", ") || "—",
          [w.city, w.state].filter(Boolean).join(", ") || "—",
          w.pincode || "—",
          w.country || "—",
          w.contact_name || "—",
          w.contact_phone || "—",
          w.contact_email || "—",
          w.is_active ? "Active" : "Inactive",
          w.notes || "—",
        ]),
        headStyles: { fillColor: G_HEX, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [252, 248, 235] },
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 30 }, 2: { cellWidth: 40 }, 10: { cellWidth: 30 } },
        styles: { cellPadding: 3, lineColor: [230, 220, 190], lineWidth: 0.2 },
        margin: { left: 14, right: 14 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(180, 160, 80);
        doc.text(`Page ${i} of ${pageCount} — Confidential — ZARI EMBROIDERIES`, 148.5, 205, { align: "center" });
      }

      doc.save(`warehouses-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      toast({ title: "PDF export failed: " + e.message, variant: "destructive" });
    } finally { setExportingPdf(false); }
  }

  const lbl = label;
  const inpClass = inp;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`${card} p-5`}>
        <div className="flex items-center gap-2 mb-1">
          <Warehouse size={18} style={{ color: G }} />
          <h2 className="text-base font-bold text-gray-900">Warehouse Locations</h2>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={exportingPdf || warehouses.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              <FileText size={13} /> {exportingPdf ? "Generating…" : "Export PDF"}
            </button>
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
              style={{ backgroundColor: G }}
            >
              <Plus size={15} /> Add Warehouse
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500">Manage all warehouse and storage locations used in shipping and inventory operations.</p>
      </div>

      {/* Form */}
      {showForm && (
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{editId ? "Edit Warehouse" : "Add Warehouse"}</h3>
            <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"><X size={16} /></button>
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="col-span-2">
              <label className={lbl}>Warehouse Name *</label>
              <input className={inpClass} value={form.name} onChange={e => setF("name", e.target.value)} placeholder="e.g. Surat Main Warehouse" />
            </div>
            <div>
              <label className={lbl}>Code / Short Name</label>
              <input className={inpClass} value={form.code} onChange={e => setF("code", e.target.value.toUpperCase())} placeholder="e.g. SRT-01" />
            </div>
          </div>

          {/* Address */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><MapPin size={12} /> Address</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={lbl}>Address Line 1</label>
              <input className={inpClass} value={form.address_line1} onChange={e => setF("address_line1", e.target.value)} placeholder="Street / Building" />
            </div>
            <div>
              <label className={lbl}>Address Line 2</label>
              <input className={inpClass} value={form.address_line2} onChange={e => setF("address_line2", e.target.value)} placeholder="Area / Landmark" />
            </div>
            <div>
              <label className={lbl}>City</label>
              <input className={inpClass} value={form.city} onChange={e => setF("city", e.target.value)} placeholder="e.g. Surat" />
            </div>
            <div>
              <label className={lbl}>State</label>
              <input className={inpClass} value={form.state} onChange={e => setF("state", e.target.value)} placeholder="e.g. Gujarat" />
            </div>
            <div>
              <label className={lbl}>Pincode</label>
              <input className={inpClass} value={form.pincode} onChange={e => setF("pincode", e.target.value)} placeholder="e.g. 395003" />
            </div>
            <div>
              <label className={lbl}>Country</label>
              <input className={inpClass} value={form.country} onChange={e => setF("country", e.target.value)} placeholder="India" />
            </div>
          </div>

          {/* Contact */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Phone size={12} /> Contact Details</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className={lbl}>Contact Person</label>
              <input className={inpClass} value={form.contact_name} onChange={e => setF("contact_name", e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className={lbl}>Contact Phone</label>
              <input className={inpClass} value={form.contact_phone} onChange={e => setF("contact_phone", e.target.value)} placeholder="+91 9999999999" />
            </div>
            <div>
              <label className={lbl}>Contact Email</label>
              <input className={inpClass} value={form.contact_email} onChange={e => setF("contact_email", e.target.value)} placeholder="warehouse@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Notes</label>
              <textarea className={`${inpClass} resize-none`} rows={2} value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Optional notes about this warehouse" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_active} onChange={e => setF("is_active", e.target.checked)} className="w-4 h-4 rounded accent-[#C6AF4B]" />
                <span className="text-sm font-medium text-gray-700">Active warehouse</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60" style={{ backgroundColor: G }}>
              {saving ? "Saving…" : "Save Warehouse"}
            </button>
          </div>
        </div>
      )}

      {/* Warehouse cards */}
      {loading ? (
        <div className={`${card} p-10 flex items-center justify-center`}>
          <RefreshCw size={20} className="animate-spin text-gray-300" />
        </div>
      ) : warehouses.length === 0 ? (
        <div className={`${card} p-14 text-center`}>
          <Warehouse size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">No warehouses added yet.</p>
          <button onClick={openNew} className="mt-4 text-sm font-medium underline" style={{ color: G }}>Add your first warehouse</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {warehouses.map(w => (
            <div key={w.id} className={`${card} p-5`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${G}18` }}>
                    <Warehouse size={18} style={{ color: G }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-gray-900">{w.name}</span>
                      {w.code && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">{w.code}</span>}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${w.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                        {w.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2">
                      {(w.address_line1 || w.city) && (
                        <div className="flex items-start gap-1.5 text-xs text-gray-600">
                          <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
                          <span>
                            {[w.address_line1, w.address_line2, w.city, w.state, w.pincode, w.country].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      {w.contact_phone && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Phone size={12} className="text-gray-400 shrink-0" />
                          <span>{w.contact_name ? `${w.contact_name} · ` : ""}{w.contact_phone}</span>
                        </div>
                      )}
                      {w.contact_email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="text-gray-400">Email:</span> {w.contact_email}
                        </div>
                      )}
                      {w.notes && (
                        <div className="flex items-start gap-1.5 text-xs text-gray-400 italic col-span-2">
                          {w.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button onClick={() => openEdit(w)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(w.id)}
                    disabled={deletingId === w.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// GST SETTINGS TAB
// ─────────────────────────────────────────────────────────

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GST_MODES = ["Auto Detect", "Manual Selection"] as const;

interface GSTForm {
  company_gstin: string;
  company_state: string;
  company_country: string;
  export_under_lut_enabled: boolean;
  reverse_charge_enabled: boolean;
  gst_mode: string;
  default_service_gst_rate: string;
}

const EMPTY_GST: GSTForm = {
  company_gstin: "",
  company_state: "",
  company_country: "India",
  export_under_lut_enabled: true,
  reverse_charge_enabled: false,
  gst_mode: "Auto Detect",
  default_service_gst_rate: "18",
};

function GSTSettingsTab({ card, inp, label, toast }: any) {
  const [form, setForm] = useState<GSTForm>(EMPTY_GST);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    customFetch<any>("/api/settings/gst")
      .then(j => {
        if (j.data) {
          setForm({
            company_gstin:            j.data.company_gstin ?? "",
            company_state:            j.data.company_state ?? "",
            company_country:          j.data.company_country ?? "India",
            export_under_lut_enabled: !!j.data.export_under_lut_enabled,
            reverse_charge_enabled:   !!j.data.reverse_charge_enabled,
            gst_mode:                 j.data.gst_mode ?? "Auto Detect",
            default_service_gst_rate: String(j.data.default_service_gst_rate ?? "18"),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function f(k: keyof GSTForm, v: string | boolean) {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (form.company_gstin.trim() && !GSTIN_REGEX.test(form.company_gstin.trim().toUpperCase()))
      e.company_gstin = "Invalid GSTIN format (e.g. 27ABCDE1234F1Z5)";
    if (!form.company_state.trim()) e.company_state = "State is required";
    if (!form.company_country.trim()) e.company_country = "Country is required";
    if (!form.gst_mode) e.gst_mode = "GST mode is required";
    const rate = parseFloat(form.default_service_gst_rate);
    if (isNaN(rate) || rate < 0) e.default_service_gst_rate = "Must be 0 or greater";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSuccess(false);
    try {
      await customFetch("/api/settings/gst", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          company_gstin: form.company_gstin.trim().toUpperCase(),
          default_service_gst_rate: parseFloat(form.default_service_gst_rate),
        }),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
      toast({ title: "GST settings updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message?.replace(/^HTTP \d+[^:]*:\s*/, ""), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const Toggle = ({ value, onChange, id }: { value: boolean; onChange: (v: boolean) => void; id: string }) => (
    <button
      id={id}
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
        value
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
      }`}
    >
      {value
        ? <ToggleRight size={18} className="text-emerald-600" />
        : <ToggleLeft size={18} className="text-gray-400" />}
      {value ? "Yes — Enabled" : "No — Disabled"}
    </button>
  );

  if (loading) {
    return (
      <div className={`${card} p-8 flex items-center justify-center`}>
        <span className="h-6 w-6 border-2 border-[#C6AF4B]/30 border-t-[#C6AF4B] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className={`${card} p-6`}>
        <div className="flex items-center gap-3 mb-1 border-b border-gray-100 pb-4">
          <Receipt size={18} style={{ color: G }} />
          <div>
            <h2 className="font-bold text-gray-900 text-base">GST Settings</h2>
            <p className="text-xs text-gray-400 mt-0.5">Company GST configuration used across invoice generation and tax calculations</p>
          </div>
        </div>

        <div className="space-y-5 pt-1">

          {/* GSTIN */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Company GSTIN</label>
              <input
                value={form.company_gstin}
                onChange={e => f("company_gstin", e.target.value.toUpperCase())}
                className={`${inp} font-mono tracking-wider uppercase ${errors.company_gstin ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`}
                placeholder="27ABCDE1234F1Z5"
                maxLength={15}
              />
              {errors.company_gstin
                ? <p className="text-xs text-red-500 mt-1">{errors.company_gstin}</p>
                : <p className="text-xs text-gray-400 mt-1">Leave blank if not registered for GST</p>
              }
            </div>
            <div>
              <label className={label}>Default Service GST Rate (%)</label>
              <input
                type="number"
                min="0"
                max="28"
                step="0.01"
                value={form.default_service_gst_rate}
                onChange={e => f("default_service_gst_rate", e.target.value)}
                className={`${inp} ${errors.default_service_gst_rate ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`}
                placeholder="18"
              />
              {errors.default_service_gst_rate
                ? <p className="text-xs text-red-500 mt-1">{errors.default_service_gst_rate}</p>
                : <p className="text-xs text-gray-400 mt-1">Fallback rate when HSN code is absent</p>
              }
            </div>
          </div>

          {/* State + Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Company State <span className="text-red-400">*</span></label>
              <select
                value={form.company_state}
                onChange={e => f("company_state", e.target.value)}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 transition bg-white ${
                  errors.company_state
                    ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                    : "border-gray-200 focus:border-[#C6AF4B] focus:ring-[#C6AF4B]/20"
                }`}
              >
                <option value="">Select state…</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.company_state && <p className="text-xs text-red-500 mt-1">{errors.company_state}</p>}
              <p className="text-xs text-gray-400 mt-1">Used to determine CGST+SGST vs IGST</p>
            </div>
            <div>
              <label className={label}>Company Country <span className="text-red-400">*</span></label>
              <input
                value={form.company_country}
                onChange={e => f("company_country", e.target.value)}
                className={`${inp} ${errors.company_country ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`}
                placeholder="India"
              />
              {errors.company_country
                ? <p className="text-xs text-red-500 mt-1">{errors.company_country}</p>
                : <p className="text-xs text-gray-400 mt-1">Used for export invoice GST logic</p>
              }
            </div>
          </div>

          {/* GST Mode */}
          <div>
            <label className={label}>GST Mode <span className="text-red-400">*</span></label>
            <div className="flex gap-3">
              {GST_MODES.map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => f("gst_mode", mode)}
                  className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    form.gst_mode === mode
                      ? "bg-gray-900 border-gray-900 text-[#C6AF4B]"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            {errors.gst_mode && <p className="text-xs text-red-500 mt-1">{errors.gst_mode}</p>}
            {form.gst_mode === "Auto Detect" && (
              <div className="flex items-start gap-2 mt-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-600">System automatically determines CGST+SGST or IGST based on company state vs client state, and 0% GST for exports.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toggles card */}
      <div className={`${card} p-6`}>
        <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-4">
          <ToggleRight size={18} style={{ color: G }} />
          <h2 className="font-bold text-gray-900 text-base">Special GST Rules</h2>
        </div>

        <div className="space-y-5">
          {/* Export under LUT */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Export under LUT</p>
              <p className="text-xs text-gray-500 mt-0.5">
                When enabled, export invoices are issued without GST payment under Letter of Undertaking. Invoice GST will be set to 0%.
              </p>
            </div>
            <Toggle value={form.export_under_lut_enabled} onChange={v => f("export_under_lut_enabled", v)} id="lut" />
          </div>

          <div className="border-t border-gray-50" />

          {/* Reverse Charge */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Reverse Charge Mechanism</p>
              <p className="text-xs text-gray-500 mt-0.5">
                When enabled, GST liability on vendor invoices is reversed to the buyer (applicable for unregistered vendors and specific services).
              </p>
            </div>
            <Toggle value={form.reverse_charge_enabled} onChange={v => f("reverse_charge_enabled", v)} id="rcm" />
          </div>
        </div>
      </div>

      {/* Summary info card */}
      <div className={`${card} p-5`}>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            {
              label: "Intra-State Sales",
              value: "CGST + SGST",
              detail: `Client in ${form.company_state || "same state"}`,
              color: "text-emerald-600",
            },
            {
              label: "Inter-State Sales",
              value: "IGST",
              detail: "Client in different state",
              color: "text-blue-600",
            },
            {
              label: "Export Sales",
              value: form.export_under_lut_enabled ? "0% (LUT)" : "IGST 0%",
              detail: `Client outside ${form.company_country || "India"}`,
              color: "text-violet-600",
            },
          ].map(({ label: l, value, detail, color }) => (
            <div key={l} className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{l}</p>
              <p className={`text-sm font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{detail}</p>
            </div>
          ))}
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm">
          <CheckCircle2 size={16} /> GST settings updated successfully
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
          style={{ backgroundColor: G }}
        >
          {saving
            ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Save size={14} />}
          Save GST Settings
        </button>
      </div>
    </div>
  );
}

// ── Invoice Templates Tab ─────────────────────────────────────────────────────

interface InvoiceTemplate {
  id: number;
  name: string;
  layout: string;
  payment_terms: string;
  notes: string;
  is_default: boolean;
}

function TemplatePreview({ layout }: { layout: string }) {
  if (layout === "classic") {
    return (
      <div className="w-full h-32 bg-white border border-gray-100 rounded-lg overflow-hidden p-2 flex flex-col gap-1">
        <div className="h-5 rounded" style={{ backgroundColor: G, opacity: 0.9 }} />
        <div className="h-px bg-gray-200" />
        <div className="flex gap-1 mt-0.5">
          <div className="flex-1 flex flex-col gap-1">
            <div className="h-1.5 bg-gray-200 rounded w-3/4" />
            <div className="h-1.5 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="flex flex-col gap-1 items-end">
            <div className="h-1.5 bg-gray-200 rounded w-10" />
            <div className="h-1.5 bg-gray-100 rounded w-8" />
          </div>
        </div>
        <div className="mt-1 border border-gray-100 rounded overflow-hidden">
          {[0,1,2].map(i => (
            <div key={i} className="flex gap-1 px-1 py-0.5 border-b border-gray-50">
              <div className="h-1 bg-gray-200 rounded flex-1" />
              <div className="h-1 bg-gray-100 rounded w-5" />
              <div className="h-1 bg-gray-100 rounded w-5" />
            </div>
          ))}
        </div>
        <div className="h-px bg-gray-200 mt-auto" />
        <div className="h-1.5 bg-gray-100 rounded w-2/3" />
      </div>
    );
  }
  if (layout === "modern") {
    return (
      <div className="w-full h-32 bg-white border border-gray-100 rounded-lg overflow-hidden flex">
        <div className="w-1/3 h-full flex flex-col gap-1 p-2" style={{ backgroundColor: "#1a1a2e" }}>
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: G }} />
          <div className="h-1 bg-white/20 rounded w-full mt-1" />
          <div className="h-1 bg-white/10 rounded w-3/4" />
          <div className="h-1 bg-white/10 rounded w-1/2" />
          <div className="mt-auto h-1 bg-white/20 rounded w-full" />
        </div>
        <div className="flex-1 p-2 flex flex-col gap-1">
          <div className="h-3 rounded" style={{ backgroundColor: G, opacity: 0.15 }} />
          <div className="h-px bg-gray-100 mt-1" />
          {[0,1,2].map(i => (
            <div key={i} className="flex gap-1">
              <div className="h-1 bg-gray-200 rounded flex-1" />
              <div className="h-1 bg-gray-100 rounded w-4" />
            </div>
          ))}
          <div className="mt-auto flex justify-end">
            <div className="h-2 w-10 rounded" style={{ backgroundColor: G, opacity: 0.6 }} />
          </div>
        </div>
      </div>
    );
  }
  // premium
  return (
    <div className="w-full h-32 bg-white border border-gray-100 rounded-lg overflow-hidden flex flex-col">
      <div className="h-8 flex items-center justify-between px-2" style={{ background: `linear-gradient(135deg, #1a1a2e 60%, ${G})` }}>
        <div className="h-2 w-12 bg-white/80 rounded" />
        <div className="text-[7px] font-bold text-white/80 tracking-widest">INVOICE</div>
      </div>
      <div className="flex gap-1.5 px-2 py-1">
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="h-1 bg-gray-200 rounded w-2/3" />
          <div className="h-1 bg-gray-100 rounded w-1/2" />
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <div className="h-1 bg-gray-200 rounded w-8" />
          <div className="h-1 bg-gray-100 rounded w-6" />
        </div>
      </div>
      <div className="mx-2 border border-gray-100 rounded overflow-hidden">
        <div className="h-2 px-1" style={{ backgroundColor: G, opacity: 0.2 }}>
          <div className="flex gap-1 items-center h-full">
            <div className="h-0.5 bg-gray-400 rounded flex-1" />
            <div className="h-0.5 bg-gray-400 rounded w-4" />
            <div className="h-0.5 bg-gray-400 rounded w-4" />
          </div>
        </div>
        {[0,1].map(i => (
          <div key={i} className="flex gap-1 px-1 py-0.5">
            <div className="h-0.5 bg-gray-200 rounded flex-1" />
            <div className="h-0.5 bg-gray-100 rounded w-4" />
            <div className="h-0.5 bg-gray-100 rounded w-4" />
          </div>
        ))}
      </div>
      <div className="flex justify-end px-2 mt-1">
        <div className="h-2 w-12 rounded" style={{ backgroundColor: G, opacity: 0.7 }} />
      </div>
    </div>
  );
}

function InvoiceTemplatesTab({ card, toast }: any) {
  const token = localStorage.getItem("zarierp_token");
  const hdrs = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState({ payment_terms: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/settings/invoice-templates", { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      const tpls: InvoiceTemplate[] = j.data ?? [];
      setTemplates(tpls);
      const def = tpls.find(t => t.is_default) ?? tpls[0] ?? null;
      if (def) {
        setSelected(def.id);
        setForm({ payment_terms: def.payment_terms, notes: def.notes });
      }
    } catch { toast({ title: "Failed to load templates", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const selectTemplate = (t: InvoiceTemplate) => {
    setSelected(t.id);
    setForm({ payment_terms: t.payment_terms, notes: t.notes });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/settings/invoice-templates/${selected}`, {
        method: "PATCH",
        headers: hdrs,
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setTemplates(ts => ts.map(t => t.id === selected ? { ...t, ...j.data } : t));
      toast({ title: "Template saved successfully" });
    } catch (err: any) {
      toast({ title: err.message ?? "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleSetDefault = async () => {
    if (!selected) return;
    setSettingDefault(true);
    try {
      const r = await fetch(`/api/settings/invoice-templates/${selected}/set-default`, {
        method: "POST", headers: hdrs,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setTemplates(ts => ts.map(t => ({ ...t, is_default: t.id === selected })));
      toast({ title: "Default template updated" });
    } catch (err: any) {
      toast({ title: err.message ?? "Failed", variant: "destructive" });
    } finally { setSettingDefault(false); }
  };

  const selectedTpl = templates.find(t => t.id === selected);
  const LAYOUT_LABELS: Record<string, string> = {
    classic: "Classic",
    modern: "Modern",
    premium: "Premium",
  };
  const LAYOUT_DESC: Record<string, string> = {
    classic: "Traditional full-width layout with formal header, line items table, and payment summary at bottom.",
    modern: "Two-column design with dark sidebar for company info and clean content area on the right.",
    premium: "Bold gradient header with branded styling — ideal for high-value and export invoices.",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Invoice Templates</h2>
        <p className="text-sm text-gray-500 mt-0.5">Choose a default layout and configure payment terms and notes printed on every invoice.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading templates…</div>
      ) : (
        <>
          {/* Template cards */}
          <div className="grid grid-cols-3 gap-4">
            {templates.map(t => {
              const isSelected = t.id === selected;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`relative text-left rounded-2xl border-2 p-3 transition-all group ${
                    isSelected
                      ? "border-[#C6AF4B] shadow-md shadow-[#C6AF4B]/20"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Default badge */}
                  {t.is_default && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: "#C6AF4B22", color: G }}>
                      <Check size={9} /> Default
                    </span>
                  )}

                  {/* Visual preview */}
                  <TemplatePreview layout={t.layout} />

                  <div className="mt-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-800">{LAYOUT_LABELS[t.layout] ?? t.name}</span>
                      {isSelected && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: G }}>
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-tight line-clamp-2">
                      {LAYOUT_DESC[t.layout] ?? ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Edit panel */}
          {selectedTpl && (
            <div className={`${card} space-y-4 p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <ChevronRight size={14} style={{ color: G }} />
                    Editing: {LAYOUT_LABELS[selectedTpl.layout] ?? selectedTpl.name} Template
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5 ml-5">These fields will be printed on every invoice using this template.</p>
                </div>
                <button
                  onClick={handleSetDefault}
                  disabled={settingDefault || selectedTpl.is_default}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                    selectedTpl.is_default
                      ? "border-[#C6AF4B40] text-[#C6AF4B] bg-[#C6AF4B0D] cursor-default"
                      : "border-gray-200 text-gray-600 hover:border-[#C6AF4B] hover:text-[#C6AF4B]"
                  }`}
                >
                  {settingDefault
                    ? <span className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
                    : <Check size={12} />}
                  {selectedTpl.is_default ? "Default Template" : "Set as Default"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Payment Terms</label>
                  <textarea
                    rows={4}
                    value={form.payment_terms}
                    onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}
                    placeholder="e.g. Payment due within 30 days of invoice date…"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 focus:border-[#C6AF4B] placeholder:text-gray-400"
                  />
                  <p className="text-[11px] text-gray-400">Printed in the Payment Terms section of the invoice.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Notes / Footer Message</label>
                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Thank you for your business. Cheques payable to…"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-[#C6AF4B]/30 focus:border-[#C6AF4B] placeholder:text-gray-400"
                  />
                  <p className="text-[11px] text-gray-400">Appears at the bottom of the printed invoice.</p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
                  style={{ backgroundColor: G }}
                >
                  {saving
                    ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Save size={14} />}
                  Save Template
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
