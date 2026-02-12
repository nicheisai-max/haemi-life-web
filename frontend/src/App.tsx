import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { NetworkStatusProvider } from './context/NetworkStatus';
import { SessionManagerProvider } from './context/SessionManager';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ScrollToTop } from './components/utils/ScrollToTop';
import { PremiumLoader } from './components/ui/PremiumLoader';

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
import { DoctorPatientList } from './pages/doctor/DoctorPatientList';

const LoadingFallback = () => <PremiumLoader />;

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated) {
    // Save the intended destination so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

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

import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const pageVariants = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

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
            <Route path="/help" element={<Help />} />
            <Route path="/consent" element={<TelemedicineConsent />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <RoleBasedDashboard />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <Profile />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <Settings />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctors"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <FindDoctors />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/book-appointment"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <BookAppointment />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <Appointments />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/prescriptions"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <Prescriptions />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/records"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <MedicalRecords />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/schedule"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <DoctorScheduleManagement />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pharmacist/queue"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <PrescriptionQueue />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pharmacist/inventory"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <Inventory />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/verify-doctors"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <VerifyDoctors />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.DOCTOR.PATIENTS}
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <DoctorPatientList />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.DASHBOARD}
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <AdminDashboard />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.USERS}
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <UserManagement />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path={PATHS.ADMIN.SYSTEM_LOGS}
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}>
                      <SystemLogs />
                    </motion.div>
                  </DashboardLayout>
                </ProtectedRoute>
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
            <Route path="*" element={<motion.div initial="initial" animate="animate" exit="exit" variants={pageVariants}><NotFound /></motion.div>} />
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
