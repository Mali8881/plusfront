import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LocaleProvider } from '../context/LocaleContext';

import Login          from '../pages/auth/Login';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ExitInterview  from '../pages/public/ExitInterview';
import Dashboard      from '../pages/user/Dashboard';
import Onboarding     from '../pages/user/Onboarding';
import Regulations    from '../pages/user/Regulations';
import Schedule       from '../pages/user/Schedule';
import Profile        from '../pages/user/Profile';
import Instructions   from '../pages/user/Instructions';
import Tasks          from '../pages/user/Tasks';
import Salary         from '../pages/user/Salary';
import Company        from '../pages/user/Company';
import DeskBooking    from '../pages/user/DeskBooking';

import AdminUsers      from '../pages/admin/Users';
import AdminRoles      from '../pages/admin/Roles';
import AdminDepartmentsSubdivisions from '../pages/admin/DepartmentsSubdivisions';
import AdminContent    from '../pages/admin/Content';
import AdminOverview   from '../pages/admin/Overview';
import AdminSchedules  from '../pages/admin/Schedules';
import AdminFeedback   from '../pages/admin/Feedback';
import AdminSystem     from '../pages/admin/System';
import AdminInterface  from '../pages/admin/Interface';
import AttendanceMarks from '../pages/admin/AttendanceMarks';
import AdminInterns    from '../pages/admin/Interns';
import AutoLocaleText  from '../components/common/AutoLocaleText';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'department_head' || user.role === 'admin' || user.role === 'superadmin') return <Navigate to="/admin/overview" replace />;
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
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return <Navigate to="/admin/overview" replace />;
  }
  return children;
}

function SuperAdminRoute({ children }) {
  const { user, isSuperAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/admin/overview" replace />;
  return children;
}

function InternsManageRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!['projectmanager', 'department_head', 'admin', 'superadmin'].includes(String(user.role || '').toLowerCase())) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function NonInternRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'intern') return <Navigate to="/onboarding" replace />;
  return children;
}

// Зарплата: все кроме стажера
function SalaryRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'intern') return <Navigate to="/dashboard" replace />;
  // superadmin тоже может использовать /salary
  if (user.role === 'department_head' || user.role === 'admin' || user.role === 'superadmin') return children;
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
  if (user.role === 'superadmin') return <Navigate to="/admin/overview" replace />;
  return children;
}

function AttendanceMarksRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!['projectmanager', 'department_head', 'admin', 'superadmin'].includes(String(user.role || '').toLowerCase())) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user } = useAuth();
  if (!user) return children;
  if (user.role === 'department_head' || user.role === 'admin' || user.role === 'superadmin') return <Navigate to="/admin/overview" replace />;
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
      <Route path="/exit-interview/:token" element={<ExitInterview />} />

      <Route path="/dashboard"      element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/onboarding"     element={<PrivateRoute><Onboarding /></PrivateRoute>} />
      <Route path="/regulations"    element={<NonInternRoute><Regulations /></NonInternRoute>} />
      <Route path="/schedule"       element={<NonInternRoute><Schedule /></NonInternRoute>} />
      <Route path="/desks"          element={<NonInternRoute><DeskBooking /></NonInternRoute>} />
      <Route path="/profile"        element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/instructions"   element={<PrivateRoute><Instructions /></PrivateRoute>} />
      <Route path="/company"        element={<CompanyRoute><Company /></CompanyRoute>} />
      <Route path="/tasks"          element={<TasksRoute><Tasks /></TasksRoute>} />
      <Route path="/salary"         element={<SalaryRoute><Salary /></SalaryRoute>} />
      <Route path="/attendance-marks" element={<AttendanceMarksRoute><AttendanceMarks /></AttendanceMarksRoute>} />

      <Route path="/admin/overview"   element={<AdminRoute><AdminOverview /></AdminRoute>} />
      <Route path="/admin/users"      element={<AdminRoute><AdminUsers /></AdminRoute>} />
      <Route path="/admin/roles"      element={<AdminRoute><AdminRoles /></AdminRoute>} />
      <Route path="/admin/departments-subdivisions" element={<AdminRoute><AdminDepartmentsSubdivisions /></AdminRoute>} />
      <Route path="/admin/content"    element={<ContentManageRoute><AdminContent /></ContentManageRoute>} />
      <Route path="/admin/onboarding" element={<InternsManageRoute><AdminInterns /></InternsManageRoute>} />
      <Route path="/admin/interns"    element={<InternsManageRoute><AdminInterns /></InternsManageRoute>} />
      <Route path="/admin/schedules"  element={<AdminRoute><AdminSchedules /></AdminRoute>} />
      <Route path="/admin/feedback"   element={<AdminRoute><AdminFeedback /></AdminRoute>} />
      <Route path="/admin/system"     element={<SuperAdminRoute><AdminSystem /></SuperAdminRoute>} />
      <Route path="/admin/interface"  element={<SuperAdminRoute><AdminInterface /></SuperAdminRoute>} />

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

