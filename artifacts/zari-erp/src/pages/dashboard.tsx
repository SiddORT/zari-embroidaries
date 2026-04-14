import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import ZariButton from "@/components/ui/ZariButton";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("zarierp_token");

  const { data: user, isLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  const logoutMutation = useLogout();

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
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        localStorage.removeItem("zarierp_token");
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Total Users",
      value: "89",
      change: "+3 this month",
      positive: true,
      icon: Users,
      bg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Total Products",
      value: "12,450",
      change: "+2.4% vs last month",
      positive: true,
      icon: Package,
      bg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      label: "Total Orders",
      value: "342",
      change: "+12.1% vs last month",
      positive: true,
      icon: ShoppingCart,
      bg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
  ];

  const recentActivity = [
    { id: "Z-9004", label: "Shipment dispatched", time: "2 hours ago", status: "success", icon: Truck },
    { id: "Z-9003", label: "Order confirmed", time: "4 hours ago", status: "success", icon: CheckCircle2 },
    { id: "Z-9002", label: "Inventory updated", time: "6 hours ago", status: "info", icon: Package },
    { id: "Z-9001", label: "Low stock alert", time: "8 hours ago", status: "warning", icon: AlertCircle },
    { id: "Z-9000", label: "Shipment received", time: "12 hours ago", status: "success", icon: Truck },
  ];

  const statusColors: Record<string, string> = {
    success: "text-emerald-500",
    info: "text-blue-500",
    warning: "text-amber-500",
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <AppLayout
      username={user.username}
      role={user.role}
      onLogout={handleLogout}
      isLoggingOut={logoutMutation.isPending}
    >
      {/* Welcome banner */}
      <div className="mb-7">
        <h2 className="text-xl font-semibold text-gray-900">
          Welcome back, {user.username}.
        </h2>
        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {today}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-7">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start justify-between"
          >
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {card.label}
              </p>
              <p className="text-3xl font-bold text-gray-900 tracking-tight">{card.value}</p>
              <p className={`text-xs mt-1.5 flex items-center gap-1 ${card.positive ? "text-emerald-600" : "text-red-500"}`}>
                {card.positive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {card.change}
              </p>
            </div>
            <div className={`${card.bg} p-3 rounded-lg`}>
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Lower grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Production analytics placeholder */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[320px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Production Analytics</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Coming soon</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-16 w-16 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Metrics compiling</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Detailed performance data will appear here after the next synchronization cycle.
              </p>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-5">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.map((item, i) => (
              <div key={item.id} className="flex items-start gap-3 relative">
                {i !== recentActivity.length - 1 && (
                  <div className="absolute left-[15px] top-7 bottom-[-16px] w-px bg-gray-100" />
                )}
                <div className={`mt-0.5 shrink-0 ${statusColors[item.status]}`}>
                  <item.icon className="h-[1.1rem] w-[1.1rem]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-700">
                    {item.label}{" "}
                    <span className="font-semibold text-gray-900">#{item.id}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
