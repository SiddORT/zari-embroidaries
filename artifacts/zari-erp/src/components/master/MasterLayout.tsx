import type { ReactNode } from "react";
import AppLayout from "@/components/layout/AppLayout";

interface MasterLayoutProps {
  username: string;
  role: string;
  onLogout: () => void;
  isLoggingOut: boolean;
  children: ReactNode;
}

export default function MasterLayout({ children, ...layoutProps }: MasterLayoutProps) {
  return (
    <AppLayout {...layoutProps}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        {children}
      </div>
    </AppLayout>
  );
}
