import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { usersAPI } from '../../api/auth';
import { isAdminRole, normalizeRole } from '../../utils/roles';

const MODULES = [
  {
    id: 'content',
    label: 'Контент (Главная, Инструкция, Регламенты)',
    desc: 'Новости, приветственные блоки, инструкции, регламенты.',
    options: ['CRUD', 'Только просмотр'],
    def: 'CRUD',
  },
  {
    id: 'onboarding',
    label: 'Онбординг / Отчеты',
    desc: 'Дни стажировки, дедлайны, статусы отчетов и комментарии.',
    options: ['Управление днями и контентом', 'Проверка отчетов'],
    def: 'Управление днями и контентом',
    extra: 'Проверка отчетов',
  },
  {
    id: 'users',
    label: 'Пользователи',
    desc: 'Работа с учетными записями сотрудников и стажеров.',
    options: ['Стажеры (создание / деактивация)', 'Администраторы'],
    def: 'Стажеры (создание / деактивация)',
  },
  {
    id: 'schedules',
    label: 'Графики работы',
    desc: 'Типовые графики и назначения по сотрудникам.',
    options: ['Типовые графики', 'Управление календарем'],
    def: 'Типовые графики',
  },
  {
    id: 'feedback',
    label: 'Обратная связь',
    desc: 'Очередь обращений и статусы обработки.',
    options: ['Просмотр и обработка обращений'],
    def: 'Просмотр и обработка обращений',
  },
  {
    id: 'system',
    label: 'Система, безопасность, интерфейс',
    desc: 'Доступно только супер-админу.',
    options: ['Система и безопасность', 'Настройки интерфейса'],
    def: null,
  },
];

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function normalizeUser(raw) {
  const role = normalizeRole(raw.role || raw.user_role || raw.role_code || raw.account?.role || 'employee');
  const name =
    raw.full_name ||
    [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() ||
    raw.name ||
    raw.username ||
    raw.email ||
    `Пользователь #${raw.id}`;

  return {
    id: raw.id,
    role,
    status: raw.status || raw.account_status || (raw.is_active ? 'active' : 'inactive'),
    name,
  };
}

const roleTitle = (role) => {
  if (role === 'superadmin') return 'Суперадминистратор';
  if (role === 'systemadmin') return 'Системный администратор';
  if (role === 'administrator' || role === 'admin') return 'Администратор';
  if (role === 'projectmanager') return 'Проект-менеджер';
  if (role === 'intern') return 'Стажер';
  return 'Сотрудник';
};

export default function AdminOverview() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [moduleState, setModuleState] = useState({});

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await usersAPI.list();
        if (!mounted) return;
        const nextUsers = safeList(res.data).map(normalizeUser);
        setUsers(nextUsers);
      } catch (err) {
        if (!mounted) return;
        setUsers([]);
        setError(err?.response?.data?.detail || 'Не удалось загрузить пользователей');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const activeUsers = users.filter((u) => u.is_active).length;
    const interns = users.filter((u) => u.role === 'intern').length;
    const admins = users.filter((u) => u.role === 'department_head' || u.role === 'admin' || u.role === 'administrator' || u.role === 'superadmin').length;
    const sentReports = reports.filter((r) => String(r.status || '').toUpperCase() === 'SENT').length;
    const newFeedback = feedback.filter((f) => f.status === 'new').length;
    return { activeUsers, interns, admins, sentReports, newFeedback };
  }, [users, reports, feedback]);

  return (
    <MainLayout title="Админ-панель">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="page-title">Обзор ролей и прав доступа</div>
          <div className="page-subtitle">Управление пользователями, ролями, модулями и системными настройками платформы.</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="badge badge-purple" style={{ marginBottom: 6, display: 'block' }}>
            Полный доступ - Суперадминистратор
          </span>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            Активных: {activeCount} - Стажеров: {internCount}
          </div>
        </div>
      </div>

      {error && <div style={{ marginBottom: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      <div className="grid-2" style={{ gap: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Ролевой доступ (RBAC)</span>
            <span className="badge badge-gray">4 роли</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                name: 'Стажер',
                desc: 'Онбординг, регламенты, отчеты, профиль и инструкция.',
                badge: 'Только просмотр + свои отчеты',
                color: '#D1FAE5',
              },
              {
                name: 'Администратор',
                desc: 'Операционная работа с контентом, онбордингом и пользователями.',
                badge: 'Набор модулей по правам',
                color: '#DBEAFE',
              },
              {
                name: 'Системный администратор',
                desc: 'Админские разделы + системные задачи.',
                badge: 'Admin-like доступ',
                color: '#E0E7FF',
              },
              {
                name: 'Суперадминистратор',
                desc: 'Роли, права, система, безопасность и полный контроль платформы.',
                badge: 'Полный контроль',
                color: '#FEF9C3',
              },
            ].map((role) => (
              <div key={role.name} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '12px 14px', background: `${role.color}40` }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{role.name}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>{role.desc}</div>
                <span className="badge badge-gray" style={{ fontSize: 11 }}>
                  {role.badge}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Модули и права администратора</span>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>Суперадмин настраивает доступ к модулям для каждого администратора отдельно.</div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Выбранный администратор</label>
              <select className="form-select" value={selectedAdminId} onChange={(e) => setSelectedAdminId(e.target.value)} disabled={loading || !admins.length}>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} - {roleTitle(a.role)}
                  </option>
                ))}
              </select>
            </div>

            {visibleModules.map((mod) => (
              <div key={mod.id} style={{ borderBottom: '1px solid var(--gray-100)', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{mod.label}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 6 }}>{mod.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {mod.options.map((opt) => {
                    const key = `${mod.id}_${opt}`;
                    const defaultVal = opt === mod.def || opt === mod.extra;
                    const checked = moduleState[key] !== undefined ? moduleState[key] : defaultVal;
                    return (
                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12 }}>
                        <input type="checkbox" checked={Boolean(checked)} onChange={() => setModuleState((s) => ({ ...s, [key]: !checked }))} />
                        <span style={{ background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 20 }}>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <span className="card-title">Быстрый доступ к модулям</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Пользователи', count: users.length },
              { label: 'Роли и права' },
              { label: 'Контент' },
              { label: 'Онбординг' },
            ].map((item) => (
              <div key={item.label} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{item.label}</div>
                {typeof item.count === 'number' && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{item.count} записей</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
