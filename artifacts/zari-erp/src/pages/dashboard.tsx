import { useEffect } from "react";
import { useLocation } from "wouter";
import { LogOut, LayoutDashboard, Package, Users, Settings, Activity } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ZariLogo from "@assets/image_1776152751088.png";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("zarierp_token");

  // Only run the query if we have a token
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false, // Don't retry on 401s
    },
  });

  const logoutMutation = useLogout();

  // Redirect if no token or error fetching user (e.g. 401)
  useEffect(() => {
    if (!token || isError) {
      localStorage.removeItem("zarierp_token");
      setLocation("/login");
    }
  }, [token, isError, setLocation]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("zarierp_token");
        queryClient.clear(); // Clear all cached queries
        setLocation("/login");
      },
      onError: () => {
        // Even if the server request fails, clear local state
        localStorage.removeItem("zarierp_token");
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-32 bg-card" />
          <Skeleton className="h-4 w-48 bg-card" />
        </div>
      </div>
    );
  }

  const modules = [
    { title: "Inventory", icon: Package, count: "12,450", trend: "+2.4%" },
    { title: "Orders", icon: Activity, count: "342", trend: "+12.1%" },
    { title: "Staff", icon: Users, count: "89", trend: "0%" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="h-16 border-b border-border bg-sidebar flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <img src={ZariLogo} alt="ZARI" className="h-8 w-auto" />
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <span className="text-primary font-medium flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </span>
            <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              Production
            </span>
            <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              Logistics
            </span>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-foreground">{user.username}</div>
            <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
          </div>
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium border border-primary/30">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-2"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <h1 className="text-3xl font-serif text-foreground tracking-tight">
            Welcome back, {user.username}.
          </h1>
          <p className="text-muted-foreground mt-2">
            Here's what's happening across the enterprise today.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {modules.map((module, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary/10 text-primary rounded-md">
                  <module.icon className="h-5 w-5" />
                </div>
                <span className={`text-xs font-medium ${module.trend.startsWith('+') ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {module.trend}
                </span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">
                {module.count}
              </div>
              <div className="text-sm text-muted-foreground mt-1 font-medium">
                {module.title}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6 min-h-[400px] flex flex-col items-center justify-center text-center">
            <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground">Production Analytics</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Detailed performance metrics are currently compiling. Check back after the next synchronization cycle.
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-medium text-foreground mb-6">Recent Activity</h3>
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4 relative">
                  {i !== 4 && <div className="absolute left-[11px] top-6 bottom-[-24px] w-px bg-border" />}
                  <div className="h-6 w-6 rounded-full bg-sidebar border border-border flex items-center justify-center shrink-0 z-10">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">Shipment <span className="font-medium text-primary">#Z-{9000 + i}</span> processed</p>
                    <p className="text-xs text-muted-foreground mt-1">{i * 2} hours ago</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
