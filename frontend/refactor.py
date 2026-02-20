import re
with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports
code = code.replace(
    "import { DashboardLayout } from './components/layout/DashboardLayout';",
    "import { DelayedFallback } from './components/layout/DelayedFallback';\nconst LazyDashboardLayout = lazy(() => import('./components/layout/DashboardLayout').then(m => ({ default: m.DashboardLayout })));\nconst RoleRouter = lazy(() => import('./components/layout/RoleRouter').then(m => ({ default: m.RoleRouter })));"
)

# 2. Fix static leak
code = code.replace(
    "const DoctorReports = lazy(() => import('./pages/doctor/Reports'));\nconst DispensePrescription = lazy(() => import('./pages/pharmacist/DispensePrescription'));\nimport { DoctorPatientList } from './pages/doctor/DoctorPatientList';",
    "const DoctorReports = lazy(() => import('./pages/doctor/Reports').then(m => ({ default: m.default || m.DoctorReports })));\nconst DispensePrescription = lazy(() => import('./pages/pharmacist/DispensePrescription').then(m => ({ default: m.default || m.DispensePrescription })));\nconst DoctorPatientList = lazy(() => import('./pages/doctor/DoctorPatientList').then(m => ({ default: m.DoctorPatientList })));"
)

# 3. Remove RoleBasedDashboard block
code = re.sub(r'const RoleBasedDashboard: React\.FC = \(\) => \{[\s\S]*?^\};\n', '// RoleBasedDashboard moved to RoleRouter.tsx for architectural safety\n', code, flags=re.MULTILINE)

# 4. Update RoleBasedDashboard usage to RoleRouter
code = code.replace('<RoleBasedDashboard />', '<RoleRouter />')

# 5. Wrap DashboardLayout with Suspense and Lazy
code = code.replace('<DashboardLayout>', '<Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>')
code = code.replace('</DashboardLayout>', '</LazyDashboardLayout></Suspense>')

# 6. Remove the outer Suspense that breaks animations
code = re.sub(r'<Suspense fallback=\{<LoadingFallback />\}>\n\s*<AnimatePresence mode=\"wait\">', '<AnimatePresence mode=\"wait\">', code)
code = re.sub(r'</AnimatePresence>\n\s*</Suspense>', '</AnimatePresence>', code)

# 7. Change ErrorBoundary behavior
code = code.replace("<ErrorBoundary onReset={() => navigate('/dashboard')}>", "<ErrorBoundary onReset={() => window.location.reload()}>")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('App.tsx successfully updated via Python script.')
