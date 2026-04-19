import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  User, Lock, Globe, ChevronDown, ChevronUp, Save, RefreshCw,
  Eye, EyeOff, Camera, CheckCircle2, AlertCircle, Edit2, X
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";

const G = "#C6AF4B";

type Tab = "profile" | "currency";

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
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {tab === "profile" && <ProfileTab card={card} inp={inp} label={label} toast={toast} userId={user?.id} />}
            {tab === "currency" && isAdmin && <CurrencyTab card={card} inp={inp} label={label} toast={toast} />}
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

function CurrencyTab({ card, inp, label, toast }: any) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [baseSaving, setBaseSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editRate, setEditRate] = useState<{ code: string; value: string } | null>(null);
  const [savingRate, setSavingRate] = useState(false);
  const [currencySuccess, setCurrencySuccess] = useState("");

  const baseCurrency = currencies.find(c => c.is_base);

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

  return (
    <div className="space-y-5">
      {currencySuccess && (
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm">
          <CheckCircle2 size={16} /> {currencySuccess}
        </div>
      )}

      {/* Base Currency */}
      <div className={`${card} p-6`}>
        <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-4">
          <Globe size={18} style={{ color: G }} />
          <div>
            <h2 className="font-bold text-gray-900 text-base">Base Currency</h2>
            <p className="text-xs text-gray-400 mt-0.5">All exchange rates are calculated relative to this currency</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className={label}>Select Base Currency</label>
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
            <div className="mt-5 px-4 py-2 rounded-xl border border-[#C6AF4B]/30 bg-[#C6AF4B]/8 text-center">
              <p className="text-2xl font-bold" style={{ color: G }}>{baseCurrency.symbol}</p>
              <p className="text-xs text-gray-500 mt-0.5">{baseCurrency.code}</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Currencies */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Active Currencies</h2>
            <p className="text-xs text-gray-400 mt-0.5">Only active currencies appear in invoices and payments</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Code", "Name", "Symbol", "Decimals", "Status", "Action"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">{h}</th>
                ))}
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
              ) : currencies.map(c => (
                <tr key={c.code} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
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
      </div>

      {/* Exchange Rates */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Exchange Rates</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Rates vs {baseCurrency ? `${baseCurrency.name} (${baseCurrency.symbol})` : "base currency"} — sorted by last updated
            </p>
          </div>
          <button
            onClick={handleRefreshRates}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#C6AF4B]/40 text-[#C6AF4B] hover:bg-[#C6AF4B]/8 transition disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh Exchange Rates"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Currency", "Rate", "Last Updated", "Source", "Action"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ratesLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : rates.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-gray-400 text-sm">
                  No exchange rates yet. Click "Refresh Exchange Rates" to fetch current rates.
                </td></tr>
              ) : rates.map(r => (
                <tr key={r.currency_code} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="px-5 py-3">
                    <p className="font-mono font-bold text-gray-900">{r.currency_code}</p>
                    <p className="text-xs text-gray-400">{r.currency_name}</p>
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
                      <span className="font-semibold text-gray-900">{parseFloat(r.rate).toFixed(4)}</span>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
