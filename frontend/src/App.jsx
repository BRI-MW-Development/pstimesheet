import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './context/ToastContext';
import { useAuthStore } from './store/authStore';
import AppShell from './components/layout/AppShell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 2 * 60 * 1000, retry: 1 },
  },
});

// Pages — lazy-loaded per route
const LoginPage              = lazy(() => import('./pages/LoginPage'));
const DashboardPage          = lazy(() => import('./pages/DashboardPage'));

// Masters
const EmployeesPage          = lazy(() => import('./pages/masters/EmployeesPage'));
const DepartmentsPage        = lazy(() => import('./pages/masters/DepartmentsPage'));
const ItemsPage              = lazy(() => import('./pages/masters/ItemsPage'));
const MachineryPage          = lazy(() => import('./pages/masters/MachineryPage'));
const VehiclesPage           = lazy(() => import('./pages/masters/VehiclesPage'));
const AccessEquipmentPage    = lazy(() => import('./pages/masters/AccessEquipmentPage'));
const ProjectsPage           = lazy(() => import('./pages/masters/ProjectsPage'));
const WorkOrdersPage         = lazy(() => import('./pages/masters/WorkOrdersPage'));
const TaskTypesPage          = lazy(() => import('./pages/masters/TaskTypesPage'));

// Timesheets
const ProdTimesheetListPage  = lazy(() => import('./pages/timesheets/ProdTimesheetListPage'));
const ProdTimesheetFormPage  = lazy(() => import('./pages/timesheets/ProdTimesheetFormPage'));
const InstTimesheetListPage  = lazy(() => import('./pages/timesheets/InstTimesheetListPage'));
const InstTimesheetFormPage  = lazy(() => import('./pages/timesheets/InstTimesheetFormPage'));
const ProjTimesheetPage      = lazy(() => import('./pages/timesheets/ProjTimesheetPage'));
const PendingApprovalsPage   = lazy(() => import('./pages/timesheets/PendingApprovalsPage'));
const TimelinePage           = lazy(() => import('./pages/timesheets/TimelinePage'));

// QC
const QCListPage             = lazy(() => import('./pages/qc/QCListPage'));
const QCFormPage             = lazy(() => import('./pages/qc/QCFormPage'));
const QCPrintPage            = lazy(() => import('./pages/qc/QCPrintPage'));

// WOC + Reports
const WocPage                = lazy(() => import('./pages/woc/WocPage'));
const ReportsPage            = lazy(() => import('./pages/reports/ReportsPage'));
const DataEntryReportPage    = lazy(() => import('./pages/reports/DataEntryReportPage'));
const AuditPage              = lazy(() => import('./pages/reports/AuditPage'));
const AnalyticsPage          = lazy(() => import('./pages/reports/AnalyticsPage'));

// Admin / System Settings
const UsersPage              = lazy(() => import('./pages/admin/UsersPage'));
const HodTeamsPage           = lazy(() => import('./pages/admin/HodTeamsPage'));
const RolesPage              = lazy(() => import('./pages/admin/RolesPage'));
const ShiftsPage             = lazy(() => import('./pages/admin/ShiftsPage'));
const DocNumberingPage       = lazy(() => import('./pages/admin/DocNumberingPage'));
const LoginHistoryPage       = lazy(() => import('./pages/admin/LoginHistoryPage'));
const UserManualPage         = lazy(() => import('./pages/admin/UserManualPage'));
const ApprovalSettingsPage        = lazy(() => import('./pages/settings/ApprovalSettingsPage'));
const EmailSettingsPage           = lazy(() => import('./pages/settings/EmailSettingsPage'));
const ChangePasswordPage          = lazy(() => import('./pages/settings/ChangePasswordPage'));
const NotificationSettingsPage    = lazy(() => import('./pages/settings/NotificationSettingsPage'));
const ProfilePage            = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage      = lazy(() => import('./pages/NotificationsPage'));
const NotFoundPage           = lazy(() => import('./pages/NotFoundPage'));

function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Public page — claims an impersonation handoff stored in localStorage by an admin.
// Opens in a new tab; uses sessionStorage so it never clobbers the admin's localStorage session.
function ImpersonatePage() {
  const setAuth        = useAuthStore((s) => s.setAuth);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const navigate       = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem('ps_impersonate');
    localStorage.removeItem('ps_impersonate');
    try {
      const data = raw ? JSON.parse(raw) : null;
      if (!data || data.expiresAt < Date.now()) {
        navigate('/login', { replace: true });
        return;
      }
      // Mark this tab as impersonation BEFORE setAuth so the custom storage
      // writes only to sessionStorage, not localStorage.
      sessionStorage.setItem('ps_impersonation_tab', '1');
      setAuth(data.token, data.user);
      setPermissions(data.permissions ?? [], data.dataScope ?? 'All');
      navigate('/dashboard', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
      <div className="spinner" />
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>Opening impersonation session…</div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/impersonate" element={<ImpersonatePage />} />

              <Route element={<RequireAuth />}>
                {/* Print pages — no AppShell chrome */}
                <Route path="qc/:id/print" element={<QCPrintPage />} />

                <Route element={<AppShell />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />

                  {/* Masters */}
                  <Route path="masters/employees"       element={<EmployeesPage />} />
                  <Route path="masters/departments"     element={<DepartmentsPage />} />
                  <Route path="masters/items"           element={<ItemsPage />} />
                  <Route path="masters/machinery"       element={<MachineryPage />} />
                  <Route path="masters/vehicles"        element={<VehiclesPage />} />
                  <Route path="masters/access-equipment" element={<AccessEquipmentPage />} />
                  <Route path="masters/projects"        element={<ProjectsPage />} />
                  <Route path="masters/workorders"      element={<WorkOrdersPage />} />
                  <Route path="masters/tasktypes"       element={<TaskTypesPage />} />

                  {/* Timesheets */}
                  <Route path="timesheets/prod"                 element={<ProdTimesheetListPage />} />
                  <Route path="timesheets/prod/new"             element={<ProdTimesheetFormPage />} />
                  <Route path="timesheets/prod/:id/edit"        element={<ProdTimesheetFormPage />} />
                  <Route path="timesheets/prod/:id/view"        element={<ProdTimesheetFormPage />} />
                  <Route path="timesheets/inst"                 element={<InstTimesheetListPage />} />
                  <Route path="timesheets/inst/new"             element={<InstTimesheetFormPage />} />
                  <Route path="timesheets/inst/:id/edit"        element={<InstTimesheetFormPage />} />
                  <Route path="timesheets/inst/:id/view"        element={<InstTimesheetFormPage />} />
                  <Route path="timesheets/project"              element={<ProjTimesheetPage />} />
                  <Route path="timesheets/pending-approvals"    element={<PendingApprovalsPage />} />
                  <Route path="timesheets/timeline"            element={<TimelinePage />} />

                  {/* QC */}
                  <Route path="qc"             element={<QCListPage />} />
                  <Route path="qc/new"         element={<QCFormPage />} />
                  <Route path="qc/:id/edit"    element={<QCFormPage />} />
                  <Route path="qc/:id/view"    element={<QCFormPage />} />
                  <Route path="woc"            element={<WocPage />} />
                  <Route path="reports"                element={<ReportsPage />} />
                  <Route path="reports/audit"         element={<AuditPage />} />
                  <Route path="reports/data-entry"    element={<DataEntryReportPage />} />
                  <Route path="analytics"         element={<AnalyticsPage />} />
                  <Route path="analytics/:type"   element={<AnalyticsPage />} />
                  <Route path="reports/analytics" element={<AnalyticsPage />} />

                  {/* Admin / System Settings */}
                  <Route path="admin/users"              element={<UsersPage />} />
                  <Route path="admin/hod-teams"          element={<HodTeamsPage />} />
                  <Route path="admin/roles"              element={<RolesPage />} />
                  <Route path="admin/shifts"             element={<ShiftsPage />} />
                  <Route path="admin/doc-numbering"      element={<DocNumberingPage />} />
                  <Route path="admin/login-history"      element={<LoginHistoryPage />} />
                  <Route path="settings/approvals"       element={<ApprovalSettingsPage />} />
                  <Route path="settings/email"           element={<EmailSettingsPage />} />
                  <Route path="settings/change-password" element={<ChangePasswordPage />} />
                  <Route path="settings/sessions"        element={<LoginHistoryPage />} />
                  <Route path="settings/notifications"   element={<NotificationSettingsPage />} />
                  <Route path="admin/user-manual"        element={<UserManualPage />} />

                  {/* Profile + Notifications */}
                  <Route path="profile"       element={<ProfilePage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
