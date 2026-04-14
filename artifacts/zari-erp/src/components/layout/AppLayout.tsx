import TopNavbar from "./TopNavbar";

interface AppLayoutProps {
  username: string;
  role: string;
  onLogout: () => void;
  isLoggingOut: boolean;
  children: React.ReactNode;
}

export default function AppLayout({
  username,
  role,
  onLogout,
  isLoggingOut,
  children,
}: AppLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-[#f8f9fb] flex flex-col">
      <TopNavbar
        username={username}
        role={role}
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
      />
      <main className="flex-1 p-6 md:p-8 max-w-screen-2xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
