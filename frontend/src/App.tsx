import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { NetworkStatusProvider } from './context/NetworkStatus';
import { SessionManagerProvider } from './context/SessionManager';
import { StyleGuide } from './pages/public/StyleGuide';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Login } from './pages/public/Login';
import { Signup } from './pages/public/Signup';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { PharmacistDashboard } from './pages/pharmacist/PharmacistDashboard';
import { Profile } from './pages/profile/Profile';
import { Settings } from './pages/settings/Settings';
import { FindDoctors } from './pages/doctors/FindDoctors';
import { BookAppointment } from './pages/appointments/BookAppointment';
import { Appointments } from './pages/appointments/Appointments';
import { Prescriptions } from './pages/prescriptions/Prescriptions';
import { MedicalRecords } from './pages/patient/MedicalRecords';
import { DoctorScheduleManagement } from './pages/doctor/DoctorScheduleManagement';
import { PrescriptionQueue } from './pages/pharmacist/PrescriptionQueue';
import { VerifyDoctors } from './pages/admin/VerifyDoctors';
import { UserManagement } from './pages/admin/UserManagement';
import { Inventory } from './pages/pharmacist/Inventory';
import { PrivacyPolicy } from './pages/legal/PrivacyPolicy';
import { TermsOfService } from './pages/legal/TermsOfService';
import { Help } from './pages/support/Help';
import { TelemedicineConsent } from './pages/legal/TelemedicineConsent';
import { Onboarding } from './pages/onboarding/Onboarding';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
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
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
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
  );
};

export default App;
