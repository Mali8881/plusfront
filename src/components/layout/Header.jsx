import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, ChevronDown, GraduationCap, Info, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { dispatchToast } from '../../context/ToastContext';
import { feedbackAPI, notificationsAPI } from '../../api/content';
import { mapNotification } from '../../utils/notificationI18n';

const ROLE_COLORS = {
  intern: '#2563EB',
  employee: '#16A34A',
  teamlead: '#7C3AED',
  projectmanager: '#7C3AED',
  department_head: '#EA580C',
  admin: '#EA580C',
  administrator: '#0284C7',
  superadmin: '#BE123C',
};
const FEEDBACK_RECEIVER_ROLES = new Set(['admin', 'department_head', 'administrator', 'superadmin']);

function getNotifIcon(type, severity) {
  const ty = String(type || '').toLowerCase();
  const sv = String(severity || '').toLowerCase();
  if (ty === 'learning') return <GraduationCap size={14} color="#7C3AED" />;
  if (sv === 'critical') return <AlertTriangle size={14} color="var(--danger)" />;
  if (sv === 'warning' || ty === 'system') return <AlertTriangle size={14} color="var(--warning)" />;
  return <Info size={14} color="var(--primary)" />;
}

function dedupeNotifications(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.code || 'unknown'}:${String(item.message || '')}:${String(item.created_at || '')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

export default function Header({ title }) {
  const { user, logout } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const navigate = useNavigate();
  const [dropOpen, setDropOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadRef = useRef(0);

  const initials = user?.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '??';
  const roleColor = ROLE_COLORS[user?.role] || '#2563EB';
  const firstName = user?.name?.split(' ')[0] || '';
  const dateLocale = locale === 'kg' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU';

  const refreshNotifications = async () => {
    if (!user?.id) return;
    try {
      const role = String(user?.role || '').toLowerCase();
      const isFeedbackReceiver = FEEDBACK_RECEIVER_ROLES.has(role);

      const [notificationsRes, feedbackRes] = await Promise.all([
        notificationsAPI.list().catch(() => ({ data: { items: [], unread_count: 0 } })),
        isFeedbackReceiver ? feedbackAPI.list().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);

      const apiItems = Array.isArray(notificationsRes?.data?.items) ? notificationsRes.data.items : [];
      let mapped = apiItems.map((item) => mapNotification(item, t));
      const hasFeedbackFromBackend = mapped.some((item) => item.code === 'feedback_ticket');

      if (isFeedbackReceiver && !hasFeedbackFromBackend) {
        const feedbackRows = Array.isArray(feedbackRes?.data) ? feedbackRes.data : [];
        const feedbackNotifications = feedbackRows
          .filter((row) => String(row?.status || '').toLowerCase() === 'new')
          .map((row) =>
            mapNotification(
              {
                id: `feedback-ticket:${row.id}`,
                code: 'feedback_ticket',
                message: row?.text || '',
                created_at: row?.created_at || '',
                payload: { ticket_id: row?.id },
              },
              t
            )
          );
        mapped = dedupeNotifications([...feedbackNotifications, ...mapped]);
      }

      const newCount = Number(notificationsRes?.data?.unread_count || 0);

      // Toast when new notifications arrive while the panel is closed
      if (!notifOpen && newCount > prevUnreadRef.current && prevUnreadRef.current !== 0) {
        const newest = mapped.find((n) => !n.raw?.is_read);
        if (newest) {
          dispatchToast(newest.title, 'info', 5000);
        }
      }
      prevUnreadRef.current = newCount;

      setNotifs(mapped);
      setUnreadCount(newCount);
    } catch {
      setNotifs([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    refreshNotifications();
    const i = setInterval(() => { refreshNotifications(); }, 10000);
    return () => clearInterval(i);
  }, [user?.id, user?.role, t]);

  const readAllNotifications = async () => {
    if (!user?.id) return;
    try {
      await notificationsAPI.markAllRead();
      await refreshNotifications();
    } catch {
      // ignore UI error to keep header lightweight
    }
  };

  const handleNotifClick = async (n) => {
    // Mark as read
    const rawId = n.raw?.id;
    if (rawId && !n.raw?.is_read) {
      notificationsAPI.markRead(rawId).catch(() => {});
    }

    const url = String(n.action_url || '').trim();
    if (url) {
      setNotifOpen(false);
      if (isAbsoluteUrl(url)) window.open(url, '_blank', 'noopener,noreferrer');
      else navigate(url);
      return;
    }
    if (n.code === 'feedback_ticket') {
      setNotifOpen(false);
      navigate('/admin/feedback');
    }
  };

  return (
    <header className="header">
      <div className="header-title">{title || ''}</div>
      <div style={{ flex: 1, paddingLeft: 20, fontSize: 14, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {t('header.welcome', 'Добро пожаловать')}, <b style={{ color: 'var(--gray-800)' }}>{firstName}!</b>
      </div>
      <div className="header-lang" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {['ru', 'en', 'kg'].map((code, idx) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              color: locale === code ? 'var(--primary)' : 'var(--gray-500)',
              fontWeight: locale === code ? 700 : 500,
              fontSize: 14,
            }}
          >
            {t(`lang.${code}`, code.toUpperCase())}
            {idx < 2 ? ' /' : ''}
          </button>
        ))}
      </div>

      {/* Notification Bell */}
      <div
        className="header-notif"
        style={{ position: 'relative', cursor: 'pointer' }}
        onClick={() => { setNotifOpen((o) => !o); refreshNotifications(); }}
      >
        <Bell size={18} color="var(--gray-500)" />
        {unreadCount > 0 && <div className="header-notif-badge" />}

        {notifOpen && (
          <div
            style={{ position: 'absolute', top: '100%', right: -20, marginTop: 8, width: 360, maxWidth: 'calc(100vw - 24px)', background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 120 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {t('header.notifications', 'Уведомления')}
                {unreadCount > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, background: 'var(--primary)', color: '#fff', borderRadius: 10, padding: '1px 6px' }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); readAllNotifications(); }}>
                {t('notifications.markRead', 'Прочитать всё')}
              </button>
            </div>

            <div style={{ maxHeight: 360, overflow: 'auto', padding: 8 }}>
              {notifs.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--gray-500)', padding: 8 }}>
                  {t('notifications.empty', 'Новых событий нет.')}
                </div>
              )}
              {notifs.map((n) => {
                const isUnread = !n.raw?.is_read;
                const isPinned = n.raw?.is_pinned;
                return (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      padding: '8px 10px',
                      borderBottom: '1px solid var(--gray-100)',
                      borderRadius: 6,
                      cursor: n.action_url || n.code === 'feedback_ticket' ? 'pointer' : 'default',
                      background: isUnread ? 'var(--gray-50)' : 'transparent',
                      borderLeft: isPinned ? '3px solid var(--primary)' : '3px solid transparent',
                    }}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      {getNotifIcon(n.raw?.type, n.raw?.severity)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: isUnread ? 700 : 600, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {n.title}
                        {isUnread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, display: 'inline-block' }} />}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 2 }}>{n.message}</div>
                      {n.created_at && (
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>
                          {new Date(n.created_at).toLocaleString(dateLocale)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* User Dropdown */}
      <div className="header-user" onClick={() => setDropOpen((o) => !o)} style={{ position: 'relative' }}>
        <div className="header-user-info">
          <div className="header-user-name">{user?.name?.split(' ').slice(0, 2).join(' ')}</div>
          <div className="header-user-role">{user?.roleLabel}</div>
        </div>
        <div className="avatar" style={{ width: 36, height: 36, background: roleColor }}>{initials}</div>
        <ChevronDown size={14} color="var(--gray-500)" />

        {dropOpen && (
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', minWidth: 210, zIndex: 100, padding: '4px 0' }}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0 }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{user?.position}</div>
                  <div style={{ fontSize: 11, marginTop: 2, display: 'inline-block', padding: '1px 6px', borderRadius: 10, background: roleColor + '20', color: roleColor, fontWeight: 600 }}>{user?.roleLabel}</div>
                </div>
              </div>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', fontSize: 14, color: 'var(--gray-700)' }}
              onClick={() => { navigate('/profile'); setDropOpen(false); }}
            >
              <User size={15} /> {t('header.profile', 'Профиль')}
            </div>
            <div style={{ height: 1, background: 'var(--gray-200)', margin: '4px 0' }} />
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', fontSize: 14, color: 'var(--danger)' }}
              onClick={() => { logout(); navigate('/login'); }}
            >
              <LogOut size={15} /> {t('header.logout', 'Выйти')}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
