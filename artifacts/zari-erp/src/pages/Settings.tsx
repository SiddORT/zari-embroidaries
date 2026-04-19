import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  User, Lock, Globe, ChevronDown, ChevronUp, Save, RefreshCw,
  Eye, EyeOff, Camera, CheckCircle2, AlertCircle, Edit2, X,
  Building2, Activity, Trash2, Star, Plus, Filter, Search,
  CreditCard, Landmark
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import AppLayout from "@/components/layout/AppLayout";

const G = "#C6AF4B";

type Tab = "profile" | "currency" | "banks" | "logs";

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
              <NavItem icon={<Activity size={16} />} label="Activity Logs" active={tab === "logs"} onClick={() => setTab("logs")} />
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {tab === "profile" && <ProfileTab card={card} inp={inp} label={label} toast={toast} userId={user?.id} />}
            {tab === "currency" && isAdmin && <CurrencyTab card={card} inp={inp} label={label} toast={toast} />}
            {tab === "banks" && isAdmin && <BankDetailsTab card={card} inp={inp} label={label} toast={toast} />}
            {tab === "logs" && <ActivityLogsTab card={card} isAdmin={isAdmin} currentUserEmail={user?.email ?? ""} />}
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
            {/* Currencies table */}
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
        )}

        {/* ── TAB: Exchange Rates ──────────────────────────── */}
        {innerTab === "rates" && (
          <div>
            {/* Header with refresh button */}
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Rates vs {baseCurrency ? `${baseCurrency.name} (${baseCurrency.symbol})` : "base currency"} — sorted by last updated
              </p>
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
                    {["Currency", `1 CCY = X ${baseCurrency?.code ?? "Base"}`, `1 ${baseCurrency?.code ?? "Base"} = X CCY`, "Last Updated", "Source", "Action"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ratesLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : rates.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-gray-400 text-sm">
                      No exchange rates yet. Click "Refresh Exchange Rates" to fetch current rates.
                    </td></tr>
                  ) : rates.map(r => {
                    const rate = parseFloat(r.rate);
                    const inverseRate = rate > 0 ? 1 / rate : 0;
                    const base = baseCurrency;
                    return (
                      <tr key={r.currency_code} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
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

function ActivityLogsTab({ card, isAdmin, currentUserEmail }: any) {
  const token = localStorage.getItem("zarierp_token");
  const hdrs = { Authorization: `Bearer ${token}` };

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{ user_email: string; user_name: string }[]>([]);
  const [filters, setFilters] = useState({ user_email: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
      if (filters.user_email) q.set("user_email", filters.user_email);
      if (filters.from) q.set("from", filters.from);
      if (filters.to) q.set("to", filters.to);
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

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`${card} p-5`}>
        <div className="flex items-center gap-2 mb-1">
          <Activity size={18} style={{ color: G }} />
          <h2 className="text-base font-bold text-gray-900">Activity Logs</h2>
          {total > 0 && <span className="ml-auto text-xs text-gray-400 font-medium">{total.toLocaleString()} total entries</span>}
        </div>
        <p className="text-sm text-gray-500">
          {isAdmin ? "View all user activity across the system. Filter by user, date, or time range." : "Your recent activity in the system."}
        </p>
      </div>

      {/* Filters */}
      <div className={`${card} p-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <Filter size={13} /> Filters
          </div>

          {isAdmin && (
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium text-gray-500 mb-1">User</label>
              <select
                value={filters.user_email}
                onChange={e => setF("user_email", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20"
              >
                <option value="">All users</option>
                {users.map(u => (
                  <option key={u.user_email} value={u.user_email}>{u.user_name || u.user_email}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="datetime-local"
              value={filters.from}
              onChange={e => setF("from", e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="datetime-local"
              value={filters.to}
              onChange={e => setF("to", e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#C6AF4B] focus:ring-2 focus:ring-[#C6AF4B]/20"
            />
          </div>

          {(filters.user_email || filters.from || filters.to) && (
            <button
              onClick={() => { setFilters({ user_email: "", from: "", to: "" }); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition mt-4"
            >
              <X size={12} /> Clear
            </button>
          )}
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
                    {(isAdmin ? ["User", "Method", "Action", "URL", "Status", "IP", "Date & Time"] : ["Method", "Action", "URL", "Status", "Date & Time"]).map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                      {isAdmin && (
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-semibold text-gray-800">{log.user_name || log.user_email}</p>
                          {log.user_name && <p className="text-xs text-gray-400">{log.user_email}</p>}
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${METHOD_COLORS[log.method] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {log.method}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-700 font-medium whitespace-nowrap">{log.action}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 font-mono max-w-48 truncate" title={log.url}>{log.url}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold ${log.status_code >= 400 ? "text-red-500" : log.status_code >= 300 ? "text-amber-500" : "text-emerald-600"}`}>
                          {log.status_code}
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  Page {page} of {totalPages} · {total} entries
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
                  >
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
