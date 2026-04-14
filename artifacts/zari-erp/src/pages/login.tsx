import { useState } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import ZariButton from "@/components/ui/ZariButton";
import ZariLogo from "@assets/image_1776152751088.png";

const loginSchema = z.object({
  email: z.string().min(1, { message: "Username or email is required." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          localStorage.setItem("zarierp_token", data.token);
          toast({
            title: "Login Successful",
            description: "Welcome back to ZARI ERP.",
            className: "bg-green-600 text-white border-green-700",
          });
          setLocation("/dashboard");
        },
        onError: (error) => {
          let errorMessage = "Unable to connect. Please try again.";
          if (error.response?.status === 401) {
            errorMessage = "Invalid email or password";
          } else if (error.data?.error === "Account disabled") {
            errorMessage = "Your account has been disabled";
          }
          toast({
            variant: "destructive",
            title: "Authentication Failed",
            description: errorMessage,
          });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row w-full">

      {/* LEFT SIDE — Dark branding panel */}
      <div className="hidden md:flex flex-col flex-1 bg-black px-16 py-12 justify-between">
        {/* Top logo */}
        <div>
          <img
            src={ZariLogo}
            alt="ZARI Embroideries"
            className="h-14 w-auto brightness-90"
          />
        </div>

        {/* Center text */}
        <div>
          <h1 className="text-5xl font-serif text-white leading-tight tracking-tight max-w-md">
            Precision crafted for the art of embroidery.
          </h1>
        </div>

        {/* Bottom text */}
        <div>
          <p className="text-sm text-white/40 tracking-wide uppercase">
            ZARI EMBROIDERIES &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* RIGHT SIDE — Light login panel */}
      <div className="flex-1 flex flex-col justify-center items-center bg-gray-100 px-6 py-12">

        {/* Mobile logo */}
        <div className="md:hidden mb-10 flex justify-center">
          <img src={ZariLogo} alt="ZARI Embroideries" className="h-10 w-auto" />
        </div>

        {/* Login card */}
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg px-10 py-10">

          {/* Headings */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Welcome Back
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Sign in to your ERP workspace
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* Username or Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-gray-700"
              >
                Username or Email
              </label>
              <input
                id="email"
                type="text"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                placeholder="name@zarierp.com"
                disabled={loginMutation.isPending}
                {...form.register("email")}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 mt-0.5">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  disabled={loginMutation.isPending}
                  {...form.register("password")}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-11 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loginMutation.isPending}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Forgot password — right aligned */}
              <div className="flex justify-end mt-0.5">
                <Link
                  href="/forgot-password"
                  className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {form.formState.errors.password && (
                <p className="text-xs text-red-500 -mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Sign In button */}
            <ZariButton
              type="submit"
              fullWidth
              loading={loginMutation.isPending}
              className="mt-2 py-3"
            >
              {loginMutation.isPending ? "Authenticating..." : "Sign In"}
            </ZariButton>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-gray-400">
            ZARI EMBROIDERIES &copy; {new Date().getFullYear()} &mdash; Enterprise Resource Planning
          </p>
        </div>
      </div>
    </div>
  );
}
