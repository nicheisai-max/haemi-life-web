import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { NetworkStatusProvider } from './context/NetworkStatus';
import { SessionManagerProvider } from './context/SessionManager';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { SkeletonLoader } from './components/loaders/SkeletonLoader';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Lazy loaded pages
const StyleGuide = lazy(() => import('./pages/public/StyleGuide').then(m => ({ default: m.StyleGuide })));
const Login = lazy(() => import('./pages/public/Login').then(m => ({ default: m.Login })));
const Signup = lazy(() => import('./pages/public/Signup').then(m => ({ default: m.Signup })));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
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
const Inventory = lazy(() => import('./pages/pharmacist/Inventory').then(m => ({ default: m.Inventory })));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService').then(m => ({ default: m.TermsOfService })));
const Help = lazy(() => import('./pages/support/Help').then(m => ({ default: m.Help })));
const TelemedicineConsent = lazy(() => import('./pages/legal/TelemedicineConsent').then(m => ({ default: m.TelemedicineConsent })));
const Onboarding = lazy(() => import('./pages/onboarding/Onboarding').then(m => ({ default: m.Onboarding })));
const VideoConsultation = lazy(() => import('./components/telemedicine/VideoConsultation').then(m => ({ default: m.VideoConsultation })));
const NotFound = lazy(() => import('./pages/public/NotFound').then(m => ({ default: m.NotFound })));

const LoadingFallback = () => (
  <div style={{ height: '100vh', padding: '2rem' }}>
    <SkeletonLoader variant="card" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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

const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/style-guide" element={<StyleGuide />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/help" element={<Help />} />
        <Route path="/consent" element={<TelemedicineConsent />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <RoleBasedDashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Profile />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/find-doctors"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <FindDoctors />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/book-appointment"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <BookAppointment />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Appointments />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/prescriptions"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Prescriptions />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/records"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MedicalRecords />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/schedule"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <DoctorScheduleManagement />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacist/queue"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <PrescriptionQueue />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacist/inventory"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Inventory />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/verify-doctors"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <VerifyDoctors />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <UserManagement />
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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <NetworkStatusProvider>
              <SessionManagerProvider>
                <Router>
                  <AppRoutes />
                </Router>
              </SessionManagerProvider>
            </NetworkStatusProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
