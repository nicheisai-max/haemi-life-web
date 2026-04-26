import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Providers
import { AuthProvider } from './context/auth-context';
import { ThemeProvider } from './context/theme-context';
import { ToastProvider } from './context/toast-context';
import { AlertDialogProvider } from './context/alert-dialog-context';
import { NetworkStatusProvider } from './context/network-status';
import { SessionManagerProvider } from './context/session-manager';
import { LanguageProvider } from './context/language-context';
import { NotificationProvider } from './context/notification-provider';
import { ChatProvider } from './context/chat-provider';
import { PresenceProvider } from './context/presence-context';

// Components & Utils
import { ErrorBoundary } from './components/ui/error-boundary';
import { MedicalLoader } from './components/ui/medical-loader';
import { PageTransition } from './components/layout/page-transition';
import { PATHS } from './routes/paths';
import { useAuth } from './hooks/use-auth';
import { logger, auditLogger } from './utils/logger';

// Layouts & Guards
import { TelemedicineGuard } from './components/guards/telemedicine-guard';
import { RoleRoute } from './components/auth/role-route';
import { ScrollToTop } from './components/utils/scroll-to-top';

// Pages (Eagerly Loaded for UX)
import { Login } from './pages/public/login';
import { Signup } from './pages/public/signup';
import { ForgotPassword } from './pages/auth/forgot-password';
import { StyleGuide } from './pages/public/style-guide';

// ─── LAZY LOAD MODULES ──────────────────────────────────────────────────────
const LazyDashboardLayout = lazy(() => import('./components/layout/dashboard-layout').then(m => ({ default: m.DashboardLayout })));
const RoleRouter = lazy(() => import('./components/layout/role-router').then(m => ({ default: m.RoleRouter })));
const AdminDashboard = lazy(() => import('./pages/admin/admin-dashboard').then(m => ({ default: m.AdminDashboard })));
const Profile = lazy(() => import('./pages/profile/profile').then(m => ({ default: m.Profile })));
const Settings = lazy(() => import('./pages/settings/settings').then(m => ({ default: m.Settings })));
const FindDoctors = lazy(() => import('./pages/doctors/find-doctors').then(m => ({ default: m.FindDoctors })));
const BookAppointment = lazy(() => import('./pages/appointments/book-appointment').then(m => ({ default: m.BookAppointment })));
const Appointments = lazy(() => import('./pages/appointments/appointments').then(m => ({ default: m.Appointments })));
const Prescriptions = lazy(() => import('./pages/prescriptions/prescriptions').then(m => ({ default: m.Prescriptions })));
const MedicalRecords = lazy(() => import('./pages/patient/medical-records').then(m => ({ default: m.MedicalRecords })));
const DoctorScheduleManagement = lazy(() => import('./pages/doctor/doctor-schedule-management').then(m => ({ default: m.DoctorScheduleManagement })));
const PrescriptionQueue = lazy(() => import('./pages/pharmacist/prescription-queue').then(m => ({ default: m.PrescriptionQueue })));
const VerifyDoctors = lazy(() => import('./pages/admin/verify-doctors').then(m => ({ default: m.VerifyDoctors })));
const UserManagement = lazy(() => import('./pages/admin/user-management').then(m => ({ default: m.UserManagement })));
const SystemLogs = lazy(() => import('./pages/admin/system-logs').then(m => ({ default: m.SystemLogs })));
const SecurityMonitoring = lazy(() => import('./pages/admin/security-monitoring').then(m => ({ default: m.SecurityMonitoring })));
const SessionManagement = lazy(() => import('./pages/admin/session-management').then(m => ({ default: m.SessionManagement })));
const Inventory = lazy(() => import('./pages/pharmacist/inventory').then(m => ({ default: m.Inventory })));
const PrivacyPolicy = lazy(() => import('./pages/legal/privacy-policy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/legal/terms-of-service').then(m => ({ default: m.TermsOfService })));
const Help = lazy(() => import('./pages/support/help').then(m => ({ default: m.Help })));
const TelemedicineConsent = lazy(() => import('./pages/legal/telemedicine-consent').then(m => ({ default: m.TelemedicineConsent })));
const TelemedicineDashboard = lazy(() => import('./pages/telemedicine/telemedicine-dashboard').then(m => ({ default: m.TelemedicineDashboard })));
const VideoConsultation = lazy(() => import('./components/telemedicine/video-consultation').then(m => ({ default: m.VideoConsultation })));
const NotFound = lazy(() => import('./pages/public/not-found').then(m => ({ default: m.NotFound })));
const DoctorReports = lazy(() => import('./pages/doctor/reports').then(m => ({ default: m.DoctorReports })));
const DispensePrescription = lazy(() => import('./pages/pharmacist/dispense-prescription').then(m => ({ default: m.DispensePrescription })));
const DoctorPatientList = lazy(() => import('./pages/doctor/doctor-patient-list').then(m => ({ default: m.DoctorPatientList })));

const LoadingFallback = () => <MedicalLoader variant="global" message="Securing clinical session..." />;
const DelayedFallback = () => <MedicalLoader variant="global" message="Restoring clinical records..." />;


// ─── INSTITUTIONAL WRAPPERS (STABILIZED REFS) ────────────────────────────────

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingFallback />;

  if (!isAuthenticated) {
    logger.warn('[App] Session invalid or expired', { path: location.pathname });
    return <Navigate to={PATHS.LOGIN} state={{ from: location.pathname }} replace />;
  }

  return children;
};

const MainClinicalLayout = React.memo(() => (
  <ProtectedRoute>
    <Suspense fallback={<DelayedFallback />}>
      <LazyDashboardLayout>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </LazyDashboardLayout>
    </Suspense>
  </ProtectedRoute>
));

MainClinicalLayout.displayName = 'MainClinicalLayout';

const AuthGatedNotifications: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <PresenceProvider>
      <ChatProvider>
        {children}
      </ChatProvider>
    </PresenceProvider>
  </NotificationProvider>
);

const IdentityGate = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return <LoadingFallback />;
  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'admin' ? PATHS.ADMIN.DASHBOARD : PATHS.DASHBOARD} replace />;
  }
  return <Navigate to={PATHS.LOGIN} replace />;
};

// ─── MAIN APP COMPONENT ──────────────────────────────────────────────────────

const AppRoutes = React.memo(() => {
  const location = useLocation();
  const { isLoading } = useAuth();

  if (isLoading) return <LoadingFallback />;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location}>
          {/* Public Routes */}
          <Route path={PATHS.LOGIN} element={<Login />} />
          <Route path={PATHS.SIGNUP} element={<Signup />} />
          <Route path={PATHS.FORGOT_PASSWORD} element={<ForgotPassword />} />
          <Route path={PATHS.STYLE_GUIDE} element={<StyleGuide />} />
          <Route path={PATHS.PRIVACY} element={<PrivacyPolicy />} />
          <Route path={PATHS.TERMS} element={<TermsOfService />} />
          <Route path={PATHS.HELP} element={<Help />} />

          {/* Protected Clinical Cluster */}
          <Route element={<AuthGatedNotifications><MainClinicalLayout /></AuthGatedNotifications>}>
            <Route path={PATHS.DASHBOARD} element={<RoleRouter />} />
            <Route path={PATHS.PROFILE} element={<Profile />} />
            <Route path={PATHS.SETTINGS} element={<Settings />} />
            <Route path={PATHS.PATIENT.FIND_DOCTORS} element={<FindDoctors />} />
            <Route path={PATHS.PATIENT.BOOK_APPOINTMENT} element={<BookAppointment />} />
            <Route path={PATHS.PATIENT.APPOINTMENTS} element={<Appointments />} />
            <Route path={PATHS.PATIENT.PRESCRIPTIONS} element={<RoleRoute allowedRoles={['patient', 'doctor', 'pharmacist']}><Prescriptions /></RoleRoute>} />
            <Route path={PATHS.PATIENT.MEDICAL_RECORDS} element={<RoleRoute allowedRoles={['patient']}><MedicalRecords /></RoleRoute>} />

            <Route path={PATHS.DOCTOR.SCHEDULE} element={<RoleRoute allowedRoles={['doctor']}><DoctorScheduleManagement /></RoleRoute>} />
            <Route path={PATHS.DOCTOR.PATIENTS} element={<RoleRoute allowedRoles={['doctor']}><DoctorPatientList /></RoleRoute>} />
            <Route path={PATHS.DOCTOR.REPORTS} element={<RoleRoute allowedRoles={['doctor']}><DoctorReports /></RoleRoute>} />

            <Route path={PATHS.PHARMACIST.QUEUE} element={<RoleRoute allowedRoles={['pharmacist']}><PrescriptionQueue /></RoleRoute>} />
            <Route path={PATHS.PHARMACIST.DISPENSE} element={<RoleRoute allowedRoles={['pharmacist']}><DispensePrescription /></RoleRoute>} />
            <Route path={PATHS.PHARMACIST.INVENTORY} element={<RoleRoute allowedRoles={['pharmacist']}><Inventory /></RoleRoute>} />

            <Route path={PATHS.ADMIN.DASHBOARD} element={<RoleRoute allowedRoles={['admin']}><AdminDashboard /></RoleRoute>} />
            <Route path={PATHS.ADMIN.VERIFY_DOCTORS} element={<RoleRoute allowedRoles={['admin']}><VerifyDoctors /></RoleRoute>} />
            <Route path={PATHS.ADMIN.USERS} element={<RoleRoute allowedRoles={['admin']}><UserManagement /></RoleRoute>} />
            <Route path={PATHS.ADMIN.SYSTEM_LOGS} element={<RoleRoute allowedRoles={['admin']}><SystemLogs /></RoleRoute>} />
            <Route path={PATHS.ADMIN.SECURITY} element={<RoleRoute allowedRoles={['admin']}><SecurityMonitoring /></RoleRoute>} />
            <Route path={PATHS.ADMIN.SESSIONS} element={<RoleRoute allowedRoles={['admin']}><SessionManagement /></RoleRoute>} />

            <Route path={PATHS.CONSENT} element={<TelemedicineGuard><TelemedicineConsent /></TelemedicineGuard>} />
            <Route path={PATHS.TELEMEDICINE} element={<TelemedicineGuard><TelemedicineDashboard /></TelemedicineGuard>} />

            {/* Fallback Dashboard Home */}
            <Route path="/dashboard/*" element={<RoleRouter />} />
          </Route>

          <Route path="/consultation/:id" element={<ProtectedRoute><VideoConsultation /></ProtectedRoute>} />
          <Route path={PATHS.ROOT} element={<IdentityGate />} />
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
});

AppRoutes.displayName = 'AppRoutes';

const App: React.FC = () => {
  const handleGlobalError = (error: Error, info: React.ErrorInfo) => {
    logger.error('[App] Boundary Error:', { message: error.message, stack: info.componentStack });
    auditLogger.log('UNHANDLED_ERROR', { message: error.message, stack: info.componentStack ?? undefined });
  };

  const handleGlobalReset = () => {
    logger.info('[App] Protocol reset triggered. Clearing temporary states.');
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  return (
    <ErrorBoundary onReset={handleGlobalReset} onError={handleGlobalError}>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <AlertDialogProvider>
              <NetworkStatusProvider>
                <SessionManagerProvider>
                  <LanguageProvider>
                    <AuthGatedNotifications>
                      <ScrollToTop />
                      <AppRoutes />
                    </AuthGatedNotifications>
                  </LanguageProvider>
                </SessionManagerProvider>
              </NetworkStatusProvider>
            </AlertDialogProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
