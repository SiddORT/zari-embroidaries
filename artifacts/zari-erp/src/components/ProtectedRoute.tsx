import { ComponentType, useEffect } from "react";
import { Route, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { useToast } from "@/hooks/use-toast";

interface ProtectedRouteProps {
  path: string;
  component: ComponentType<any>;
  permission?: string;
}

export function ProtectedRoute({ path, component: Component, permission }: ProtectedRouteProps) {
  const { can, isAdmin, isLoading } = useMyPermissions();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const isAllowed = !permission || isAdmin || can(permission);

  useEffect(() => {
    if (!isLoading && !isAllowed) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to access this module.",
        variant: "destructive",
      });
      setLocation("/dashboard");
    }
  }, [isLoading, isAllowed, setLocation, toast]);

  return (
    <Route path={path}>
      {(params) => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          );
        }
        if (!isAllowed) {
          return null;
        }
        return <Component {...params} />;
      }}
    </Route>
  );
}

export default ProtectedRoute;
