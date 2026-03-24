import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  Home,
  BookOpen,
  Calendar,
  BookMarked,
  Users,
  Shield,
  FileText,
  LayoutGrid,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  MessageSquare,
  CheckSquare,
  Wallet,
  MapPin,
  Activity,
  Flame,
  Monitor,
  ClipboardList,
} from 'lucide-react';

const NAV_INTERN = [
  { label: 'Главная', icon: Home, path: '/dashboard' },
  { label: 'Онбординг', icon: GraduationCap, path: '/onboarding' },
  { label: 'Материалы', icon: BookOpen, path: '/lessons' },
  { label: 'Курсы', icon: BookOpen, path: '/courses' },
  { label: 'Мои задачи', icon: CheckSquare, path: '/tasks' },
  { label: 'База знаний', icon: FileText, path: '/wiki' },
  { label: 'Трекер настроения', icon: Activity, path: '/pulse' },
  { label: 'Активность', icon: Flame, path: '/gamification' },
  { label: 'Зарплата', icon: Wallet, path: '/salary' },
];

const NAV_EMPLOYEE = [
  { label: 'Главная', icon: Home, path: '/dashboard' },
  { label: 'Мои задачи', icon: CheckSquare, path: '/tasks' },
  { label: 'Трекер настроения', icon: Activity, path: '/pulse' },
  { label: 'Активность', icon: Flame, path: '/gamification' },
  { label: 'База знаний', icon: FileText, path: '/wiki' },
  { label: 'Материалы', icon: BookOpen, path: '/lessons' },
  { label: 'Курсы', icon: BookOpen, path: '/courses' },
  { label: 'Зарплата', icon: Wallet, path: '/salary' },
  { label: 'Посещаемость', icon: ClipboardList, path: '/attendance' },
  { label: 'Бронирование мест', icon: Monitor, path: '/desk-booking' },
  { label: 'Компания', icon: Users, path: '/company' },
  { label: 'Регламенты', icon: BookMarked, path: '/regulations' },
  { label: 'Инструкция', icon: BookOpen, path: '/instructions' },
];

const NAV_PM = [
  { label: 'Главная', icon: Home, path: '/dashboard' },
  { label: 'Задачи команды', icon: CheckSquare, path: '/tasks' },
  { label: 'Трекер настроения', icon: Activity, path: '/pulse' },
  { label: 'Активность', icon: Flame, path: '/gamification' },
  { label: 'База знаний', icon: FileText, path: '/wiki' },
  { label: 'Отметки сотрудников', icon: CheckSquare, path: '/attendance-marks' },
  { label: 'Посещаемость', icon: ClipboardList, path: '/attendance' },
  { label: 'Материалы', icon: BookOpen, path: '/lessons' },
  { label: 'Курсы', icon: BookOpen, path: '/courses' },
  { label: 'Компания', icon: Users, path: '/company' },
  { label: 'Регламенты', icon: BookMarked, path: '/regulations' },
  { label: 'Инструкция', icon: BookOpen, path: '/instructions' },
];

const NAV_TEAMLEAD = [...NAV_PM];

const NAV_DEPARTMENT_HEAD = [
  { section: 'МОИ РАЗДЕЛЫ' },
  { label: 'Главная', icon: Home, path: '/dashboard' },
  { label: 'Задачи', icon: CheckSquare, path: '/tasks' },
  { label: 'Трекер настроения', icon: Activity, path: '/pulse' },
  { label: 'База знаний', icon: FileText, path: '/wiki' },
  { label: 'Материалы', icon: BookOpen, path: '/lessons' },
  { label: 'Курсы', icon: BookOpen, path: '/courses' },
  { label: 'Посещаемость', icon: ClipboardList, path: '/attendance' },
  { label: 'Бронирование мест', icon: Monitor, path: '/desk-booking' },
  { label: 'Компания', icon: Users, path: '/company' },
  { label: 'Регламенты', icon: BookMarked, path: '/regulations' },
  { label: 'Зарплата', icon: Wallet, path: '/salary' },
  { section: 'УПРАВЛЕНИЕ' },
  { label: 'Пользователи', icon: Users, path: '/admin/users' },
  { label: 'Стажеры', icon: GraduationCap, path: '/admin/interns' },
  { label: 'Онбординг / Отчёты', icon: GraduationCap, path: '/admin/onboarding' },
  { label: 'График работы сотрудников', icon: Calendar, path: '/admin/schedules' },
  { label: 'Отметки сотрудников', icon: CheckSquare, path: '/attendance-marks' },
  { label: 'Обратная связь', icon: MessageSquare, path: '/admin/feedback' },
];

const NAV_ADMIN = [
  { section: 'МОИ РАЗДЕЛЫ' },
  { label: 'Главная', icon: Home, path: '/dashboard' },
  { label: 'Задачи', icon: CheckSquare, path: '/tasks' },
  { label: 'Трекер настроения', icon: Activity, path: '/pulse' },
  { label: 'База знаний', icon: FileText, path: '/wiki' },
  { label: 'Материалы', icon: BookOpen, path: '/lessons' },
  { label: 'Курсы', icon: BookOpen, path: '/courses' },
  { label: 'Посещаемость', icon: ClipboardList, path: '/attendance' },
  { label: 'Бронирование мест', icon: Monitor, path: '/desk-booking' },
  { label: 'Компания', icon: Users, path: '/company' },
  { label: 'Регламенты', icon: BookMarked, path: '/regulations' },
  { label: 'Зарплата', icon: Wallet, path: '/salary' },
  { section: 'УПРАВЛЕНИЕ' },
  { label: 'Пользователи', icon: Users, path: '/admin/users' },
  { label: 'График работы сотрудников', icon: Calendar, path: '/admin/schedules' },
  { label: 'Отметки сотрудников', icon: CheckSquare, path: '/attendance-marks' },
  { label: 'Обратная связь', icon: MessageSquare, path: '/admin/feedback' },
];

const NAV_SUPERADMIN = [
  { section: 'МОИ РАЗДЕЛЫ' },
  { label: 'Главная', icon: Home, path: '/dashboard' },
  { label: 'Трекер настроения', icon: Activity, path: '/pulse' },
  { label: 'База знаний', icon: FileText, path: '/wiki' },
  { label: 'Посещаемость', icon: ClipboardList, path: '/attendance' },
  { label: 'Бронирование мест', icon: Monitor, path: '/desk-booking' },
  { label: 'Компания', icon: Users, path: '/company' },
  { section: 'УПРАВЛЕНИЕ' },
  { label: 'Пользователи', icon: Users, path: '/admin/users' },
  { label: 'Роли и права', icon: Shield, path: '/admin/roles' },
  { label: 'Стажеры', icon: GraduationCap, path: '/admin/interns' },
  { label: 'Онбординг', icon: GraduationCap, path: '/admin/onboarding' },
  { label: 'Отделы и подотделы', icon: LayoutGrid, path: '/admin/departments-subdivisions' },
  { label: 'Зарплаты', icon: Wallet, path: '/salary' },
  { label: 'Контент', icon: FileText, path: '/admin/content' },
  { label: 'График работы сотрудников', icon: Calendar, path: '/admin/schedules' },
  { label: 'Отметки сотрудников', icon: CheckSquare, path: '/attendance-marks' },
  { label: 'Обратная связь', icon: MessageSquare, path: '/admin/feedback' },
  { section: 'СИСТЕМА' },
  { label: 'Система / Безопасность', icon: Settings, path: '/admin/system' },
  { label: 'Интерфейс', icon: LayoutGrid, path: '/admin/interface' },
];

const NAV_ADMINISTRATOR = [
  { section: 'МОИ РАЗДЕЛЫ' },
  { label: 'Главная', icon: Home, path: '/dashboard' },
  { label: 'Трекер настроения', icon: Activity, path: '/pulse' },
  { label: 'База знаний', icon: FileText, path: '/wiki' },
  { label: 'Компания', icon: Users, path: '/company' },
  { label: 'Зарплата', icon: Wallet, path: '/salary' },
  { section: 'УПРАВЛЕНИЕ' },
  { label: 'Пользователи', icon: Users, path: '/admin/users' },
  { label: 'Стажеры', icon: GraduationCap, path: '/admin/interns' },
  { label: 'Онбординг', icon: GraduationCap, path: '/admin/onboarding' },
  { label: 'Отделы и подотделы', icon: LayoutGrid, path: '/admin/departments-subdivisions' },
  { label: 'Контент', icon: FileText, path: '/admin/content' },
  { label: 'График работы сотрудников', icon: Calendar, path: '/admin/schedules' },
  { label: 'Отметки сотрудников', icon: CheckSquare, path: '/attendance-marks' },
  { label: 'Обратная связь', icon: MessageSquare, path: '/admin/feedback' },
];

const NAV_MAP = {
  intern: NAV_INTERN,
  employee: NAV_EMPLOYEE,
  projectmanager: NAV_PM,
  teamlead: NAV_TEAMLEAD,
  department_head: NAV_DEPARTMENT_HEAD,
  admin: NAV_ADMIN,
  administrator: NAV_ADMINISTRATOR,
  systemadmin: NAV_ADMINISTRATOR,
  superadmin: NAV_SUPERADMIN,
};

export default function Sidebar() {
  const { user } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const baseNav = NAV_MAP[user?.role] || NAV_INTERN;
  const nav = baseNav;

  const handleHome = () => {
    navigate('/dashboard');
  };

  const translateNav = (label) => {
    const map = {
      'Главная': 'sidebar.home',
      'Задачи': 'sidebar.tasks',
      'Мои задачи': 'sidebar.myTasks',
      'Задачи команды': 'sidebar.teamTasks',
      'Зарплата': 'sidebar.salary',
      'Компания': 'sidebar.company',
      'Регламенты': 'sidebar.regulations',
      'График работы': 'sidebar.schedule',
      'Инструкция': 'sidebar.instructions',
      'Материалы': 'sidebar.lessons',
      'Курсы': 'sidebar.courses',
      'Ресурсы': 'sidebar.resources',
      'Обзор': 'sidebar.overview',
      'Пользователи': 'sidebar.users',
      'Роли и права': 'sidebar.roles',
      'Стажеры': 'sidebar.interns',
      'Отделы и подотделы': 'sidebar.departmentsSubdivisions',
      'Контент': 'sidebar.content',
      'Онбординг': 'sidebar.onboarding',
      'Онбординг / Отчёты': 'sidebar.onboarding',
      'График работы сотрудников': 'sidebar.workSchedules',
      'Отметки сотрудников': 'sidebar.attendanceMarks',
      'Обратная связь': 'sidebar.feedback',
      'Трекер настроения': 'sidebar.pulse',
      'Активность': 'sidebar.gamification',
      'База знаний': 'sidebar.wiki',
      'Система / Безопасность': 'sidebar.systemSecurity',
      'Интерфейс': 'sidebar.interface',
    };
    return t(map[label] || '', label);
  };

  const translateSection = (section) => {
    if (section === 'МОИ РАЗДЕЛЫ') return t('sidebar.section.my', section);
    if (section === 'УПРАВЛЕНИЕ') return t('sidebar.section.manage', section);
    if (section === 'СИСТЕМА') return t('sidebar.section.system', section);
    return section;
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo" style={{ cursor: 'pointer' }} onClick={handleHome}>
        <div className="sidebar-logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        {!collapsed && <span className="sidebar-logo-text">В Плюсе</span>}
      </div>

      <nav className="sidebar-nav">
        {nav.map((item, i) => {
          if (item.section) {
            if (collapsed) return null;
            return <div key={i} className="nav-section-label">{translateSection(item.section)}</div>;
          }

          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/dashboard' && item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <div
              key={item.path + item.label}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? translateNav(item.label) : ''}
            >
              <Icon className="nav-item-icon" size={17} />
              {!collapsed && <span className="nav-item-label">{translateNav(item.label)}</span>}
            </div>
          );
        })}

      </nav>

      <div className="sidebar-footer">
        <button className="collapse-btn" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span>{t('sidebar.collapse', 'Свернуть меню')}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
