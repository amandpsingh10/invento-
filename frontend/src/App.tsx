import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useHardwareBackButton } from "@/lib/hardwareBack";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { CurrentStockPage } from "@/features/inventory/CurrentStockPage";
import { StockHistoryPage } from "@/features/inventory/StockHistoryPage";
import { UploadPurchasePage } from "@/features/purchases/UploadPurchasePage";
import { StockLedgerPage } from "@/features/ledger/StockLedgerPage";
import { StockAdjustmentPage } from "@/features/adjustments/StockAdjustmentPage";
import { IssuePartPage } from "@/features/issues/IssuePartPage";
import { IssuedPartsPage } from "@/features/issues/IssuedPartsPage";
import { IssueDetailPage } from "@/features/issues/IssueDetailPage";
import { ReturnPartPage } from "@/features/returns/ReturnPartPage";
import { ReturnHistoryPage } from "@/features/returns/ReturnHistoryPage";
import { LowStockPage } from "@/features/inventory/LowStockPage";
import { ManualEntryPage } from "@/features/inventory/ManualEntryPage";
import { AddInventoryPage } from "@/features/inventory/AddInventoryPage";
import { SellPartPage } from "@/features/sales/SellPartPage";
import { SalesHistoryPage } from "@/features/sales/SalesHistoryPage";
import { InvoiceDetailPage } from "@/features/sales/InvoiceDetailPage";
import { InvoicePrintPage } from "@/features/sales/InvoicePrintPage";
import { IssuePrintPage } from "@/features/issues/IssuePrintPage";
import { StockReportPage } from "@/features/reports/StockReportPage";
import { IssueReportPage } from "@/features/reports/IssueReportPage";
import { ReturnReportPage } from "@/features/reports/ReturnReportPage";
import { TransactionReportPage } from "@/features/reports/TransactionReportPage";
import { UsersPage } from "@/features/admin-tenant/UsersPage";
import { StoresPage } from "@/features/admin-tenant/StoresPage";
import { BinsPage } from "@/features/admin-tenant/BinsPage";
import { RacksPage } from "@/features/admin-tenant/RacksPage";
import { PartsPage } from "@/features/admin-tenant/PartsPage";
import { BulkUploadPartsPage } from "@/features/admin-tenant/BulkUploadPartsPage";
import { AuditLogPage } from "@/features/admin-tenant/AuditLogPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { SuperAdminDashboardPage } from "@/features/super-admin/SuperAdminDashboardPage";
import { DealersPage } from "@/features/super-admin/DealersPage";
import { DealerUsersPage } from "@/features/super-admin/DealerUsersPage";
import { PlansPage } from "@/features/super-admin/PlansPage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";
import { NoAccessPage } from "@/features/misc/NoAccessPage";

function RootRedirect() {
  const { hasRole, isAuthenticated, canAccessMenu } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (hasRole("SUPER_ADMIN")) return <Navigate to="/super-admin/dashboard" replace />;
  return <Navigate to={canAccessMenu("dashboard") ? "/dashboard" : "/no-access"} replace />;
}

export default function App() {
  useHardwareBackButton();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/no-access" element={<NoAccessPage />} />

      {/* Dealer app */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route element={<ProtectedRoute menuKey="dashboard" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute menuKey="stock" />}>
            <Route path="/inventory/current-stock" element={<CurrentStockPage />} />
          </Route>
          <Route path="/inventory/low-stock" element={<LowStockPage />} />
          <Route path="/inventory/:id/history" element={<StockHistoryPage />} />
          <Route element={<ProtectedRoute menuKey="stock-ledger" />}>
            <Route path="/inventory/stock-ledger" element={<StockLedgerPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["TENANT_ADMIN", "INVENTORY_MANAGER"]} />}>
            <Route path="/inventory/add" element={<AddInventoryPage />} />
            <Route path="/inventory/upload-purchase" element={<UploadPurchasePage />} />
            <Route path="/inventory/add-part" element={<ManualEntryPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["TENANT_ADMIN", "INVENTORY_MANAGER"]} menuKey="stock-adjustment" />}>
            <Route path="/inventory/adjustments" element={<StockAdjustmentPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["TENANT_ADMIN", "INVENTORY_MANAGER", "STORE_USER"]} />}>
            <Route path="/issues/new" element={<IssuePartPage />} />
            <Route path="/issues/:id" element={<IssueDetailPage />} />
            <Route path="/issues/:id/print" element={<IssuePrintPage />} />
            <Route path="/invoices" element={<SalesHistoryPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/invoices/:id/print" element={<InvoicePrintPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["TENANT_ADMIN", "INVENTORY_MANAGER", "STORE_USER"]} menuKey="issued-parts" />}>
            <Route path="/issues" element={<IssuedPartsPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["TENANT_ADMIN", "INVENTORY_MANAGER", "STORE_USER"]} menuKey="return" />}>
            <Route path="/returns/new" element={<ReturnPartPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["TENANT_ADMIN", "INVENTORY_MANAGER", "STORE_USER"]} menuKey="return-history" />}>
            <Route path="/returns" element={<ReturnHistoryPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["TENANT_ADMIN", "INVENTORY_MANAGER", "STORE_USER"]} menuKey="sell" />}>
            <Route path="/sell/new" element={<SellPartPage />} />
          </Route>

          <Route element={<ProtectedRoute menuKey="report-stock" />}>
            <Route path="/reports/stock" element={<StockReportPage />} />
          </Route>
          <Route element={<ProtectedRoute menuKey="report-issues" />}>
            <Route path="/reports/issues" element={<IssueReportPage />} />
          </Route>
          <Route element={<ProtectedRoute menuKey="report-returns" />}>
            <Route path="/reports/returns" element={<ReturnReportPage />} />
          </Route>
          <Route element={<ProtectedRoute menuKey="report-transactions" />}>
            <Route path="/reports/transactions" element={<TransactionReportPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["TENANT_ADMIN"]} menuKey="admin-users" />}>
            <Route path="/admin-tenant/users" element={<UsersPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["TENANT_ADMIN"]} menuKey="admin-stores" />}>
            <Route path="/admin-tenant/stores" element={<StoresPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["TENANT_ADMIN"]} menuKey="admin-bins" />}>
            <Route path="/admin-tenant/bins" element={<BinsPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["TENANT_ADMIN"]} menuKey="admin-racks" />}>
            <Route path="/admin-tenant/racks" element={<RacksPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["TENANT_ADMIN"]} menuKey="admin-parts" />}>
            <Route path="/admin-tenant/parts" element={<PartsPage />} />
            <Route path="/admin-tenant/parts/bulk-upload" element={<BulkUploadPartsPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["TENANT_ADMIN"]} menuKey="admin-audit-log" />}>
            <Route path="/admin-tenant/audit-log" element={<AuditLogPage />} />
          </Route>

          <Route element={<ProtectedRoute menuKey="settings" />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>

      {/* Platform super admin */}
      <Route element={<ProtectedRoute roles={["SUPER_ADMIN"]} />}>
        <Route element={<SuperAdminLayout />}>
          <Route path="/super-admin/dashboard" element={<SuperAdminDashboardPage />} />
          <Route path="/super-admin/dealers" element={<DealersPage />} />
          <Route path="/super-admin/dealers/:id/users" element={<DealerUsersPage />} />
          <Route path="/super-admin/plans" element={<PlansPage />} />
        </Route>
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
