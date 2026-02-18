import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { NetworkStatusProvider } from './context/NetworkStatus';
import { SessionManagerProvider } from './context/SessionManager';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DashboardLayout } from './components/layout/DashboardLayout';
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
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard').then(m => ({ default: m.PatientDashboard })));
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const PharmacistDashboard = lazy(() => import('./pages/pharmacist/PharmacistDashboard').then(m => ({ default: m.PharmacistDashboard })));
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
const Onboarding = lazy(() => import('./pages/onboarding/Onboarding').then(m => ({ default: m.Onboarding })));
const VideoConsultation = lazy(() => import('./components/telemedicine/VideoConsultation').then(m => ({ default: m.VideoConsultation })));
const NotFound = lazy(() => import('./pages/public/NotFound').then(m => ({ default: m.NotFound })));
const DoctorReports = lazy(() => import('./pages/doctor/Reports'));
const DispensePrescription = lazy(() => import('./pages/pharmacist/DispensePrescription'));
import { DoctorPatientList } from './pages/doctor/DoctorPatientList';

const LoadingFallback = () => <MedicalLoader fullPage message="Securing clinical data..." />;

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // During initial app-load verification, show a loader.
  // NEVER redirect during this phase — the user may be authenticated
  // but the async verification hasn't completed yet.
  if (isLoading) {
    return <LoadingFallback />;
  }

  // Verification complete. If not authenticated, redirect to login.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated — render the protected content.
  return children;
};


const RoleBasedDashboard: React.FC = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'patient':
      return <PatientDashboard />;
    case 'doctor':
      return <DoctorDashboard />;
    case 'admin':
      return <AdminDashboard />;
    case 'pharmacist':
      return <PharmacistDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
};

import { AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <ErrorBoundary onReset={() => navigate('/dashboard')}>
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
            <Route path={PATHS.CONSENT} element={<TelemedicineConsent />} />
            <Route path={PATHS.ONBOARDING} element={<Onboarding />} />
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PageTransition>
                      <RoleBasedDashboard />
                    </PageTransition>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.PROFILE}
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PageTransition>
                      <Profile />
                    </PageTransition>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.SETTINGS}
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PageTransition>
                      <Settings />
                    </PageTransition>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.PATIENT.FIND_DOCTORS}
              element={
                <RoleRoute allowedRoles={['patient']}>
                  <DashboardLayout>
                    <PageTransition>
                      <FindDoctors />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PATIENT.BOOK_APPOINTMENT}
              element={
                <RoleRoute allowedRoles={['patient']}>
                  <DashboardLayout>
                    <PageTransition>
                      <BookAppointment />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PATIENT.APPOINTMENTS}
              element={
                <RoleRoute allowedRoles={['patient', 'doctor']}>
                  <DashboardLayout>
                    <PageTransition>
                      <Appointments />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PATIENT.PRESCRIPTIONS}
              element={
                <RoleRoute allowedRoles={['patient', 'doctor', 'pharmacist']}>
                  <DashboardLayout>
                    <PageTransition>
                      <Prescriptions />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PATIENT.MEDICAL_RECORDS}
              element={
                <RoleRoute allowedRoles={['patient']}>
                  <DashboardLayout>
                    <PageTransition>
                      <MedicalRecords />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.DOCTOR.SCHEDULE}
              element={
                <RoleRoute allowedRoles={['doctor']}>
                  <DashboardLayout>
                    <PageTransition>
                      <DoctorScheduleManagement />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PHARMACIST.QUEUE}
              element={
                <RoleRoute allowedRoles={['pharmacist']}>
                  <DashboardLayout>
                    <PageTransition>
                      <PrescriptionQueue />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PHARMACIST.DISPENSE}
              element={
                <RoleRoute allowedRoles={['pharmacist']}>
                  <DashboardLayout>
                    <PageTransition>
                      <DispensePrescription />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.PHARMACIST.INVENTORY}
              element={
                <RoleRoute allowedRoles={['pharmacist']}>
                  <DashboardLayout>
                    <PageTransition>
                      <Inventory />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.VERIFY_DOCTORS}
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <DashboardLayout>
                    <PageTransition>
                      <VerifyDoctors />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.DOCTOR.PATIENTS}
              element={
                <RoleRoute allowedRoles={['doctor']}>
                  <DashboardLayout>
                    <PageTransition>
                      <DoctorPatientList />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.DOCTOR.REPORTS}
              element={
                <RoleRoute allowedRoles={['doctor']}>
                  <DashboardLayout>
                    <PageTransition>
                      <DoctorReports />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.DASHBOARD}
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <DashboardLayout>
                    <PageTransition>
                      <AdminDashboard />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.USERS}
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <DashboardLayout>
                    <PageTransition>
                      <UserManagement />
                    </PageTransition>
                  </DashboardLayout>
                </RoleRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.SYSTEM_LOGS}
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <DashboardLayout>
                    <PageTransition>
                      <SystemLogs />
                    </PageTransition>
                  </DashboardLayout>
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
              <NetworkStatusProvider>
                <SessionManagerProvider>
                  <LanguageProvider>
                    <ScrollToTop />
                    <AppRoutes />
                  </LanguageProvider>
                </SessionManagerProvider>
              </NetworkStatusProvider>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
