import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function AcceptInvite() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";

  const [userData, setUserData] = useState<{ username: string; email: string } | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setTokenError("No invite token found."); return; }
    fetch(`${API}/auth/invite/${token}`)
      .then(r => r.json())
      .then(j => {
        if (j.error) setTokenError(j.error);
        else setUserData(j.data);
      })
      .catch(() => setTokenError("Unable to validate invite link."));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to activate account"); return; }
      setDone(true);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-[100dvh] flex">
      <div className="hidden md:flex md:w-1/2 bg-black flex-col justify-between p-10 text-white">
        <div className="flex flex-col leading-none select-none">
          <span className="text-base font-bold tracking-widest uppercase" style={{ color: "#C9B45C", letterSpacing: "0.18em" }}>ZARI</span>
          <span className="text-[9px] font-medium tracking-[0.25em] text-gray-400 uppercase">EMBROIDERIES</span>
        </div>
        <div>
          <p className="text-4xl font-light leading-tight">You've been<br />invited to join<br />ZARI ERP.</p>
        </div>
        <p className="text-xs text-gray-500">ZARI EMBROIDERIES © {new Date().getFullYear()}</p>
      </div>

      <div className="flex-1 flex items-center justify-center bg-[#f8f9fb] px-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Account Activated!</h2>
              <p className="text-sm text-gray-500">Your account is ready. You can now sign in with your email and the password you just set.</p>
              <button onClick={() => setLocation("/login")}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-900 text-[#C9B45C] hover:bg-gray-800 transition-colors">
                Go to Sign In
              </button>
            </div>
          ) : tokenError ? (
            <div className="text-center space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Invalid Invite</h2>
              <p className="text-sm text-red-500">{tokenError}</p>
              <p className="text-xs text-gray-400">Please ask your admin to send a new invite link.</p>
            </div>
          ) : !userData ? (
            <div className="text-center py-8 text-sm text-gray-400">Validating invite…</div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Set Your Password</h2>
                <p className="text-sm text-gray-400 mt-1">Welcome, <strong>{userData.username}</strong>! Set a password for <strong>{userData.email}</strong>.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Min 8 characters" required />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setError(""); }}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Re-enter your password" required />
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-60 transition-colors">
                  {loading ? "Activating…" : "Activate Account"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
