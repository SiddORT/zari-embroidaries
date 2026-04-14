import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import Dashboard from "@/pages/dashboard";
import HSNMaster from "@/pages/HSNMaster";
import MaterialsMaster from "@/pages/MaterialsMaster";
import FabricMaster from "@/pages/FabricMaster";
import Orders from "@/pages/Orders";
import OrderDetails from "@/pages/OrderDetails";
import ClientMaster from "@/pages/ClientMaster";
import VendorMaster from "@/pages/VendorMaster";
import StyleCategoryMaster from "@/pages/StyleCategoryMaster";
import SwatchMaster from "@/pages/SwatchMaster";
import StyleMaster from "@/pages/StyleMaster";

const queryClient = new QueryClient();

setAuthTokenGetter(() => localStorage.getItem("zarierp_token"));

function RootRedirect() {
  const [, setLocation] = useLocation();
  const token = localStorage.getItem("zarierp_token");

  useEffect(() => {
    if (token) {
      setLocation("/dashboard");
    } else {
      setLocation("/login");
    }
  }, [token, setLocation]);

  return null;
}

function MastersRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/masters/hsn"); }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/masters" component={MastersRedirect} />
      <Route path="/masters/hsn" component={HSNMaster} />
      <Route path="/masters/materials" component={MaterialsMaster} />
      <Route path="/masters/fabric" component={FabricMaster} />
      <Route path="/masters/clients" component={ClientMaster} />
      <Route path="/masters/vendors" component={VendorMaster} />
      <Route path="/masters/style-categories" component={StyleCategoryMaster} />
      <Route path="/masters/swatches" component={SwatchMaster} />
      <Route path="/masters/styles" component={StyleMaster} />
      <Route path="/orders" component={Orders} />
      <Route path="/orders/:id" component={OrderDetails} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
