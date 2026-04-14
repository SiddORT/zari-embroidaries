import { useState } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useForgotPassword, useResetPassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
});

type RequestFormValues = z.infer<typeof requestSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState<"request" | "reset" | "success">("request");
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const forgotMutation = useForgotPassword();
  const resetMutation = useResetPassword();

  const requestForm = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: "", newPassword: "" },
  });

  const onRequestSubmit = (values: RequestFormValues) => {
    forgotMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setUserEmail(values.email);
          if (data.resetToken) {
            // Pre-fill the token for convenience in this test environment
            resetForm.setValue("token", data.resetToken);
          }
          setStep("reset");
          toast({
            title: "Reset Code Sent",
            description: "Check your email for the reset instructions.",
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Unable to process request. Please try again.",
          });
        },
      }
    );
  };

  const onResetSubmit = (values: ResetFormValues) => {
    resetMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          setStep("success");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Reset Failed",
            description: error.data?.error || "Invalid or expired token.",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background w-full">
      {/* Left side - Branding */}
      <div className="hidden md:flex flex-col flex-1 bg-sidebar border-r border-border p-12 justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1600164318625-f71eeeb481dd?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="relative z-10">
          <Link href="/login">
            <img src={ZariLogo} alt="ZARI Embroideries" className="h-12 w-auto mb-8 cursor-pointer" />
          </Link>
          <h1 className="text-4xl font-serif tracking-tight text-foreground max-w-md mt-16 leading-snug">
            Secure your access.
          </h1>
        </div>
      </div>

      {/* Right side - Forms */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-24 py-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="md:hidden mb-12 flex justify-center">
            <img src={ZariLogo} alt="ZARI Embroideries" className="h-10 w-auto" />
          </div>

          <Link href="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to login
          </Link>

          {step === "request" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-medium tracking-tight text-foreground">Forgot Password</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <Form {...requestForm}>
                <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="space-y-6">
                  <FormField
                    control={requestForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="name@zari.com"
                            type="email"
                            autoCapitalize="none"
                            autoComplete="email"
                            disabled={forgotMutation.isPending}
                            className="bg-card border-border"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors h-11"
                    disabled={forgotMutation.isPending}
                  >
                    {forgotMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {step === "reset" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-medium tracking-tight text-foreground">Set New Password</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter the reset token sent to {userEmail} and your new password.
                </p>
              </div>

              <Form {...resetForm}>
                <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-6">
                  <FormField
                    control={resetForm.control}
                    name="token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reset Token</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter token"
                            disabled={resetMutation.isPending}
                            className="bg-card border-border"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resetForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              disabled={resetMutation.isPending}
                              className="bg-card border-border pr-10"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                              onClick={() => setShowPassword(!showPassword)}
                              disabled={resetMutation.isPending}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors h-11"
                    disabled={resetMutation.isPending}
                  >
                    {resetMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {step === "success" && (
            <div className="animate-in fade-in zoom-in-95 duration-500 text-center py-8">
              <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-medium tracking-tight text-foreground mb-2">Password Reset Complete</h2>
              <p className="text-muted-foreground mb-8">
                Your password has been successfully updated. You can now log in with your new credentials.
              </p>
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11"
                onClick={() => setLocation("/login")}
              >
                Return to Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
