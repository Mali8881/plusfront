import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LocaleProvider } from '../context/LocaleContext';

import Login          from '../pages/auth/Login';
import ForgotPassword from '../pages/auth/ForgotPassword';
import Dashboard      from '../pages/user/Dashboard';
import Onboarding     from '../pages/user/Onboarding';
import Regulations    from '../pages/user/Regulations';
import Schedule       from '../pages/user/Schedule';
import Profile        from '../pages/user/Profile';
import Instructions   from '../pages/user/Instructions';
import Tasks          from '../pages/user/Tasks';
import Salary         from '../pages/user/Salary';
import Company        from '../pages/user/Company';
import Attendance     from '../pages/user/Attendance';
import Team           from '../pages/user/Team';

import AdminUsers      from '../pages/admin/Users';
import AdminRoles      from '../pages/admin/Roles';
import AdminContent    from '../pages/admin/Content';
import AdminOnboarding from '../pages/admin/Onboarding';
import AdminOverview   from '../pages/admin/Overview';
import AdminSchedules  from '../pages/admin/Schedules';
import AdminFeedback   from '../pages/admin/Feedback';
import AdminSystem     from '../pages/admin/System';
import AdminInterface  from '../pages/admin/Interface';
import AutoLocaleText  from '../components/common/AutoLocaleText';
import { isAdminRole, isInternRole, normalizeRole, pathFromLanding } from '../utils/roles';

function HomeRedirect() {
  const { user, landing } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={pathFromLanding(landing)} replace />;
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { user, isSuperAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/admin/overview" replace />;
  return children;
}

function OnboardingManageRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'projectmanager') return <Navigate to="/dashboard" replace />;
  return children;
}

// Зарплата: все кроме стажера
function SalaryRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (isInternRole(user.role)) return <Navigate to="/dashboard" replace />;
  // superadmin тоже может заходить через /salary
  if (isAdminRole(user.role)) return children;
  return children;
}

function CompanyRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (isInternRole(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AttendanceRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const role = normalizeRole(user.role);
  const canAccess = role === 'admin' || role === 'administrator' || role === 'superadmin';
  if (!canAccess) return <Navigate to="/dashboard" replace />;
  return children;
}

function TeamRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const role = normalizeRole(user.role);
  const canAccess = role === 'projectmanager' || role === 'admin' || role === 'administrator' || role === 'superadmin';
  if (!canAccess) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, landing } = useAuth();
  if (!user) return children;
  return <Navigate to={pathFromLanding(landing)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <AutoLocaleText />
          <AppRoutes />
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"               element={<HomeRedirect />} />
      <Route path="/login"          element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />

      <Route path="/dashboard"      element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/onboarding"     element={<PrivateRoute><Onboarding /></PrivateRoute>} />
      <Route path="/regulations"    element={<PrivateRoute><Regulations /></PrivateRoute>} />
      <Route path="/schedule"       element={<PrivateRoute><Schedule /></PrivateRoute>} />
      <Route path="/profile"        element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/instructions"   element={<PrivateRoute><Instructions /></PrivateRoute>} />
      <Route path="/company"        element={<CompanyRoute><Company /></CompanyRoute>} />
      <Route path="/tasks"          element={<PrivateRoute><Tasks /></PrivateRoute>} />
      <Route path="/attendance"     element={<AttendanceRoute><Attendance /></AttendanceRoute>} />
      <Route path="/team"           element={<TeamRoute><Team /></TeamRoute>} />
      <Route path="/salary"         element={<SalaryRoute><Salary /></SalaryRoute>} />

      <Route path="/admin/overview"   element={<AdminRoute><AdminOverview /></AdminRoute>} />
      <Route path="/admin/users"      element={<AdminRoute><AdminUsers /></AdminRoute>} />
      <Route path="/admin/roles"      element={<AdminRoute><AdminRoles /></AdminRoute>} />
      <Route path="/admin/content"    element={<AdminRoute><AdminContent /></AdminRoute>} />
      <Route path="/admin/onboarding" element={<OnboardingManageRoute><AdminOnboarding /></OnboardingManageRoute>} />
      <Route path="/admin/schedules"  element={<AdminRoute><AdminSchedules /></AdminRoute>} />
      <Route path="/admin/feedback"   element={<AdminRoute><AdminFeedback /></AdminRoute>} />
      <Route path="/admin/system"     element={<SuperAdminRoute><AdminSystem /></SuperAdminRoute>} />
      <Route path="/admin/interface"  element={<SuperAdminRoute><AdminInterface /></SuperAdminRoute>} />

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

