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
import VendorForm from "@/pages/VendorForm";
import ClientForm from "@/pages/ClientForm";
import StyleCategoryMaster from "@/pages/StyleCategoryMaster";
import ItemTypeMaster from "@/pages/ItemTypeMaster";
import SwatchCategoryMaster from "@/pages/SwatchCategoryMaster";
import SwatchMaster from "@/pages/SwatchMaster";
import StyleMaster from "@/pages/StyleMaster";
import PackagingMaterialsMaster from "@/pages/PackagingMaterialsMaster";
import UserManagement from "@/pages/UserManagement";
import AcceptInvite from "@/pages/AcceptInvite";
import SwatchOrders from "@/pages/SwatchOrders";
import SwatchOrderDetail from "@/pages/SwatchOrderDetail";
import ArtworkDetail from "@/pages/ArtworkDetail";
import ClientPortal from "@/pages/ClientPortal";
import StyleOrders from "@/pages/StyleOrders";
import StyleOrderDetail from "@/pages/StyleOrderDetail";
import StyleOrderArtworkDetail from "@/pages/StyleOrderArtworkDetail";
import VendorLedgers from "@/pages/VendorLedgers";
import VendorLedgerDetail from "@/pages/VendorLedgerDetail";
import InventoryDashboard from "@/pages/InventoryDashboard";
import InventoryStockList from "@/pages/InventoryStockList";
import InventoryLedger from "@/pages/InventoryLedger";
import LowStockAlerts from "@/pages/LowStockAlerts";
import PurchaseReceipts from "@/pages/PurchaseReceipts";
import PurchaseReceiptForm from "@/pages/PurchaseReceiptForm";
import PurchaseOrderList from "@/pages/PurchaseOrderList";
import PurchaseOrderForm from "@/pages/PurchaseOrderForm";
import Reservations from "@/pages/Reservations";
import StockAdjustments from "@/pages/StockAdjustments";
import QuotationList from "@/pages/QuotationList";
import QuotationForm from "@/pages/QuotationForm";
import QuotationDetail from "@/pages/QuotationDetail";
import ShippingList from "@/pages/ShippingList";
import ShippingVendors from "@/pages/ShippingVendors";
import PackingLists from "@/pages/PackingLists";
import Settings from "@/pages/Settings";
import InvoiceList from "@/pages/InvoiceList";
import InvoiceForm from "@/pages/InvoiceForm";
import Accounts from "@/pages/Accounts";
import CreditDebitNotes from "@/pages/CreditDebitNotes";
import AccountPurchases from "@/pages/AccountPurchases";
import OtherExpenses from "@/pages/OtherExpenses";
import AccountsDashboard from "@/pages/AccountsDashboard";
import Reports from "@/pages/Reports";

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
      <Route path="/masters/clients/:id" component={ClientForm} />
      <Route path="/masters/clients" component={ClientMaster} />
      <Route path="/masters/vendors/:id" component={VendorForm} />
      <Route path="/masters/vendors" component={VendorMaster} />
      <Route path="/masters/style-categories" component={StyleCategoryMaster} />
      <Route path="/masters/item-types" component={ItemTypeMaster} />
      <Route path="/masters/swatch-categories" component={SwatchCategoryMaster} />
      <Route path="/masters/swatches" component={SwatchMaster} />
      <Route path="/masters/styles" component={StyleMaster} />
      <Route path="/masters/packaging-materials" component={PackagingMaterialsMaster} />
      <Route path="/orders" component={Orders} />
      <Route path="/orders/:id" component={OrderDetails} />
      <Route path="/swatch-orders" component={SwatchOrders} />
      <Route path="/swatch-orders/:swatchOrderId/artworks/:id" component={ArtworkDetail} />
      <Route path="/swatch-orders/:id" component={SwatchOrderDetail} />
      <Route path="/style-orders" component={StyleOrders} />
      <Route path="/style-orders/:styleOrderId/artworks/:id" component={StyleOrderArtworkDetail} />
      <Route path="/style-orders/:id" component={StyleOrderDetail} />
      <Route path="/user-management" component={UserManagement} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/client/:token" component={ClientPortal} />
      <Route path="/accounts/dashboard" component={AccountsDashboard} />
      <Route path="/accounts" component={AccountsDashboard} />
      <Route path="/accounts/ledgers" component={VendorLedgers} />
      <Route path="/accounts/ledgers/:vendorId" component={VendorLedgerDetail} />
      <Route path="/accounts/invoices/new" component={InvoiceForm} />
      <Route path="/accounts/invoices/:id/edit" component={InvoiceForm} />
      <Route path="/accounts/invoices/:id" component={InvoiceForm} />
      <Route path="/accounts/invoices" component={InvoiceList} />
      <Route path="/accounts/payments" component={Accounts} />
      <Route path="/accounts/credit-debit-notes" component={CreditDebitNotes} />
      <Route path="/accounts/purchases" component={AccountPurchases} />
      <Route path="/accounts/other-expenses" component={OtherExpenses} />
      <Route path="/inventory/dashboard" component={InventoryDashboard} />
      <Route path="/inventory/items" component={InventoryStockList} />
      <Route path="/inventory/low-stock-alerts" component={LowStockAlerts} />
      <Route path="/inventory/ledger" component={InventoryLedger} />
      <Route path="/inventory/reservations" component={Reservations} />
      <Route path="/inventory/adjustments" component={StockAdjustments} />
      <Route path="/quotation/new" component={QuotationForm} />
      <Route path="/quotation/:id/edit" component={QuotationForm} />
      <Route path="/quotation/:id" component={QuotationDetail} />
      <Route path="/quotation" component={QuotationList} />
      <Route path="/inventory/purchase-receipts/:id" component={PurchaseReceiptForm} />
      <Route path="/inventory/purchase-receipts" component={PurchaseReceipts} />
      <Route path="/procurement/purchase-orders/:id" component={PurchaseOrderForm} />
      <Route path="/procurement/purchase-orders" component={PurchaseOrderList} />
      <Route path="/procurement/purchase-receipts/:id" component={PurchaseReceiptForm} />
      <Route path="/procurement/purchase-receipts" component={PurchaseReceipts} />
      <Route path="/shipping" component={ShippingList} />
      <Route path="/logistics/packing-lists" component={PackingLists} />
      <Route path="/masters/shipping-vendors" component={ShippingVendors} />
      <Route path="/settings/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
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
