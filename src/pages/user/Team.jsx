import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { usersAPI } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { normalizeRole } from '../../utils/roles';

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function initials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Team() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const role = normalizeRole(user?.role);
        const isAdminLike = role === 'superadmin' || role === 'administrator' || role === 'admin';
        let nextRows = [];

        try {
          const res = await usersAPI.myTeam();
          nextRows = safeList(res?.data);
        } catch (teamErr) {
          const status = Number(teamErr?.response?.status || 0);
          if (isAdminLike && (status === 403 || status === 404)) {
            const allUsersRes = await usersAPI.list();
            nextRows = safeList(allUsersRes?.data);
          } else {
            throw teamErr;
          }
        }

        if (isAdminLike && nextRows.length === 0) {
          const allUsersRes = await usersAPI.list();
          nextRows = safeList(allUsersRes?.data);
        }

        if (!mounted) return;
        setRows(nextRows);
      } catch (err) {
        if (!mounted) return;
        setRows([]);
        const status = Number(err?.response?.status || 0);
        if (status !== 403) {
          setError(err?.response?.data?.detail || t('team.error.load', 'Не удалось загрузить список подчиненных'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [t, user?.role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        String(r.full_name || '').toLowerCase().includes(q) ||
        String(r.position_name || '').toLowerCase().includes(q) ||
        String(r.department_name || '').toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || String(r.role || '').toLowerCase() === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [rows, query, roleFilter]);

  return (
    <MainLayout title={t('team.title', 'Моя команда')}>
      <div className="page-header">
        <div>
          <div className="page-title">{t('team.title', 'Моя команда')}</div>
          <div className="page-subtitle">{t('team.subtitle', 'Список ваших подчиненных сотрудников')}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 1fr' }}>
          <input
            className="form-input"
            placeholder={t('team.search.placeholder', 'Поиск: ФИО, должность, отдел')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="form-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">{t('team.role.all', 'Все роли')}</option>
            <option value="projectmanager">{t('team.role.projectmanager', 'Тимлид')}</option>
            <option value="employee">{t('team.role.employee', 'Сотрудник')}</option>
            <option value="intern">{t('team.role.intern', 'Стажер')}</option>
            <option value="admin">{t('team.role.admin', 'Админ')}</option>
            <option value="administrator">{t('team.role.administrator', 'Администратор')}</option>
          </select>
        </div>
      </div>

      {error && <div style={{ marginBottom: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="card-title">{t('team.table.subordinates', 'Подчиненные')}</span>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('team.table.shown', 'Показано')}: {filtered.length}</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('team.table.employee', 'Сотрудник')}</th>
                <th>{t('team.table.role', 'Роль')}</th>
                <th>{t('team.table.position', 'Должность')}</th>
                <th>{t('team.table.department', 'Отдел')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--gray-500)' }}>{t('common.loading', 'Загрузка...')}</td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--gray-500)' }}>{t('team.table.empty', 'Подчиненные не найдены')}</td>
                </tr>
              )}

              {!loading && filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={m.full_name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#E5E7EB', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>
                          {initials(m.full_name)}
                        </div>
                      )}
                      <span>{m.full_name || `#${m.id}`}</span>
                    </div>
                  </td>
                  <td>{m.role_label || m.role || '—'}</td>
                  <td>{m.position_name || '—'}</td>
                  <td>{m.department_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
