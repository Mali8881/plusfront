import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import MainLayout from '../../layouts/MainLayout';
import { X } from 'lucide-react';
import { feedbackAPI, newsAPI } from '../../api/content';
import { usersAPI } from '../../api/auth';
import { buildFeedbackCreatePayload, FEEDBACK_TYPE_CODES, FEEDBACK_TYPE_OPTIONS } from '../../utils/feedback';
import { normalizeRole } from '../../utils/roles';

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function normalizeNews(raw = {}) {
  return {
    id: raw.id,
    title: raw.title || raw.name || 'Без названия',
    text: raw.text || raw.description || '',
    category: raw.category || raw.type || 'Новости',
    date: raw.published_at
      ? new Date(raw.published_at).toLocaleDateString('ru-RU')
      : raw.created_at
      ? new Date(raw.created_at).toLocaleDateString('ru-RU')
      : raw.date || '—',
    img: raw.image || raw.cover || raw.image_url || '',
  };
}

function normalizeOrgMember(raw = {}, departmentName = '') {
  const role = normalizeRole(raw.role || raw.user_role || raw.role_code || raw.account?.role || 'employee');
  const fullName =
    raw.full_name ||
    [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() ||
    raw.name ||
    raw.username ||
    raw.email ||
    `Пользователь #${raw.id}`;
  return {
    id: raw.id,
    name: fullName,
    role,
    position: raw.position_name || raw.position || 'Сотрудник',
    department: raw.department_name || raw.department || departmentName || '',
    managerId: raw.manager_id || raw.lead_id || raw.supervisor_id || null,
  };
}

const BANNERS = {
  intern: {
    title: 'Добро пожаловать в команду!',
    sub: 'Пройди онбординг, изучи регламенты и стань частью компании «В Плюсе».',
    action: 'Перейти к онбордингу',
    path: '/onboarding',
    bg: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
  },
  employee: {
    title: 'С возвращением!',
    sub: 'Ваши задачи, регламенты и график работы — всё здесь.',
    action: 'Мой профиль',
    path: '/profile',
    bg: 'linear-gradient(135deg, #16A34A 0%, #2563EB 100%)',
  },
  projectmanager: {
    title: 'Панель проектов',
    sub: 'Контролируйте прогресс проектов и статусы задач команды.',
    action: 'Открыть проекты',
    path: '/tasks',
    bg: 'linear-gradient(135deg, #7C3AED 0%, #EA580C 100%)',
  },
  admin: {
    title: 'Административная панель',
    sub: 'Управление контентом, пользователями и онбордингом.',
    action: 'Перейти в панель',
    path: '/admin/overview',
    bg: 'linear-gradient(135deg, #EA580C 0%, #D97706 100%)',
  },
  systemadmin: {
    title: 'Системная панель',
    sub: 'Контроль инфраструктуры, прав доступа и стабильности системы.',
    action: 'Перейти в панель',
    path: '/admin/overview',
    bg: 'linear-gradient(135deg, #0F766E 0%, #2563EB 100%)',
  },
  superadmin: {
    title: 'Полный контроль системы',
    sub: 'Роли, права, система и безопасность платформы.',
    action: 'Перейти в панель',
    path: '/admin/overview',
    bg: 'linear-gradient(135deg, #BE123C 0%, #EA580C 100%)',
  },
};

const QUICK_STATS = {
  intern: [
    { icon: '📋', label: 'День онбординга', value: '1 / 5', color: '#EFF6FF' },
    { icon: '📄', label: 'Регламентов', value: '6', color: '#F0FDF4' },
    { icon: '📊', label: 'Отчетов отправлено', value: '0', color: '#FAF5FF' },
  ],
  employee: [
    { icon: '✅', label: 'Задач выполнено', value: '12', color: '#F0FDF4' },
    { icon: '📅', label: 'Рабочих дней в месяце', value: '20', color: '#EFF6FF' },
    { icon: '📄', label: 'Регламентов', value: '6', color: '#FFF7ED' },
  ],
  projectmanager: [
    { icon: '👥', label: 'Подчиненных', value: '2', color: '#FAF5FF' },
    { icon: '✅', label: 'Задач команды', value: '9', color: '#F0FDF4' },
    { icon: '⚠️', label: 'Просрочено', value: '2', color: '#FFF1F2' },
  ],
  admin: [
    { icon: '👤', label: 'Пользователей', value: '42', color: '#EFF6FF' },
    { icon: '🎓', label: 'Стажеров', value: '28', color: '#F0FDF4' },
    { icon: '📬', label: 'Обращений', value: '3', color: '#FFF7ED' },
  ],
  systemadmin: [
    { icon: '🛠️', label: 'Сервисов', value: '8', color: '#EFF6FF' },
    { icon: '🔐', label: 'Политик доступа', value: '14', color: '#F0FDF4' },
    { icon: '📬', label: 'Инцидентов', value: '1', color: '#FFF7ED' },
  ],
  superadmin: [
    { icon: '👤', label: 'Пользователей', value: '42', color: '#EFF6FF' },
    { icon: '🛡️', label: 'Администраторов', value: '5', color: '#FFF7ED' },
    { icon: '🔒', label: 'Заблокировано', value: '1', color: '#FFF1F2' },
  ],
};

export default function Dashboard() {
  const { user } = useAuth();
  const { t, tr } = useLocale();
  const navigate = useNavigate();
  const [selectedNews, setSelectedNews] = useState(null);
  const [fbType, setFbType] = useState(FEEDBACK_TYPE_CODES.suggestion);
  const [fbText, setFbText] = useState('');
  const [fbMode, setFbMode] = useState('named');
  const [fbMsg, setFbMsg] = useState('');
  const canSendFeedback = !['intern', 'admin', 'administrator', 'superadmin'].includes(String(user?.role || '').toLowerCase());

  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [orgTeam, setOrgTeam] = useState([]);

  useEffect(() => {
    const loadNews = async () => {
      setNewsLoading(true);
      try {
        const res = await newsAPI.list();
        setNews(safeList(res.data).map(normalizeNews));
      } catch {
        setNews([]);
      } finally {
        setNewsLoading(false);
      }
    };
    loadNews();
  }, []);

  useEffect(() => {
    if (!canSendFeedback) return;
    usersAPI.list().then((res) => {
      const myId = Number(user?.id || 0);
      const members = safeList(res?.data)
        .map((m) => normalizeOrgMember(m))
        .filter((m) => Number(m.id) !== myId)
        .slice(0, 4);
      setOrgTeam(members);
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    const role = normalizeRole(user?.role);
    if (role !== 'projectmanager') {
      setTeamMembers([]);
      setTeamLoading(false);
      return;
    }

    let mounted = true;
    const loadTeam = async () => {
      setTeamLoading(true);
      try {
        const res = await usersAPI.list();
        const myId = Number(user?.id || 0);
        const filtered = safeList(res?.data)
          .map((member) => normalizeOrgMember(member))
          .filter((m) => Number(m.id) !== myId);

        if (!mounted) return;
        setTeamMembers(filtered);
      } catch {
        if (!mounted) return;
        setTeamMembers([]);
      } finally {
        if (mounted) setTeamLoading(false);
      }
    };

    loadTeam();
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.role, user?.department, user?.department_name]);

  const fallbackRole = user?.role === 'intern' ? 'intern' : 'employee';
  const banner = BANNERS[user?.role] || BANNERS[fallbackRole];
  const statsBase = QUICK_STATS[user?.role] || QUICK_STATS[fallbackRole];
  const stats =
    normalizeRole(user?.role) === 'projectmanager'
      ? statsBase.map((item, idx) => (idx === 0 ? { ...item, value: String(teamMembers.length) } : item))
      : statsBase;

  const sendFeedback = async () => {
    if (!fbText.trim()) return;
    try {
      await feedbackAPI.create(
        buildFeedbackCreatePayload({
          type: fbType,
          text: fbText,
          isAnonymous: fbMode === 'anonymous',
        })
      );
      setFbText('');
      setFbType(FEEDBACK_TYPE_CODES.suggestion);
      setFbMode('named');
      setFbMsg(tr('Обращение отправлено.'));
      setTimeout(() => setFbMsg(''), 2500);
    } catch (err) {
      setFbMsg(err?.response?.data?.detail || tr('Не удалось отправить обращение.'));
      setTimeout(() => setFbMsg(''), 3500);
    }
  };

  const newsToShow = useMemo(() => news.slice(0, 6), [news]);

  return (
    <MainLayout title={t('sidebar.home', 'Главная')}>
      <div className="announcement-banner" style={{ background: banner.bg, position: 'relative', overflow: 'hidden' }}>
        <div>
          <div className="announcement-title">{tr(banner.title)}</div>
          <div className="announcement-sub">{tr(banner.sub)}</div>
          <button className="btn" style={{ background: 'white', color: 'var(--primary)', fontWeight: 600, marginTop: 12 }} onClick={() => navigate(banner.path)}>
            {tr(banner.action)}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} className="card" style={{ background: s.color }}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px' }}>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{tr(s.label)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {canSendFeedback && (
        <>
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="card-body">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{tr('Обратная связь')}</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16, lineHeight: 1.5 }}>
              {tr('Оставьте обращение, указав тип и контакты для связи.')}
            </p>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">{tr('Тип обращения')}</label>
              <select className="form-select" value={fbType} onChange={(e) => setFbType(e.target.value)}>
                {FEEDBACK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {tr(option.label)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">{tr('Сообщение')}</label>
              <textarea className="form-textarea" placeholder={tr('Опишите ваше обращение...')} style={{ minHeight: 80 }} value={fbText} onChange={(e) => setFbText(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">{tr('Формат отправки')}</label>
              <select className="form-select" value={fbMode} onChange={(e) => setFbMode(e.target.value)}>
                <option value="named">{tr('Неанонимно')}</option>
                <option value="anonymous">{tr('Анонимно')}</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={sendFeedback}>{tr('Отправить')}</button>
            {fbMsg && <div style={{ marginTop: 8, fontSize: 12, color: fbMsg.includes('Не удалось') ? 'var(--danger)' : 'var(--success)' }}>{fbMsg}</div>}
          </div>
        </div>

        {orgTeam.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{tr('Наша команда')}</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {orgTeam.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
                  <div className="avatar" style={{ width: 36, height: 36, background: 'var(--primary-light)', fontSize: 13 }}>
                    {p.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{tr(p.position)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
        </>
      )}

      {normalizeRole(user?.role) === 'projectmanager' && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-title">{tr('Список команды (подчиненные)')}</span>
          </div>
          <div className="card-body">
            {teamLoading && <div style={{ color: 'var(--gray-500)' }}>{tr('Загрузка команды...')}</div>}
            {!teamLoading && teamMembers.length === 0 && (
              <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>{tr('У вас пока нет подчиненных')}</div>
            )}
            {!teamLoading && teamMembers.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 12 }}>
                {teamMembers.map((m) => (
                  <div
                    key={`subordinate-${m.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      background: 'var(--gray-50)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <div className="avatar" style={{ width: 36, height: 36, background: '#E5E7EB', fontSize: 13 }}>
                      {m.name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{m.position}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedNews && (
        <div className="modal-overlay" onClick={() => setSelectedNews(null)}>
          <div style={{ background: '#2D3748', borderRadius: 16, width: 760, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            {selectedNews.img ? <img src={selectedNews.img} alt={selectedNews.title} style={{ width: '100%', height: 300, objectFit: 'cover' }} /> : null}
            <button onClick={() => setSelectedNews(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={16} />
            </button>
            <div style={{ background: 'white', padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span className="badge badge-blue">{tr(selectedNews.category)}</span>
                <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>📅 {selectedNews.date}</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>{selectedNews.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: 1.7 }}>{selectedNews.text}</p>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
