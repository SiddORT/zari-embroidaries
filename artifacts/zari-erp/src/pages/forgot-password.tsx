import { useState } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useForgotPassword, useResetPassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import ZariButton from "@/components/ui/ZariButton";
import ZariLogo from "@assets/image_1776152751088.png";

const requestSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

const resetSchema = z.object({
  token: z.string().min(1, { message: "Reset token is required." }),
  newPassword: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
    .regex(/[A-Z]/, { message: "Must contain at least one uppercase letter." })
    .regex(/[0-9]/, { message: "Must contain at least one number." })
    .regex(/[^A-Za-z0-9]/, { message: "Must contain at least one special character." }),
  confirmPassword: z.string().min(1, { message: "Please confirm your password." }),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type RequestFormValues = z.infer<typeof requestSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<"request" | "reset" | "success">("request");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const forgotMutation = useForgotPassword();
  const resetMutation = useResetPassword();

  const requestForm = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: "", newPassword: "", confirmPassword: "" },
  });

  const onRequestSubmit = (values: RequestFormValues) => {
    forgotMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          setUserEmail(values.email);
          setStep("reset");
          toast({
            title: "Reset Token Sent",
            description: `Check ${values.email} for your password reset token.`,
          });
        },
        onError: (err) => {
          const message = (err as { data?: { error?: string }; message?: string })?.data?.error
            ?? (err as { message?: string })?.message
            ?? "Unable to process request. Please try again.";
          requestForm.setError("email", { message });
        },
      }
    );
  };

  const onResetSubmit = (values: ResetFormValues) => {
    resetMutation.mutate(
      { data: { token: values.token, newPassword: values.newPassword } },
      {
        onSuccess: () => setStep("success"),
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Reset Failed",
            description: (error as { data?: { error?: string } }).data?.error || "Invalid or expired token.",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row w-full">

      {/* LEFT — dark branding panel */}
      <div className="hidden md:flex flex-col flex-1 bg-black px-16 py-12 justify-between">
        <div>
          <img src={ZariLogo} alt="ZARI Embroideries" className="h-14 w-auto brightness-90" />
        </div>
        <div>
          <h1 className="text-5xl font-serif text-white leading-tight tracking-tight max-w-md">
            Precision crafted for the art of embroidery.
          </h1>
        </div>
        <div>
          <p className="text-sm text-white/40 tracking-wide uppercase">
            ZARI EMBROIDERIES &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* RIGHT — light panel */}
      <div className="flex-1 flex flex-col justify-center items-center bg-gray-100 px-6 py-12">

        {/* Mobile logo */}
        <div className="md:hidden mb-10">
          <img src={ZariLogo} alt="ZARI Embroideries" className="h-10 w-auto" />
        </div>

        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg px-10 py-10">

          {/* Back to login */}
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>

          {/* ─── STEP 1 — Request reset ─── */}
          {step === "request" && (
            <div>
              <div className="mb-7">
                <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Forgot Password</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="space-y-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder="name@zarierp.com"
                    disabled={forgotMutation.isPending}
                    {...requestForm.register("email")}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
                  />
                  {requestForm.formState.errors.email && (
                    <p className="text-xs text-red-500">{requestForm.formState.errors.email.message}</p>
                  )}
                </div>

                <ZariButton
                  type="submit"
                  fullWidth
                  loading={forgotMutation.isPending}
                  className="py-3"
                >
                  {forgotMutation.isPending ? "Sending..." : "Send Reset Link"}
                </ZariButton>
              </form>

              <p className="mt-8 text-center text-xs text-gray-400">
                ZARI EMBROIDERIES &copy; {new Date().getFullYear()} &mdash; Enterprise Resource Planning
              </p>
            </div>
          )}

          {/* ─── STEP 2 — Reset password ─── */}
          {step === "reset" && (
            <div>
              <div className="mb-7">
                <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Set New Password</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enter the reset token sent to <span className="font-medium text-gray-700">{userEmail}</span> and choose a new password.
                </p>
              </div>

              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-5">
                {/* Token */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="token" className="text-sm font-medium text-gray-700">
                    Reset Token
                  </label>
                  <input
                    id="token"
                    type="text"
                    placeholder="Paste your reset token"
                    disabled={resetMutation.isPending}
                    {...resetForm.register("token")}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
                  />
                  {resetForm.formState.errors.token && (
                    <p className="text-xs text-red-500">{resetForm.formState.errors.token.message}</p>
                  )}
                </div>

                {/* New password */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showNew ? "text" : "password"}
                      placeholder="••••••••"
                      disabled={resetMutation.isPending}
                      {...resetForm.register("newPassword")}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-11 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={showNew ? "Hide password" : "Show password"}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {resetForm.formState.errors.newPassword && (
                    <p className="text-xs text-red-500">{resetForm.formState.errors.newPassword.message}</p>
                  )}
                </div>

                {/* Confirm password */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      disabled={resetMutation.isPending}
                      {...resetForm.register("confirmPassword")}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-11 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-red-500">{resetForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <ZariButton
                  type="submit"
                  fullWidth
                  loading={resetMutation.isPending}
                  className="py-3"
                >
                  {resetMutation.isPending ? "Resetting..." : "Reset Password"}
                </ZariButton>
              </form>

              <p className="mt-8 text-center text-xs text-gray-400">
                ZARI EMBROIDERIES &copy; {new Date().getFullYear()} &mdash; Enterprise Resource Planning
              </p>
            </div>
          )}

          {/* ─── STEP 3 — Success ─── */}
          {step === "success" && (
            <div className="text-center py-6">
              <div className="mx-auto h-16 w-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mb-5">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Password Reset Complete</h2>
              <p className="text-sm text-gray-500 mb-7">
                Your password has been updated. You can now sign in with your new credentials.
              </p>
              <ZariButton
                fullWidth
                onClick={() => setLocation("/login")}
                className="py-3"
              >
                Return to Sign In
              </ZariButton>

              <p className="mt-8 text-center text-xs text-gray-400">
                ZARI EMBROIDERIES &copy; {new Date().getFullYear()} &mdash; Enterprise Resource Planning
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
