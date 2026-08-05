import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { NavigationGuardProvider } from "@/contexts/NavigationGuardContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import ItemMaster from "@/pages/ItemMaster";
import SwatchCategoryMaster from "@/pages/SwatchCategoryMaster";
import DepartmentMaster from "@/pages/DepartmentMaster";
import UnitTypeMaster from "@/pages/UnitTypeMaster";
import SwatchMaster from "@/pages/SwatchMaster";
import SwatchForm from "@/pages/SwatchForm";
import StyleMaster from "@/pages/StyleMaster";
import StyleForm from "@/pages/StyleForm";
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
import PackingListForm from "@/pages/PackingListForm";
import PackingListDetail from "@/pages/PackingListDetail";
import Settings from "@/pages/Settings";
import UserManual from "@/pages/UserManual";
import InvoiceList from "@/pages/InvoiceList";
import InvoiceForm from "@/pages/InvoiceForm";
import Accounts from "@/pages/Accounts";
import CreditDebitNotes from "@/pages/CreditDebitNotes";
import AccountPurchases from "@/pages/AccountPurchases";
import AccountSales from "@/pages/AccountSales";
import OtherExpenses from "@/pages/OtherExpenses";
import AccountsDashboard from "@/pages/AccountsDashboard";
import VendorChallans from "@/pages/VendorChallans";
import VendorChallanDetail from "@/pages/VendorChallanDetail";

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
      <ProtectedRoute path="/dashboard" component={Dashboard} permission="dashboard" />
      <ProtectedRoute path="/masters" component={MastersRedirect} permission="masters:hsn" />
      <ProtectedRoute path="/masters/hsn" component={HSNMaster} permission="masters:hsn" />
      <ProtectedRoute path="/masters/materials" component={MaterialsMaster} permission="masters:materials" />
      <ProtectedRoute path="/masters/fabric" component={FabricMaster} permission="masters:fabric" />
      <ProtectedRoute path="/masters/clients/:id" component={ClientForm} permission="masters:clients" />
      <ProtectedRoute path="/masters/clients" component={ClientMaster} permission="masters:clients" />
      <ProtectedRoute path="/masters/vendors/:id" component={VendorForm} permission="masters:vendors" />
      <ProtectedRoute path="/masters/vendors" component={VendorMaster} permission="masters:vendors" />
      <ProtectedRoute path="/masters/style-categories" component={StyleCategoryMaster} permission="masters:style_categories" />
      <ProtectedRoute path="/masters/item-types" component={ItemTypeMaster} permission="masters:item_types" />
      <ProtectedRoute path="/masters/items" component={ItemMaster} permission="masters:items" />
      <ProtectedRoute path="/masters/swatch-categories" component={SwatchCategoryMaster} permission="masters:swatch_categories" />
      <ProtectedRoute path="/masters/departments" component={DepartmentMaster} permission="masters:departments" />
      <ProtectedRoute path="/masters/unit-types" component={UnitTypeMaster} permission="masters:unit_types" />
      <ProtectedRoute path="/masters/swatches/new" component={SwatchForm} permission="masters:swatches" />
      <ProtectedRoute path="/masters/swatches/:id/edit" component={SwatchForm} permission="masters:swatches" />
      <ProtectedRoute path="/masters/swatches" component={SwatchMaster} permission="masters:swatches" />
      <ProtectedRoute path="/masters/styles/new" component={StyleForm} permission="masters:styles" />
      <ProtectedRoute path="/masters/styles/:id/edit" component={StyleForm} permission="masters:styles" />
      <ProtectedRoute path="/masters/styles" component={StyleMaster} permission="masters:styles" />
      <ProtectedRoute path="/masters/packaging-materials" component={PackagingMaterialsMaster} permission="masters:packaging_materials" />
      <ProtectedRoute path="/orders" component={Orders} permission="orders" />
      <ProtectedRoute path="/orders/:id" component={OrderDetails} permission="orders" />
      <ProtectedRoute path="/swatch-orders" component={SwatchOrders} permission="swatch_orders" />
      <ProtectedRoute path="/swatch-orders/:swatchOrderId/artworks/:id" component={ArtworkDetail} permission="swatch_orders" />
      <ProtectedRoute path="/swatch-orders/:id" component={SwatchOrderDetail} permission="swatch_orders" />
      <ProtectedRoute path="/style-orders" component={StyleOrders} permission="style_orders" />
      <ProtectedRoute path="/style-orders/:styleOrderId/artworks/:id" component={StyleOrderArtworkDetail} permission="style_orders" />
      <ProtectedRoute path="/style-orders/:id" component={StyleOrderDetail} permission="style_orders" />
      <ProtectedRoute path="/user-management" component={UserManagement} permission="user_management" />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/client/:token" component={ClientPortal} />
      <ProtectedRoute path="/accounts/dashboard" component={AccountsDashboard} permission="accounts:dashboard" />
      <ProtectedRoute path="/accounts" component={AccountsDashboard} permission="accounts:dashboard" />
      <ProtectedRoute path="/accounts/ledgers" component={VendorLedgers} permission="accounts:vendor_ledgers" />
      <ProtectedRoute path="/accounts/ledgers/:vendorId" component={VendorLedgerDetail} permission="accounts:vendor_ledgers" />
      <ProtectedRoute path="/accounts/invoices/new" component={InvoiceForm} permission="accounts:invoices" />
      <ProtectedRoute path="/accounts/invoices/:id/edit" component={InvoiceForm} permission="accounts:invoices" />
      <ProtectedRoute path="/accounts/invoices/:id" component={InvoiceForm} permission="accounts:invoices" />
      <ProtectedRoute path="/accounts/invoices" component={InvoiceList} permission="accounts:invoices" />
      <ProtectedRoute path="/accounts/payments" component={Accounts} permission="accounts:payments" />
      <ProtectedRoute path="/accounts/credit-debit-notes" component={CreditDebitNotes} permission="accounts:credit_debit_notes" />
      <ProtectedRoute path="/accounts/purchases" component={AccountPurchases} permission="accounts:purchases" />
      <ProtectedRoute path="/accounts/sales" component={AccountSales} permission="accounts:sales" />
      <ProtectedRoute path="/accounts/other-expenses" component={OtherExpenses} permission="accounts:other_expenses" />
      <ProtectedRoute path="/inventory/dashboard" component={InventoryDashboard} permission="stock:items" />
      <ProtectedRoute path="/inventory/items" component={InventoryStockList} permission="stock:items" />
      <ProtectedRoute path="/inventory/low-stock-alerts" component={LowStockAlerts} permission="stock:low_stock" />
      <ProtectedRoute path="/inventory/ledger" component={InventoryLedger} permission="stock:ledger" />
      <ProtectedRoute path="/inventory/reservations" component={Reservations} permission="stock:reservations" />
      <ProtectedRoute path="/inventory/adjustments" component={StockAdjustments} permission="stock:adjustments" />
      <ProtectedRoute path="/quotation/new" component={QuotationForm} permission="quotation" />
      <ProtectedRoute path="/quotation/:id/edit" component={QuotationForm} permission="quotation" />
      <ProtectedRoute path="/quotation/:id" component={QuotationDetail} permission="quotation" />
      <ProtectedRoute path="/quotation" component={QuotationList} permission="quotation" />
      <ProtectedRoute path="/inventory/purchase-receipts/:id" component={PurchaseReceiptForm} permission="stock:purchase_receipts" />
      <ProtectedRoute path="/inventory/purchase-receipts" component={PurchaseReceipts} permission="stock:purchase_receipts" />
      <ProtectedRoute path="/procurement/vendor-challans/new" component={VendorChallanDetail} permission="procurement:vendor_challans" />
      <ProtectedRoute path="/procurement/vendor-challans/:id" component={VendorChallanDetail} permission="procurement:vendor_challans" />
      <ProtectedRoute path="/procurement/vendor-challans" component={VendorChallans} permission="procurement:vendor_challans" />
      <ProtectedRoute path="/procurement/purchase-orders/:id" component={PurchaseOrderForm} permission="stock:purchase_orders" />
      <ProtectedRoute path="/procurement/purchase-orders" component={PurchaseOrderList} permission="stock:purchase_orders" />
      <ProtectedRoute path="/procurement/purchase-receipts/:id" component={PurchaseReceiptForm} permission="stock:purchase_receipts" />
      <ProtectedRoute path="/procurement/purchase-receipts" component={PurchaseReceipts} permission="stock:purchase_receipts" />
      <ProtectedRoute path="/shipping" component={ShippingList} permission="shipping" />
      <ProtectedRoute path="/logistics/packing-lists" component={PackingLists} permission="logistics:packing_lists" />
      <ProtectedRoute path="/logistics/packing-lists/new" component={PackingListForm} permission="logistics:packing_lists" />
      <ProtectedRoute path="/logistics/packing-lists/:id/edit" component={PackingListForm} permission="logistics:packing_lists" />
      <ProtectedRoute path="/logistics/packing-lists/:id" component={PackingListDetail} permission="logistics:packing_lists" />
      <ProtectedRoute path="/masters/shipping-vendors" component={ShippingVendors} permission="masters:shipping_vendors" />
      <ProtectedRoute path="/settings/reports" component={Reports} permission="settings" />
      <ProtectedRoute path="/settings" component={Settings} permission="settings" />
      <Route path="/help" component={UserManual} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CurrencyProvider>
          <NavigationGuardProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </NavigationGuardProvider>
        </CurrencyProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
