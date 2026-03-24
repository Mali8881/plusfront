import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LocaleProvider } from '../context/LocaleContext';
import AutoLocaleText from '../components/common/AutoLocaleText';
import {
  ADMINISTRATOR_ROLES,
  ADMIN_LIKE_ROLES,
  DEPARTMENT_HEAD_ROLES,
  TEAM_MANAGER_ROLES,
  hasAnyRole,
} from '../utils/roles';

const Login = lazy(() => import('../pages/auth/Login'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));
const Dashboard = lazy(() => import('../pages/user/Dashboard'));
const Onboarding = lazy(() => import('../pages/user/Onboarding'));
const Regulations = lazy(() => import('../pages/user/Regulations'));
const Profile = lazy(() => import('../pages/user/Profile'));
const Instructions = lazy(() => import('../pages/user/Instructions'));
const Tasks = lazy(() => import('../pages/user/Tasks'));
const Salary = lazy(() => import('../pages/user/Salary'));
const Company = lazy(() => import('../pages/user/Company'));
const Lessons = lazy(() => import('../pages/user/Lessons'));
const Courses = lazy(() => import('../pages/user/Courses'));
const Pulse = lazy(() => import('../pages/user/Pulse'));
const Wiki = lazy(() => import('../pages/user/Wiki'));
const DeskBooking = lazy(() => import('../pages/user/DeskBooking'));
const Attendance = lazy(() => import('../pages/user/Attendance'));
const Gamification = lazy(() => import('../pages/user/Gamification'));
const ExitInterview = lazy(() => import('../pages/public/ExitInterview'));

const AdminUsers = lazy(() => import('../pages/admin/Users'));
const AdminRoles = lazy(() => import('../pages/admin/Roles'));
const AdminDepartmentsSubdivisions = lazy(() => import('../pages/admin/DepartmentsSubdivisions'));
const AdminContent = lazy(() => import('../pages/admin/Content'));
const AdminOnboarding = lazy(() => import('../pages/admin/Onboarding'));
const AdminSchedules = lazy(() => import('../pages/admin/Schedules'));
const AdminFeedback = lazy(() => import('../pages/admin/Feedback'));
const AdminSystem = lazy(() => import('../pages/admin/System'));
const AdminInterface = lazy(() => import('../pages/admin/Interface'));
const AttendanceMarks = lazy(() => import('../pages/admin/AttendanceMarks'));
const AdminInterns = lazy(() => import('../pages/admin/Interns'));

const CONTENT_MANAGE_ROLES = ['administrator', 'superadmin', 'systemadmin'];

function RouteLoader() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      color: '#334155',
      fontFamily: 'inherit',
    }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Загрузка страницы...</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>Подготавливаем интерфейс</div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
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
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function TrueSuperAdminRoute({ children }) {
  const { user, isSuperAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function OnboardingManageRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const allowed = ['admin', 'administrator', 'superadmin', 'systemadmin'];
  if (!hasAnyRole(user.role, allowed)) return <Navigate to="/dashboard" replace />;
  return children;
}

function InternsManageRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasAnyRole(user.role, ['admin', 'administrator', 'superadmin', 'systemadmin'])) {
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

function SalaryRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (['teamlead', 'projectmanager'].includes(String(user.role || '').toLowerCase())) {
    return <Navigate to="/dashboard" replace />;
  }
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
  if (!hasAnyRole(user.role, [...TEAM_MANAGER_ROLES, ...DEPARTMENT_HEAD_ROLES, ...ADMINISTRATOR_ROLES, 'superadmin'])) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function RolesRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasAnyRole(user.role, ['superadmin'])) return <Navigate to="/dashboard" replace />;
  return children;
}

function DepartmentsAdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasAnyRole(user.role, ['administrator', 'superadmin', 'systemadmin'])) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user } = useAuth();
  if (!user) return children;
  if (hasAnyRole(user.role, ADMIN_LIKE_ROLES)) return <Navigate to="/dashboard" replace />;
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
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
        <Route path="/reset-password" element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />

        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
        <Route path="/regulations" element={<NonInternRoute><Regulations /></NonInternRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/instructions" element={<PrivateRoute><Instructions /></PrivateRoute>} />
        <Route path="/company" element={<CompanyRoute><Company /></CompanyRoute>} />
        <Route path="/lessons" element={<PrivateRoute><Lessons /></PrivateRoute>} />
        <Route path="/courses" element={<PrivateRoute><Courses /></PrivateRoute>} />
        <Route path="/tasks" element={<TasksRoute><Tasks /></TasksRoute>} />
        <Route path="/pulse" element={<PrivateRoute><Pulse /></PrivateRoute>} />
        <Route path="/wiki" element={<PrivateRoute><Wiki /></PrivateRoute>} />
        <Route path="/salary" element={<SalaryRoute><Salary /></SalaryRoute>} />
        <Route path="/desk-booking" element={<NonInternRoute><DeskBooking /></NonInternRoute>} />
        <Route path="/attendance" element={<NonInternRoute><Attendance /></NonInternRoute>} />
        <Route path="/gamification" element={<PrivateRoute><Gamification /></PrivateRoute>} />
        <Route path="/exit-interview/:token" element={<ExitInterview />} />
        <Route path="/attendance-marks" element={<AttendanceMarksRoute><AttendanceMarks /></AttendanceMarksRoute>} />

        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/roles" element={<RolesRoute><AdminRoles /></RolesRoute>} />
        <Route path="/admin/departments-subdivisions" element={<DepartmentsAdminRoute><AdminDepartmentsSubdivisions /></DepartmentsAdminRoute>} />
        <Route path="/admin/content" element={<ContentManageRoute><AdminContent /></ContentManageRoute>} />
        <Route path="/admin/onboarding" element={<OnboardingManageRoute><AdminOnboarding /></OnboardingManageRoute>} />
        <Route path="/admin/interns" element={<InternsManageRoute><AdminInterns /></InternsManageRoute>} />
        <Route path="/admin/schedules" element={<AdminRoute><AdminSchedules /></AdminRoute>} />
        <Route path="/admin/feedback" element={<AdminRoute><AdminFeedback /></AdminRoute>} />
        <Route path="/admin/system" element={<TrueSuperAdminRoute><AdminSystem /></TrueSuperAdminRoute>} />
        <Route path="/admin/interface" element={<TrueSuperAdminRoute><AdminInterface /></TrueSuperAdminRoute>} />

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  );
}
