import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { normalizeRole, isAdminRole } from '../../utils/roles';
import {
  Home, BookOpen, Calendar, BookMarked,
  Users, Shield, FileText, ClipboardCheck,
  LayoutGrid, Settings, ChevronLeft, ChevronRight,
  MessageSquare, CheckSquare, Wallet,
} from 'lucide-react';

const NAV_INTERN = [
  { label: 'Главная', key: 'sidebar.home', icon: Home, path: '/dashboard' },
  { label: 'Регламенты', key: 'sidebar.regulations', icon: BookMarked, path: '/regulations' },
  { label: 'График работы', key: 'sidebar.schedule', icon: Calendar, path: '/schedule' },
  { label: 'Инструкция', key: 'sidebar.instructions', icon: BookOpen, path: '/instructions' },
];

const NAV_EMPLOYEE = [
  { label: 'Главная', key: 'sidebar.home', icon: Home, path: '/dashboard' },
  { label: 'Компания', key: 'sidebar.company', icon: Users, path: '/company' },
  { label: 'Регламенты', key: 'sidebar.regulations', icon: BookMarked, path: '/regulations' },
  { label: 'График работы', key: 'sidebar.schedule', icon: Calendar, path: '/schedule' },
  { label: 'Инструкция', key: 'sidebar.instructions', icon: BookOpen, path: '/instructions' },
];

const NAV_PM = [
  { label: 'Главная', key: 'sidebar.home', icon: Home, path: '/dashboard' },
  { label: 'Моя команда', key: 'sidebar.team', icon: Users, path: '/team' },
  { label: 'Зарплата', key: 'sidebar.salary', icon: Wallet, path: '/salary' },
  { label: 'Компания', key: 'sidebar.company', icon: Users, path: '/company' },
  { label: 'Регламенты', key: 'sidebar.regulations', icon: BookMarked, path: '/regulations' },
  { label: 'График работы', key: 'sidebar.schedule', icon: Calendar, path: '/schedule' },
  { label: 'Инструкция', key: 'sidebar.instructions', icon: BookOpen, path: '/instructions' },
];

const NAV_ADMIN = [
  { section: 'МОИ РАЗДЕЛЫ', sectionKey: 'sidebar.section.my' },
  { label: 'Главная', key: 'sidebar.home', icon: Home, path: '/dashboard' },
  { label: 'Моя команда', key: 'sidebar.team', icon: Users, path: '/team' },
  { label: 'Задачи', key: 'sidebar.tasks', icon: CheckSquare, path: '/tasks' },
  { label: 'Посещаемость', key: 'sidebar.attendance', icon: ClipboardCheck, path: '/attendance' },
  { label: 'Компания', key: 'sidebar.company', icon: Users, path: '/company' },
  { label: 'График работы', key: 'sidebar.schedule', icon: Calendar, path: '/schedule' },
  { label: 'Регламенты', key: 'sidebar.regulations', icon: BookMarked, path: '/regulations' },
  { label: 'Зарплата', key: 'sidebar.salary', icon: Wallet, path: '/salary' },

  { section: 'УПРАВЛЕНИЕ', sectionKey: 'sidebar.section.manage' },
  { label: 'Обзор', key: 'sidebar.overview', icon: LayoutGrid, path: '/admin/overview' },
  { label: 'Пользователи', key: 'sidebar.users', icon: Users, path: '/admin/users' },
  { label: 'Контент', key: 'sidebar.content', icon: FileText, path: '/admin/content' },
  { label: 'Графики работы', key: 'sidebar.workSchedules', icon: Calendar, path: '/admin/schedules' },
  { label: 'Обратная связь', key: 'sidebar.feedback', icon: MessageSquare, path: '/admin/feedback' },
];

const NAV_SUPERADMIN = [
  { section: 'МОИ РАЗДЕЛЫ', sectionKey: 'sidebar.section.my' },
  { label: 'Главная', key: 'sidebar.home', icon: Home, path: '/dashboard' },
  { label: 'Моя команда', key: 'sidebar.team', icon: Users, path: '/team' },
  { label: 'Задачи', key: 'sidebar.tasks', icon: CheckSquare, path: '/tasks' },
  { label: 'Посещаемость', key: 'sidebar.attendance', icon: ClipboardCheck, path: '/attendance' },
  { label: 'Компания', key: 'sidebar.company', icon: Users, path: '/company' },
  { label: 'График работы', key: 'sidebar.schedule', icon: Calendar, path: '/schedule' },

  { section: 'УПРАВЛЕНИЕ', sectionKey: 'sidebar.section.manage' },
  { label: 'Обзор', key: 'sidebar.overview', icon: LayoutGrid, path: '/admin/overview' },
  { label: 'Пользователи', key: 'sidebar.users', icon: Users, path: '/admin/users' },
  { label: 'Роли и права', key: 'sidebar.roles', icon: Shield, path: '/admin/roles' },
  { label: 'Зарплата', key: 'sidebar.salary', icon: Wallet, path: '/salary' },
  { label: 'Контент', key: 'sidebar.content', icon: FileText, path: '/admin/content' },
  { label: 'Графики работы', key: 'sidebar.workSchedules', icon: Calendar, path: '/admin/schedules' },
  { label: 'Обратная связь', key: 'sidebar.feedback', icon: MessageSquare, path: '/admin/feedback' },

  { section: 'СИСТЕМА', sectionKey: 'sidebar.section.system' },
  { label: 'Система / Безопасность', key: 'sidebar.systemSecurity', icon: Settings, path: '/admin/system' },
  { label: 'Интерфейс', key: 'sidebar.interface', icon: LayoutGrid, path: '/admin/interface' },
];

const NAV_MAP = {
  intern: NAV_INTERN,
  employee: NAV_EMPLOYEE,
  projectmanager: NAV_PM,
  admin: NAV_ADMIN,
  administrator: NAV_ADMIN,
  systemadmin: NAV_ADMIN,
  superadmin: NAV_SUPERADMIN,
};

export default function Sidebar() {
  const { user } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [hideMenuPanelOpen, setHideMenuPanelOpen] = useState(false);

  const normalizedRole = normalizeRole(user?.role);
  const canCustomizeHide =
    normalizedRole === 'admin' ||
    normalizedRole === 'administrator' ||
    normalizedRole === 'projectmanager' ||
    normalizedRole === 'employee';

  const baseNavRaw = NAV_MAP[normalizedRole] || NAV_INTERN;
  const canViewAttendance =
    normalizedRole === 'admin' ||
    normalizedRole === 'administrator' ||
    normalizedRole === 'superadmin';

  const baseNav = baseNavRaw.filter((item) => {
    if (!item.path) return true;
    if (item.path === '/attendance' && !canViewAttendance) return false;
    return true;
  });

  const nav = canCustomizeHide
    ? baseNav.filter((item) => item.path !== '/regulations' && item.path !== '/instructions')
    : baseNav;

  const handleHome = () => {
    if (isAdminRole(user?.role)) navigate('/admin/overview');
    else navigate('/dashboard');
  };

  const translateNav = (item) => t(item.key || '', item.label);
  const translateSection = (item) => t(item.sectionKey || '', item.section);

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
            return <div key={i} className="nav-section-label">{translateSection(item)}</div>;
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
              title={collapsed ? translateNav(item) : ''}
            >
              <Icon className="nav-item-icon" size={17} />
              {!collapsed && <span className="nav-item-label">{translateNav(item)}</span>}
            </div>
          );
        })}

        {canCustomizeHide && !collapsed && (
          <>
            <div className="nav-section-label">{t('sidebar.hideSection', 'СКРЫТИЕ РАЗДЕЛОВ')}</div>
            <div
              className="nav-item"
              onClick={() => setHideMenuPanelOpen((v) => !v)}
              title={t('sidebar.hideToggleTitle', 'Свернуть/развернуть блок скрытия')}
            >
              {hideMenuPanelOpen ? <ChevronLeft className="nav-item-icon" size={17} /> : <ChevronRight className="nav-item-icon" size={17} />}
              <span className="nav-item-label">{t('sidebar.hideToggle', 'Скрыть разделы')}</span>
            </div>

            {hideMenuPanelOpen && (
              <>
                <div className="nav-item" onClick={() => navigate('/regulations')} title={t('sidebar.openRegulations', 'Открыть Регламенты')}>
                  <BookMarked className="nav-item-icon" size={17} />
                  <span className="nav-item-label">{t('sidebar.regulations', 'Регламенты')}</span>
                </div>
                <div className="nav-item" onClick={() => navigate('/instructions')} title={t('sidebar.openInstructions', 'Открыть Инструкция')}>
                  <BookOpen className="nav-item-icon" size={17} />
                  <span className="nav-item-label">{t('sidebar.instructions', 'Инструкция')}</span>
                </div>
              </>
            )}
          </>
        )}
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
