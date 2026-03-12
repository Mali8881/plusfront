import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LocaleProvider } from '../context/LocaleContext';

import Login          from '../pages/auth/Login';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword  from '../pages/auth/ResetPassword';
import Dashboard      from '../pages/user/Dashboard';
import Onboarding     from '../pages/user/Onboarding';
import Regulations    from '../pages/user/Regulations';
import Schedule       from '../pages/user/Schedule';
import Profile        from '../pages/user/Profile';
import Instructions   from '../pages/user/Instructions';
import Tasks          from '../pages/user/Tasks';
import Salary         from '../pages/user/Salary';
import Company        from '../pages/user/Company';

import AdminUsers      from '../pages/admin/Users';
import AdminRoles      from '../pages/admin/Roles';
import AdminDepartmentsSubdivisions from '../pages/admin/DepartmentsSubdivisions';
import AdminContent    from '../pages/admin/Content';
import AdminOnboarding from '../pages/admin/Onboarding';
import AdminOverview   from '../pages/admin/Overview';
import AdminSchedules  from '../pages/admin/Schedules';
import AdminFeedback   from '../pages/admin/Feedback';
import AdminSystem     from '../pages/admin/System';
import AdminInterface  from '../pages/admin/Interface';
import AttendanceMarks from '../pages/admin/AttendanceMarks';
import AdminInterns    from '../pages/admin/Interns';
import AutoLocaleText  from '../components/common/AutoLocaleText';

const ADMIN_ROLES = ['department_head', 'admin', 'administrator', 'superadmin'];
const CONTENT_MANAGE_ROLES = ['department_head', 'admin', 'administrator', 'superadmin'];

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (ADMIN_ROLES.includes(String(user.role || '').toLowerCase())) return <Navigate to="/admin/overview" replace />;
  return <Navigate to="/dashboard" replace />;
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

function ContentManageRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!CONTENT_MANAGE_ROLES.includes(String(user.role || '').toLowerCase())) {
    return <Navigate to="/admin/overview" replace />;
  }
  return children;
}

function TrueSuperAdminRoute({ children }) {
  const { user, isSuperAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/admin/overview" replace />;
  return children;
}

function OnboardingManageRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const allowed = ['admin', 'administrator', 'superadmin', 'projectmanager', 'department_head'];
  if (!allowed.includes(String(user.role || '').toLowerCase())) return <Navigate to="/dashboard" replace />;
  return children;
}

function InternsManageRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!['department_head', 'admin', 'administrator', 'superadmin'].includes(String(user.role || '').toLowerCase())) {
    return <Navigate to="/admin/overview" replace />;
  }
  return children;
}

function NonInternRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'intern') return <Navigate to="/onboarding" replace />;
  return children;
}

// Зарплата: все кроме стажера и руководителя отдела
function SalaryRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'intern' || user.role === 'department_head') return <Navigate to="/dashboard" replace />;
  return children;
}

function CompanyRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'intern') return <Navigate to="/dashboard" replace />;
  return children;
}

function TasksRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AttendanceMarksRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!['projectmanager', 'department_head', 'admin', 'administrator', 'superadmin'].includes(String(user.role || '').toLowerCase())) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user } = useAuth();
  if (!user) return children;
  if (ADMIN_ROLES.includes(String(user.role || '').toLowerCase())) return <Navigate to="/admin/overview" replace />;
  return <Navigate to="/dashboard" replace />;
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
      <Route path="/reset-password"  element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />

      <Route path="/dashboard"      element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/onboarding"     element={<PrivateRoute><Onboarding /></PrivateRoute>} />
      <Route path="/regulations"    element={<NonInternRoute><Regulations /></NonInternRoute>} />
      <Route path="/schedule"       element={<NonInternRoute><Schedule /></NonInternRoute>} />
      <Route path="/profile"        element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/instructions"   element={<PrivateRoute><Instructions /></PrivateRoute>} />
      <Route path="/company"        element={<CompanyRoute><Company /></CompanyRoute>} />
      <Route path="/tasks"          element={<TasksRoute><Tasks /></TasksRoute>} />
      <Route path="/salary"         element={<SalaryRoute><Salary /></SalaryRoute>} />
      <Route path="/attendance-marks" element={<AttendanceMarksRoute><AttendanceMarks /></AttendanceMarksRoute>} />

      <Route path="/admin/overview"   element={<AdminRoute><AdminOverview /></AdminRoute>} />
      <Route path="/admin/users"      element={<AdminRoute><AdminUsers /></AdminRoute>} />
      <Route path="/admin/roles"      element={<TrueSuperAdminRoute><AdminRoles /></TrueSuperAdminRoute>} />
      <Route path="/admin/departments-subdivisions" element={<AdminRoute><AdminDepartmentsSubdivisions /></AdminRoute>} />
      <Route path="/admin/content"    element={<ContentManageRoute><AdminContent /></ContentManageRoute>} />
      <Route path="/admin/onboarding" element={<OnboardingManageRoute><AdminOnboarding /></OnboardingManageRoute>} />
      <Route path="/admin/interns"    element={<InternsManageRoute><AdminInterns /></InternsManageRoute>} />
      <Route path="/admin/schedules"  element={<AdminRoute><AdminSchedules /></AdminRoute>} />
      <Route path="/admin/feedback"   element={<AdminRoute><AdminFeedback /></AdminRoute>} />
      <Route path="/admin/system"     element={<TrueSuperAdminRoute><AdminSystem /></TrueSuperAdminRoute>} />
      <Route path="/admin/interface"  element={<TrueSuperAdminRoute><AdminInterface /></TrueSuperAdminRoute>} />

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

