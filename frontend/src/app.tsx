import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/auth-context';
import { useAuth } from './hooks/use-auth';
import { ThemeProvider } from './context/theme-context';
import { ToastProvider } from './context/toast-context';
import { NetworkStatusProvider } from './context/network-status';
import { SessionManagerProvider } from './context/session-manager';
import { AlertDialogProvider } from './context/alert-dialog-context';
import { NotificationProvider } from './context/notification-provider';
import { ChatProvider } from './context/chat-provider';
import { ErrorBoundary } from './components/ui/error-boundary';
import { DelayedFallback } from './components/layout/delayed-fallback';
const LazyDashboardLayout = lazy(() => import('./components/layout/dashboard-layout').then(m => ({ default: m.DashboardLayout })));
const RoleRouter = lazy(() => import('./components/layout/role-router').then(m => ({ default: m.RoleRouter })));
import { ScrollToTop } from './components/utils/scroll-to-top';
import { PageTransition } from './components/layout/page-transition';
import { MedicalLoader } from './components/ui/medical-loader';
import { RoleRoute } from './components/auth/role-route';
import { FirstVisitGuard } from './components/guards/first-visit-guard';

// Lazy loaded pages
// Eagerly loaded Auth/Public pages for zero-jerks and instantaneous navigation
import { Login } from './pages/public/login';
import { Signup } from './pages/public/signup';
import { ForgotPassword } from './pages/auth/forgot-password';
import { StyleGuide } from './pages/public/style-guide';
import { PATHS } from './routes/paths';

// Lazy loaded dashboard pages
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
const DoctorReports = lazy(() => import('./pages/doctor/reports'));
const DispensePrescription = lazy(() => import('./pages/pharmacist/dispense-prescription'));
import { DoctorPatientList } from './pages/doctor/doctor-patient-list';

const LoadingFallback = () => <MedicalLoader fullPage message="Securing clinical data..." />;

/**
 * Renders NotificationProvider unconditionally to prevent React from unmounting
 * the entire AppRoutes subtree whenever authStatus toggles.
 * The NotificationProvider internally guards its socket connection via user?.id.
 */
const AuthGatedNotifications: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <NotificationProvider>
      <ChatProvider>
        {children}
      </ChatProvider>
    </NotificationProvider>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { authStatus } = useAuth();
  const location = useLocation();

  if (authStatus === 'initializing') {
    return <LoadingFallback />;
  }

  if (authStatus !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location?.pathname }} replace />;
  }

  return children;
};

const IdentityGate = () => {
  const { authStatus, user } = useAuth();

  if (authStatus === 'initializing') {
    return <LoadingFallback />;
  }

  if (authStatus === 'authenticated' && user) {
    // Redirect to the role-specific canonical dashboard URL.
    // This ensures the browser URL always reflects the correct path, enabling
    // sidebar NavLink active-state detection and proper deep linking.
    const dashboardPath = user.role === 'admin' ? PATHS.ADMIN.DASHBOARD : PATHS.DASHBOARD;
    return <Navigate to={dashboardPath} replace />;
  }

  // Unauthenticated: redirect to /login — FirstVisitGuard handles onboarding interception.
  return <Navigate to={PATHS.LOGIN} replace />;
};

const AppRoutes = () => {
  const location = useLocation();
  const { authStatus } = useAuth();

  // UNIVERSAL PRODUCTION GUARD:
  // Do not render ANY routes until the initial session check is complete.
  // This prevents the "Flicker" of protected layouts to unauthorized users.
  if (authStatus === 'initializing') {
    return <LoadingFallback />;
  }

  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <Suspense fallback={<LoadingFallback />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.key}>
            {/* Eagerly Loaded Auth/Public Routes (Zero Flicker) */}
            <Route path={PATHS.STYLE_GUIDE} element={<StyleGuide />} />
            <Route path={PATHS.LOGIN} element={<FirstVisitGuard><Login /></FirstVisitGuard>} />
            <Route path={PATHS.SIGNUP} element={<Signup />} />
            <Route path={PATHS.FORGOT_PASSWORD} element={<ForgotPassword />} />
            <Route path={PATHS.PRIVACY} element={<PrivacyPolicy />} />
            <Route path={PATHS.TERMS} element={<TermsOfService />} />

            {/* Lazy Loaded Routes */}
            <Route path={PATHS.HELP} element={<Help />} />
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <RoleRouter />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.CONSENT}
              element={
                <ProtectedRoute>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <TelemedicineConsent />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.TELEMEDICINE}
              element={
                <ProtectedRoute>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <TelemedicineDashboard />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.PROFILE}
              element={
                <ProtectedRoute>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <Profile />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.SETTINGS}
              element={
                <ProtectedRoute>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <Settings />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.PATIENT.FIND_DOCTORS}
              element={
                <RoleRoute allowedRoles={['patient']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <FindDoctors />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PATIENT.BOOK_APPOINTMENT}
              element={
                <RoleRoute allowedRoles={['patient']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <BookAppointment />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PATIENT.APPOINTMENTS}
              element={
                <RoleRoute allowedRoles={['patient', 'doctor']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <Appointments />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PATIENT.PRESCRIPTIONS}
              element={
                <RoleRoute allowedRoles={['patient', 'doctor', 'pharmacist']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <Prescriptions />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PATIENT.MEDICAL_RECORDS}
              element={
                <RoleRoute allowedRoles={['patient']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <MedicalRecords />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.DOCTOR.SCHEDULE}
              element={
                <RoleRoute allowedRoles={['doctor']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <DoctorScheduleManagement />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PHARMACIST.QUEUE}
              element={
                <RoleRoute allowedRoles={['pharmacist']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <PrescriptionQueue />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PHARMACIST.DISPENSE}
              element={
                <RoleRoute allowedRoles={['pharmacist']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <DispensePrescription />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PHARMACIST.INVENTORY}
              element={
                <RoleRoute allowedRoles={['pharmacist']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <Inventory />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.VERIFY_DOCTORS}
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <VerifyDoctors />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.DOCTOR.PATIENTS}
              element={
                <RoleRoute allowedRoles={['doctor']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <DoctorPatientList />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.DOCTOR.REPORTS}
              element={
                <RoleRoute allowedRoles={['doctor']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <DoctorReports />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.DASHBOARD}
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <AdminDashboard />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.USERS}
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <UserManagement />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.SYSTEM_LOGS}
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <SystemLogs />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.SECURITY}
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <SecurityMonitoring />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.SESSIONS}
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>
                    <PageTransition>
                      <SessionManagement />
                    </PageTransition>
                  </LazyDashboardLayout></Suspense>
                </RoleRoute>
              }
            />
            <Route
              path="/consultation/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingFallback />}>
                    <VideoConsultation />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route path={PATHS.DOCTOR.DASHBOARD_LEGACY} element={<Navigate to={PATHS.DASHBOARD} replace />} />
            <Route path={PATHS.ADMIN.DASHBOARD_LEGACY} element={<Navigate to={PATHS.ADMIN.DASHBOARD} replace />} />
            <Route path={PATHS.ROOT} element={<IdentityGate />} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </ErrorBoundary>
  );
};

import { LanguageProvider } from './context/language-context';


const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>

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

      </Router>
    </ErrorBoundary>
  );
};

export default App;
// Dummy commit for pipeline verification
