import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { companyAPI, gamificationAPI } from '../../api/content';
import { usersAPI } from '../../api/auth';

const NODE_COLORS = ['#D9F99D', '#FDE68A', '#C4B5FD', '#F9A8D4', '#93C5FD', '#67E8F9', '#FCA5A5', '#FDBA74'];

const ROLE_LABELS = {
  projectmanager: 'Тимлид',
  teamlead: 'Тимлид',
  department_head: 'Руководитель отдела',
  employee: 'Сотрудник',
  intern: 'Стажер',
  admin: 'Админ',
  superadmin: 'Суперадмин',
};

function roleWeight(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'projectmanager' || normalized === 'teamlead') return 1;
  if (normalized === 'employee') return 2;
  if (normalized === 'intern') return 3;
  if (normalized === 'department_head') return 4;
  if (normalized === 'admin' || normalized === 'superadmin') return 5;
  return 99;
}

function sortMembers(list) {
  return [...list].sort((a, b) => {
    const byRole = roleWeight(a.role) - roleWeight(b.role);
    if (byRole !== 0) return byRole;
    const aName = (a.full_name || a.username || '').toLowerCase();
    const bName = (b.full_name || b.username || '').toLowerCase();
    return aName.localeCompare(bName, 'ru');
  });
}

function UserProfileModal({ selected, onClose }) {
  if (!selected) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">Профиль сотрудника</div>
          <button className="btn-icon" type="button" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><span className="text-muted">ФИО:</span><br /><b>{selected.full_name || selected.username || '-'}</b></div>
            <div><span className="text-muted">Роль:</span><br /><b>{ROLE_LABELS[selected.role] || selected.role || '-'}</b></div>
            <div><span className="text-muted">Отдел:</span><br /><b>{selected.departmentName || '-'}</b></div>
            <div><span className="text-muted">Подотдел:</span><br /><b>{selected.subdivision || '-'}</b></div>
            <div><span className="text-muted">Логин:</span><br /><b>{selected.username || '-'}</b></div>
            <div><span className="text-muted">Телеграм:</span><br /><b>{selected.telegram || '-'}</b></div>
            <div><span className="text-muted">Телефон:</span><br /><b>{selected.phone || '-'}</b></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

export default function Company() {
  const [tab, setTab] = useState('structure');
  const [ratingPeriod, setRatingPeriod] = useState('all_time');
  const [structure, setStructure] = useState(null);
  const [org, setOrg] = useState(null);
  const [users, setUsers] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [structureRes, orgRes] = await Promise.all([
          companyAPI.structure(),
          companyAPI.org(),
        ]);
        setStructure(structureRes.data || null);
        setOrg(orgRes.data || null);
        const usersRes = await usersAPI.list().catch(() => ({ data: [] }));
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        const leaderboardRes = await gamificationAPI.leaderboard().catch(() => ({ data: null }));
        setLeaderboard(leaderboardRes.data || null);
      } catch (e) {
        setError(e.response?.data?.detail || 'Не удалось загрузить данные компании.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const membersByDepartmentId = useMemo(() => {
    const map = new Map();
    (org?.departments || []).forEach((dep) => {
      const sorted = sortMembers(dep.members || []);
      map.set(dep.id, sorted);
    });
    return map;
  }, [org]);

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((u) => map.set(Number(u.id), u));
    return map;
  }, [users]);

  const employees = useMemo(() => {
    const rows = [];
    (org?.departments || []).forEach((dep) => {
      sortMembers(dep.members || []).forEach((member) => {
        rows.push({
          id: member.id,
          full_name: member.full_name || member.username || `#${member.id}`,
          department: dep.name || '-',
          subdivision: usersById.get(Number(member.id))?.subdivision_name || usersById.get(Number(member.id))?.subdivision || '-',
          role: ROLE_LABELS[member.role] || member.role || '-',
        });
      });
    });
    return rows;
  }, [org, usersById]);

  const leaderboardSection = leaderboard?.periods?.[ratingPeriod] || { rows: [], current_user: null, label: '' };
  const leaderboardRows = Array.isArray(leaderboardSection.rows) ? leaderboardSection.rows : [];
  const currentUserRow = leaderboardSection.current_user || null;

  return (
    <MainLayout title="Компания">
      <div className="page-header">
        <div>
          <div className="page-title">Компания</div>
          <div className="page-subtitle">Структура компании и сотрудники</div>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ color: '#b91c1c' }}>{error}</div>
        </div>
      ) : null}

      {loading ? <div className="card"><div className="card-body">Загрузка...</div></div> : null}

      {!loading ? (
        <>
          <div className="tabs" style={{ marginBottom: 14 }}>
            <button className={`tab-btn ${tab === 'structure' ? 'active' : ''}`} onClick={() => setTab('structure')}>Структура</button>
            <button className={`tab-btn ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>Сотрудники</button>
            <button className={`tab-btn ${tab === 'ratings' ? 'active' : ''}`} onClick={() => setTab('ratings')}>Рейтинги</button>
          </div>

          {tab === 'structure' ? (
            <div className="card">
              <div className="card-body" style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 980 }}>
                  <div style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 12 }}>
                    Структура компании
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                    <div style={{ background: '#A3E635', border: '1px solid #84CC16', borderRadius: 10, padding: '10px 14px', minWidth: 240, textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Руководитель</div>
                      <div style={{ fontSize: 12 }}>{structure?.owner?.full_name || '-'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, (structure?.departments || []).length)}, minmax(220px, 1fr))`, gap: 10 }}>
                    {(structure?.departments || []).map((dep, i) => {
                      const depMembers = membersByDepartmentId.get(dep.id) || [];
                      return (
                        <div
                          key={dep.id}
                          style={{
                            background: NODE_COLORS[i % NODE_COLORS.length],
                            border: '1px solid rgba(0,0,0,0.08)',
                            borderRadius: 10,
                            padding: 10,
                            minHeight: 220,
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{dep.name}</div>
                          <div style={{ fontSize: 13, marginBottom: 8 }}>
                            Руководитель: {dep.head?.full_name || dep.head?.username || 'Не назначен'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--gray-700)', marginBottom: 8 }}>
                            Сотрудники: {depMembers.length}
                          </div>

                          <div style={{ marginTop: 6, borderTop: '1px solid rgba(0,0,0,0.12)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {depMembers.length === 0 ? (
                              <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Сотрудников нет</div>
                            ) : (
                              depMembers.map((member) => (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => {
                                    const profile = usersById.get(Number(member.id));
                                    setSelectedMember({
                                      ...member,
                                      departmentName: dep.name,
                                      subdivision: profile?.subdivision_name || profile?.subdivision || member.subdivision || '-',
                                    });
                                  }}
                                  style={{
                                    textAlign: 'left',
                                    border: '1px solid rgba(0,0,0,0.15)',
                                    borderRadius: 8,
                                    background: 'rgba(255,255,255,0.65)',
                                    padding: '6px 8px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    {member.full_name || member.username}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--gray-700)' }}>
                                    {ROLE_LABELS[member.role] || member.role || '-'}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'employees' ? (
            <div className="card">
              <div className="card-header"><span className="card-title">Сотрудники компании</span></div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>СОТРУДНИК</th>
                      <th>ОТДЕЛ</th>
                      <th>ПОДОТДЕЛ</th>
                      <th>РОЛЬ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((u) => (
                      <tr key={`${u.id}-${u.department}`}>
                        <td>{u.full_name}</td>
                        <td>{u.department}</td>
                        <td>{u.subdivision}</td>
                        <td>{u.role}</td>
                      </tr>
                    ))}
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ color: 'var(--gray-500)' }}>Данные не найдены.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'ratings' ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="card">
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span className="card-title">Рейтинг сотрудников</span>
                  <div className="tabs" style={{ marginBottom: 0 }}>
                    <button className={`tab-btn ${ratingPeriod === 'all_time' ? 'active' : ''}`} onClick={() => setRatingPeriod('all_time')}>Все время</button>
                    <button className={`tab-btn ${ratingPeriod === 'week' ? 'active' : ''}`} onClick={() => setRatingPeriod('week')}>Неделя</button>
                    <button className={`tab-btn ${ratingPeriod === 'month' ? 'active' : ''}`} onClick={() => setRatingPeriod('month')}>Месяц</button>
                  </div>
                </div>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: '16px 18px', background: 'linear-gradient(135deg,#eff6ff,#f8fafc)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>Период</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{leaderboardSection.label || 'Рейтинг'}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>Участников: {leaderboardRows.length}</div>
                  </div>
                  <div style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: '16px 18px', background: 'linear-gradient(135deg,#ecfccb,#fefce8)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>Лидер периода</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{leaderboardRows[0]?.full_name || 'Пока нет данных'}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 6 }}>
                      {ratingPeriod === 'all_time' ? `${leaderboardRows[0]?.xp_total ?? 0} XP всего` : `${leaderboardRows[0]?.period_xp ?? 0} XP за период`}
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: '16px 18px', background: 'linear-gradient(135deg,#fdf2f8,#faf5ff)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>Моя позиция</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{currentUserRow ? `#${currentUserRow.rank}` : 'Вне рейтинга'}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 6 }}>
                      {currentUserRow ? `${ratingPeriod === 'all_time' ? currentUserRow.xp_total : currentUserRow.period_xp} XP` : 'Появится после игровых событий'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">Таблица рейтинга</span></div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>МЕСТО</th>
                        <th>СОТРУДНИК</th>
                        <th>ОТДЕЛ</th>
                        <th>РОЛЬ</th>
                        <th>УРОВЕНЬ</th>
                        <th>{ratingPeriod === 'all_time' ? 'ВСЕГО XP' : 'XP ЗА ПЕРИОД'}</th>
                        <th>СТРИК</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardRows.map((row) => (
                        <tr key={`${ratingPeriod}-${row.user_id}`} style={currentUserRow?.user_id === row.user_id ? { background: '#f0fdf4' } : undefined}>
                          <td><b>#{row.rank}</b></td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{row.full_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>@{row.username}</div>
                          </td>
                          <td>
                            <div>{row.department_name || '-'}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.subdivision_name || '-'}</div>
                          </td>
                          <td>{ROLE_LABELS[row.role] || row.role_label || row.role || '-'}</td>
                          <td>Lv. {row.level}</td>
                          <td>{ratingPeriod === 'all_time' ? row.xp_total : row.period_xp}</td>
                          <td>{row.current_streak}</td>
                        </tr>
                      ))}
                      {leaderboardRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ color: 'var(--gray-500)' }}>Рейтинг пока пуст.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <UserProfileModal selected={selectedMember} onClose={() => setSelectedMember(null)} />
    </MainLayout>
  );
}
