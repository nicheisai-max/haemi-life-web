const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Replace Imports
code = code.replace(
    "import { DashboardLayout } from './components/layout/DashboardLayout';",
    "import { DelayedFallback } from './components/layout/DelayedFallback';\nconst LazyDashboardLayout = lazy(() => import('./components/layout/DashboardLayout').then(m => ({ default: m.DashboardLayout })));\nconst RoleRouter = lazy(() => import('./components/layout/RoleRouter').then(m => ({ default: m.RoleRouter })));"
);

// 2. Fix static leak of DoctorPatientList and fix default exports
code = code.replace(
    "const DoctorReports = lazy(() => import('./pages/doctor/Reports'));\nconst DispensePrescription = lazy(() => import('./pages/pharmacist/DispensePrescription'));\nimport { DoctorPatientList } from './pages/doctor/DoctorPatientList';",
    "const DoctorReports = lazy(() => import('./pages/doctor/Reports').then(m => ({ default: m.default || m.DoctorReports })));\nconst DispensePrescription = lazy(() => import('./pages/pharmacist/DispensePrescription').then(m => ({ default: m.default || m.DispensePrescription })));\nconst DoctorPatientList = lazy(() => import('./pages/doctor/DoctorPatientList').then(m => ({ default: m.DoctorPatientList })));"
);

// 3. Remove RoleBasedDashboard block
code = code.replace(
    /const RoleBasedDashboard: React\.FC = \(\) => \{[\s\S]*?^\};\n/m,
    "// RoleBasedDashboard moved to RoleRouter.tsx for architectural safety\n"
);

// 4. Update RoleBasedDashboard usage to RoleRouter
code = code.replace(/<RoleBasedDashboard \/>/g, "<RoleRouter />");

// 5. Wrap LazyDashboardLayout with Suspense
code = code.replace(/<DashboardLayout>/g, "<Suspense fallback={<DelayedFallback />}><LazyDashboardLayout>");
code = code.replace(/<\/DashboardLayout>/g, "</LazyDashboardLayout></Suspense>");

// 6. Remove the outer Suspense that breaks animations
code = code.replace(/<Suspense fallback=\{<LoadingFallback \/>\}>\n\s*<AnimatePresence mode="wait">/g, "<AnimatePresence mode=\"wait\">");
code = code.replace(/<\/AnimatePresence>\n\s*<\/Suspense>/g, "</AnimatePresence>");

// 7. Change ErrorBoundary behavior
code = code.replace(/<ErrorBoundary onReset=\{\(\) => navigate\('\/dashboard'\)\}>/g, "<ErrorBoundary onReset={() => window.location.reload()}>");

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx surgically updated.');
