import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { NetworkStatusProvider } from './context/NetworkStatus';
import { SessionManagerProvider } from './context/SessionManager';
import { AlertDialogProvider } from './context/AlertDialogContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DelayedFallback } from './components/layout/DelayedFallback';
const LazyDashboardLayout = lazy(() => import('./components/layout/DashboardLayout').then(m => ({ default: m.DashboardLayout })));
const RoleRouter = lazy(() => import('./components/layout/RoleRouter').then(m => ({ default: m.RoleRouter })));
import { ScrollToTop } from './components/utils/ScrollToTop';
import { PageTransition } from './components/layout/PageTransition';
import { MedicalLoader } from './components/ui/MedicalLoader';
import { RoleRoute } from './components/auth/RoleRoute';

// Lazy loaded pages
// Eagerly loaded Auth/Public pages for zero-jerks and instantaneous navigation
import { Login } from './pages/public/Login';
import { Signup } from './pages/public/Signup';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { StyleGuide } from './pages/public/StyleGuide';
import { PATHS } from './routes/paths';

// Lazy loaded dashboard pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Profile = lazy(() => import('./pages/profile/Profile').then(m => ({ default: m.Profile })));
const Settings = lazy(() => import('./pages/settings/Settings').then(m => ({ default: m.Settings })));
const FindDoctors = lazy(() => import('./pages/doctors/FindDoctors').then(m => ({ default: m.FindDoctors })));
const BookAppointment = lazy(() => import('./pages/appointments/BookAppointment').then(m => ({ default: m.BookAppointment })));
const Appointments = lazy(() => import('./pages/appointments/Appointments').then(m => ({ default: m.Appointments })));
const Prescriptions = lazy(() => import('./pages/prescriptions/Prescriptions').then(m => ({ default: m.Prescriptions })));
const MedicalRecords = lazy(() => import('./pages/patient/MedicalRecords').then(m => ({ default: m.MedicalRecords })));
const DoctorScheduleManagement = lazy(() => import('./pages/doctor/DoctorScheduleManagement').then(m => ({ default: m.DoctorScheduleManagement })));
const PrescriptionQueue = lazy(() => import('./pages/pharmacist/PrescriptionQueue').then(m => ({ default: m.PrescriptionQueue })));
const VerifyDoctors = lazy(() => import('./pages/admin/VerifyDoctors').then(m => ({ default: m.VerifyDoctors })));
const UserManagement = lazy(() => import('./pages/admin/UserManagement').then(m => ({ default: m.UserManagement })));
const SystemLogs = lazy(() => import('./pages/admin/SystemLogs').then(m => ({ default: m.SystemLogs })));
const Inventory = lazy(() => import('./pages/pharmacist/Inventory').then(m => ({ default: m.Inventory })));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService').then(m => ({ default: m.TermsOfService })));
const Help = lazy(() => import('./pages/support/Help').then(m => ({ default: m.Help })));
const TelemedicineConsent = lazy(() => import('./pages/legal/TelemedicineConsent').then(m => ({ default: m.TelemedicineConsent })));
const TelemedicineDashboard = lazy(() => import('./pages/telemedicine/TelemedicineDashboard').then(m => ({ default: m.TelemedicineDashboard })));
const Onboarding = lazy(() => import('./pages/onboarding/Onboarding').then(m => ({ default: m.Onboarding })));
const VideoConsultation = lazy(() => import('./components/telemedicine/VideoConsultation').then(m => ({ default: m.VideoConsultation })));
const NotFound = lazy(() => import('./pages/public/NotFound').then(m => ({ default: m.NotFound })));
const DoctorReports = lazy(() => import('./pages/doctor/Reports'));
const DispensePrescription = lazy(() => import('./pages/pharmacist/DispensePrescription'));
import { DoctorPatientList } from './pages/doctor/DoctorPatientList';

const LoadingFallback = () => <MedicalLoader fullPage message="Securing clinical data..." />;

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { authStatus } = useAuth();
  const location = useLocation();

  // 1. Initial Synchronous Initialization Phase
  if (authStatus === 'initializing') {
    return <LoadingFallback />;
  }

  // 2. Deterministic "Authenticated" Check
  // V12 FIX: Explicitly require 'authenticated'. 
  // Any other status (undefined, empty, unauthenticated) triggers a redirect.
  if (authStatus !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location?.pathname }} replace />;
  }

  return children;
};

const AppRoutes = () => {
  const location = useLocation();

  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <Suspense fallback={<LoadingFallback />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {/* Eagerly Loaded Auth/Public Routes (Zero Flicker) */}
            <Route path={PATHS.STYLE_GUIDE} element={<StyleGuide />} />
            <Route path={PATHS.LOGIN} element={<Login />} />
            <Route path={PATHS.SIGNUP} element={<Signup />} />
            <Route path={PATHS.FORGOT_PASSWORD} element={<ForgotPassword />} />
            <Route path={PATHS.PRIVACY} element={<PrivacyPolicy />} />
            <Route path={PATHS.TERMS} element={<TermsOfService />} />

            {/* Lazy Loaded Routes */}
            <Route path={PATHS.HELP} element={<Help />} />
            <Route path={PATHS.ONBOARDING} element={<Onboarding />} />
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
            <Route path={PATHS.ROOT} element={<Navigate to={PATHS.DASHBOARD} replace />} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </ErrorBoundary>
  );
};

import { LanguageProvider } from './context/LanguageContext';

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
                      <ScrollToTop />
                      <AppRoutes />
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
