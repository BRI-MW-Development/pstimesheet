import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
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

// QC
const QCListPage             = lazy(() => import('./pages/qc/QCListPage'));
const QCFormPage             = lazy(() => import('./pages/qc/QCFormPage'));

// WOC + Reports
const WocPage                = lazy(() => import('./pages/woc/WocPage'));
const ReportsPage            = lazy(() => import('./pages/reports/ReportsPage'));
const AuditPage              = lazy(() => import('./pages/reports/AuditPage'));

// Admin / System Settings
const UsersPage              = lazy(() => import('./pages/admin/UsersPage'));
const RolesPage              = lazy(() => import('./pages/admin/RolesPage'));
const ShiftsPage             = lazy(() => import('./pages/admin/ShiftsPage'));
const DocNumberingPage       = lazy(() => import('./pages/admin/DocNumberingPage'));
const LoginHistoryPage       = lazy(() => import('./pages/admin/LoginHistoryPage'));
const ApprovalSettingsPage   = lazy(() => import('./pages/settings/ApprovalSettingsPage'));
const EmailSettingsPage      = lazy(() => import('./pages/settings/EmailSettingsPage'));
const ChangePasswordPage     = lazy(() => import('./pages/settings/ChangePasswordPage'));
const ProfilePage            = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage      = lazy(() => import('./pages/NotificationsPage'));
const NotFoundPage           = lazy(() => import('./pages/NotFoundPage'));

function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
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

              <Route element={<RequireAuth />}>
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

                  {/* WOC + Reports */}
                  <Route path="qc"             element={<QCListPage />} />
                  <Route path="qc/new"         element={<QCFormPage />} />
                  <Route path="qc/:id/edit"    element={<QCFormPage />} />
                  <Route path="qc/:id/view"    element={<QCFormPage />} />

                  <Route path="woc"            element={<WocPage />} />
                  <Route path="reports"        element={<ReportsPage />} />
                  <Route path="reports/audit"  element={<AuditPage />} />

                  {/* Admin / System Settings */}
                  <Route path="admin/users"              element={<UsersPage />} />
                  <Route path="admin/roles"              element={<RolesPage />} />
                  <Route path="admin/shifts"             element={<ShiftsPage />} />
                  <Route path="admin/doc-numbering"      element={<DocNumberingPage />} />
                  <Route path="admin/login-history"      element={<LoginHistoryPage />} />
                  <Route path="settings/approvals"       element={<ApprovalSettingsPage />} />
                  <Route path="settings/email"           element={<EmailSettingsPage />} />
                  <Route path="settings/change-password" element={<ChangePasswordPage />} />

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
