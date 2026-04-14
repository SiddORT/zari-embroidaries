import { useState } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useLogin } from "@workspace/api-client-react";
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

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
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
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background w-full">
      {/* Left side - Branding / Graphic */}
      <div className="hidden md:flex flex-col flex-1 bg-sidebar border-r border-border p-12 justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1600164318625-f71eeeb481dd?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="relative z-10">
          <img src={ZariLogo} alt="ZARI Embroideries" className="h-12 w-auto mb-8" />
          <h1 className="text-4xl font-serif tracking-tight text-foreground max-w-md mt-16 leading-snug">
            Precision, craft, and scale.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-sm text-lg">
            The enterprise resource platform for Zari Embroideries.
          </p>
        </div>
        <div className="relative z-10">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Zari Embroideries. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-24 py-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="md:hidden mb-12 flex justify-center">
            <img src={ZariLogo} alt="ZARI Embroideries" className="h-10 w-auto" />
          </div>
          
          <div className="mb-8">
            <h2 className="text-2xl font-medium tracking-tight text-foreground">Sign In</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Enter your credentials to access your account.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
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
                        autoCorrect="off"
                        disabled={loginMutation.isPending}
                        className="bg-card border-border"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link href="/forgot-password" className="text-sm text-primary hover:text-primary/80 transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoCapitalize="none"
                          autoComplete="current-password"
                          disabled={loginMutation.isPending}
                          className="bg-card border-border pr-10"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={loginMutation.isPending}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          <span className="sr-only">
                            {showPassword ? "Hide password" : "Show password"}
                          </span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors h-11 text-base font-medium"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
