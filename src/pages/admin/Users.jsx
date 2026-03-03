import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, BarChart2, Lock, X, Check, Ban, Send } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole, normalizeRole } from '../../utils/roles';
import { usersAPI, departmentsAPI, positionsAPI } from '../../api/auth';

const ROLE_LABELS = {
  intern: 'Стажер',
  employee: 'Сотрудник',
  projectmanager: 'Проект-менеджер',
  admin: 'Администратор',
  administrator: 'Администратор',
  systemadmin: 'Системный администратор',
  superadmin: 'Суперадмин',
};

const ROLE_BADGE = {
  intern: 'badge-green',
  employee: 'badge-blue',
  projectmanager: 'badge-purple',
  admin: 'badge-blue',
  administrator: 'badge-blue',
  systemadmin: 'badge-blue',
  superadmin: 'badge-yellow',
};

const ROLE_ICON = {
  intern: '📖',
  admin: '🛡️',
  administrator: '🛡️',
  systemadmin: '🛠️',
  superadmin: '👑',
};

const PROMOTION_REQUESTS_KEY = 'vpluse_promotion_requests';

const FALLBACK_DEPARTMENTS = ['Разработка', 'Продажи', 'Маркетинг', 'HR', 'Логистика'];
const FALLBACK_POSITIONS = ['Стажер', 'Frontend-разработчик', 'Менеджер продаж', 'Руководитель отдела'];

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function normalizeUserRow(raw) {
  const role = normalizeRole(raw.role || raw.user_role || raw.role_code || raw.account?.role || 'employee');
  const fullName =
    raw.full_name ||
    [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() ||
    raw.name ||
    raw.username ||
    raw.email ||
    'Без имени';

  const isActive =
    typeof raw.is_active === 'boolean'
      ? raw.is_active
      : typeof raw.active === 'boolean'
      ? raw.active
      : raw.status !== 'blocked';

  const departmentName = raw.department_name || raw.department?.name || raw.department || '';
  const positionName = raw.position_name || raw.position?.name || raw.position || '';

  return {
    id: raw.id,
    name: fullName,
    email: raw.email || '',
    phone: raw.phone || '',
    telegram: raw.telegram || '',
    department: departmentName,
    departmentId: raw.department_id || raw.department?.id || (typeof raw.department === 'number' ? raw.department : null),
    position: positionName,
    positionId: raw.position_id || raw.position?.id || (typeof raw.position === 'number' ? raw.position : null),
    role,
    status: isActive ? 'active' : 'blocked',
  };
}

function makeUserPayload(form, canManageAllRoles) {
  const payload = {
    full_name: form.name.trim(),
    email: form.email.trim(),
    username: form.email.trim(),
    phone: form.phone.trim(),
    telegram: form.telegram.trim(),
    department: form.department || null,
    position: form.position || null,
    role: canManageAllRoles ? form.role : 'intern',
    is_active: form.status === 'active',
  };

  if (form.password?.trim()) payload.password = form.password.trim();
  return payload;
}

export default function AdminUsers() {
  const { user, isSuperAdmin } = useAuth();
  const myRole = normalizeRole(user?.role);
  const isAdminOrSuper = isAdminRole(myRole);
  const canManageAllRoles = myRole === 'superadmin';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState(null);

  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [positionOptions, setPositionOptions] = useState([]);

  const [promotionRequests, setPromotionRequests] = useState(() => {
    try {
      const raw = localStorage.getItem(PROMOTION_REQUESTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    telegram: '',
    department: '',
    position: '',
    role: 'intern',
    password: '',
    status: 'active',
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await usersAPI.list();
      const rows = safeList(res.data).map(normalizeUserRow);
      setUsers(rows);
    } catch (err) {
      setUsers([]);
      setError(err?.response?.data?.detail || 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  };

  const loadOrgOptions = async () => {
    try {
      const [depRes, posRes] = await Promise.all([departmentsAPI.list(), positionsAPI.list()]);
      const deps = safeList(depRes.data).map((d) => ({ id: d.id, name: d.name || d.title || String(d.id) }));
      const poss = safeList(posRes.data).map((p) => ({ id: p.id, name: p.name || p.title || String(p.id) }));
      setDepartmentOptions(deps);
      setPositionOptions(poss);
    } catch {
      setDepartmentOptions(FALLBACK_DEPARTMENTS.map((name, idx) => ({ id: `fallback-dep-${idx}`, name })));
      setPositionOptions(FALLBACK_POSITIONS.map((name, idx) => ({ id: `fallback-pos-${idx}`, name })));
    }
  };

  useEffect(() => {
    loadUsers();
    loadOrgOptions();
  }, []);

  useEffect(() => {
    localStorage.setItem(PROMOTION_REQUESTS_KEY, JSON.stringify(promotionRequests));
  }, [promotionRequests]);

  const baseUsers = useMemo(
    () => (isAdminOrSuper ? users.filter((u) => u.role !== 'superadmin') : users.filter((u) => u.role === 'intern')),
    [isAdminOrSuper, users]
  );

  const pendingRequests = useMemo(() => promotionRequests.filter((r) => r.status === 'pending'), [promotionRequests]);

  const filtered = useMemo(() => {
    return baseUsers.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.position || '').toLowerCase().includes(q);
      const matchRole = filterRole === 'all' || u.role === filterRole;
      const matchStatus = filterStatus === 'all' || u.status === filterStatus;
      const matchDepartment = filterDepartment === 'all' || u.department === filterDepartment;
      const matchPosition = filterPosition === 'all' || u.position === filterPosition;
      return matchSearch && matchRole && matchStatus && matchDepartment && matchPosition;
    });
  }, [baseUsers, search, filterRole, filterStatus, filterDepartment, filterPosition]);

  const openAdd = () => {
    setEditUser(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      telegram: '',
      department: '',
      position: canManageAllRoles ? '' : 'Стажер',
      role: 'intern',
      password: '',
      status: 'active',
    });
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditUser(row);
    setForm({
      name: row.name,
      email: row.email,
      phone: row.phone || '',
      telegram: row.telegram || '',
      department: row.departmentId || row.department || '',
      position: row.positionId || row.position || '',
      role: row.role,
      password: '',
      status: row.status,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      showToast('Заполните имя и email', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = makeUserPayload(form, canManageAllRoles);

      if (editUser) {
        await usersAPI.update(editUser.id, payload);
        if (canManageAllRoles && editUser.role !== payload.role) {
          await usersAPI.setRole(editUser.id, payload.role);
        }
        showToast('Пользователь обновлен');
      } else {
        await usersAPI.create(payload);
        showToast(`Пользователь «${form.name}» создан`);
      }

      setShowModal(false);
      await loadUsers();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message || 'Не удалось сохранить пользователя';
      showToast(detail, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id) => {
    try {
      await usersAPI.toggleStatus(id);
      await loadUsers();
      showToast('Статус пользователя обновлен');
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Не удалось изменить статус', 'error');
    }
  };

  const hasPendingForUser = (userId) => pendingRequests.some((r) => r.userId === userId);

  const handleSendPromotionRequest = (internUser) => {
    if (internUser.role !== 'intern') return;
    if (hasPendingForUser(internUser.id)) {
      showToast(`По ${internUser.name} уже есть заявка на рассмотрении`, 'error');
      return;
    }

    const req = {
      id: Date.now(),
      userId: internUser.id,
      userName: internUser.name,
      status: 'pending',
      createdAt: new Date().toLocaleString('ru-RU'),
      requestedBy: user?.name || 'Администратор',
      requestedByRole: myRole,
      reason: 'Стажировка завершена. Запрос на перевод в сотрудники.',
    };

    setPromotionRequests((prev) => [req, ...prev]);
    showToast(`Заявка на перевод ${internUser.name} отправлена`);
  };

  const handleApprovePromotion = (requestId) => {
    const req = promotionRequests.find((r) => r.id === requestId);
    if (!req) return;
    setPromotionRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'approved', reviewedAt: new Date().toISOString() } : r)));
    setUsers((prev) => prev.map((u) => (u.id === req.userId ? { ...u, role: 'employee' } : u)));
    showToast(`Заявка от ${req.userName} одобрена`);
  };

  const handleRejectPromotion = (requestId) => {
    const req = promotionRequests.find((r) => r.id === requestId);
    if (!req) return;
    setPromotionRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'rejected', reviewedAt: new Date().toISOString() } : r)));
    showToast(`Заявка от ${req.userName} отклонена`, 'error');
  };

  const dynamicDepartments = useMemo(() => {
    const fromUsers = Array.from(new Set(baseUsers.map((u) => u.department).filter(Boolean)));
    return fromUsers.length ? fromUsers : departmentOptions.map((d) => d.name);
  }, [baseUsers, departmentOptions]);

  const dynamicPositions = useMemo(() => {
    const fromUsers = Array.from(new Set(baseUsers.map((u) => u.position).filter(Boolean)));
    return fromUsers.length ? fromUsers : positionOptions.map((p) => p.name);
  }, [baseUsers, positionOptions]);

  return (
    <MainLayout title="Админ-панель · Пользователи">
      <div className="page-header">
        <div>
          <div className="page-title">{isAdminOrSuper ? 'Сотрудники' : 'Управление пользователями'}</div>
          <div className="page-subtitle">
            {isAdminOrSuper
              ? 'Список сотрудников: отдел, должность и поиск.'
              : 'Администратор работает только со стажерами.'}
          </div>
        </div>
        {isAdminOrSuper && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={15} /> Добавить пользователя
          </button>
        )}
      </div>

      {isSuperAdmin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Заявки стажеров на перевод в сотрудники</span>
            <span className="badge badge-blue">{pendingRequests.length} на рассмотрении</span>
          </div>
          <div className="card-body">
            {pendingRequests.length === 0 && <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Новых заявок нет.</div>}
            {pendingRequests.map((req) => (
              <div key={req.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{req.userName}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Отправлено: {req.createdAt || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Инициатор: {req.requestedBy || '—'}</div>
                    {req.reason && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--gray-700)' }}>{req.reason}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleApprovePromotion(req.id)}>
                      <Check size={14} /> Одобрить
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleRejectPromotion(req.id)}>
                      <Ban size={14} /> Отклонить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Поиск по имени, email или должности..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {isAdminOrSuper && (
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-select" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} style={{ minWidth: 170 }}>
                  <option value="all">Все отделы</option>
                  {dynamicDepartments.map((dep) => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>
                <select className="form-select" value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)} style={{ minWidth: 190 }}>
                  <option value="all">Все должности</option>
                  {dynamicPositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isAdminOrSuper && (
              <div style={{ display: 'flex', gap: 8 }}>
                {['all', 'intern', 'blocked'].map((f) => {
                  const labels = { all: 'Все', intern: 'Стажеры', blocked: 'Заблокированные' };
                  return (
                    <button
                      key={f}
                      onClick={() => {
                        if (f === 'blocked') setFilterStatus(filterStatus === 'blocked' ? 'all' : 'blocked');
                        else {
                          setFilterRole(filterRole === f ? 'all' : f);
                          setFilterStatus('all');
                        }
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: '1px solid var(--gray-200)',
                        background: filterRole === f || (f === 'blocked' && filterStatus === 'blocked') ? 'var(--gray-100)' : 'transparent',
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {labels[f]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ПОЛЬЗОВАТЕЛЬ</th>
                <th>ДОЛЖНОСТЬ</th>
                <th>ОТДЕЛ</th>
                {isAdminOrSuper && <th>РОЛЬ</th>}
                {isAdminOrSuper && <th>СТАТУС</th>}
                {isAdminOrSuper && <th>ДЕЙСТВИЯ</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ padding: 20, color: 'var(--gray-500)' }}>
                    Загрузка...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={6} style={{ padding: 20, color: 'var(--danger)' }}>
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 20, color: 'var(--gray-500)' }}>
                    Данных нет
                  </td>
                </tr>
              )}

              {!loading && !error &&
                filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                          {(u.name || '?')
                            .split(' ')
                            .map((p) => p[0])
                            .join('')
                            .slice(0, 2)}
                        </div>
                        <div>
                          <div className="user-cell-name">{u.name}</div>
                          <div className="user-cell-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{u.position || '—'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{u.department || '—'}</div>
                    </td>

                    {isAdminOrSuper && (
                      <td>
                        <span className={`badge ${ROLE_BADGE[u.role] || 'badge-gray'}`}>
                          {ROLE_ICON[u.role] && <span style={{ marginRight: 2 }}>{ROLE_ICON[u.role]}</span>}
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                    )}

                    {isAdminOrSuper && (
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <span className={`status-dot ${u.status === 'active' ? 'green' : 'red'}`} />
                          {u.status === 'active' ? 'Активен' : 'Заблокирован'}
                        </span>
                      </td>
                    )}

                    {isAdminOrSuper && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {u.role !== 'superadmin' && (
                            <>
                              <button className="btn-icon" title="Редактировать" onClick={() => openEdit(u)}>
                                <Pencil size={14} />
                              </button>
                              <button className="btn-icon" title="Статистика">
                                <BarChart2 size={14} />
                              </button>

                              {!isSuperAdmin && u.role === 'intern' && (
                                <button
                                  className="btn-icon"
                                  title={hasPendingForUser(u.id) ? 'Заявка уже отправлена' : 'Отправить запрос суперадмину'}
                                  onClick={() => handleSendPromotionRequest(u)}
                                  disabled={hasPendingForUser(u.id)}
                                  style={{ color: hasPendingForUser(u.id) ? 'var(--gray-300)' : 'var(--primary)' }}
                                >
                                  <Send size={14} />
                                </button>
                              )}

                              {isSuperAdmin && (
                                <button
                                  className="btn-icon"
                                  title={u.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                                  onClick={() => toggleStatus(u.id)}
                                  style={{ color: u.status === 'active' ? 'var(--danger)' : 'var(--success)' }}
                                >
                                  <Lock size={14} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-200)' }}>
          Показано 1–{filtered.length} из {baseUsers.length} пользователей
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editUser ? 'Редактирование пользователя' : 'Добавление нового пользователя'}</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-section-label">ОСНОВНАЯ ИНФОРМАЦИЯ</div>

              <div className="grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Фамилия Имя</label>
                  <input className="form-input" placeholder="Иванов Иван" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email (Логин)</label>
                  <input className="form-input" placeholder="example@vpluse.kg" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Телефон</label>
                  <input className="form-input" placeholder="+996 ..." value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telegram</label>
                  <input className="form-input" placeholder="@username" value={form.telegram} onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))} />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Отдел</label>
                  <select className="form-select" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
                    <option value="">Выберите отдел</option>
                    {departmentOptions.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Должность</label>
                  <select className="form-select" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}>
                    <option value="">Выберите должность</option>
                    {positionOptions.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!editUser && (
                <div className="grid-2" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Пароль</label>
                    <input className="form-input" type="password" placeholder="Задайте пароль" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Повторите пароль</label>
                    <input className="form-input" type="password" placeholder="Повторите пароль" />
                  </div>
                </div>
              )}

              <div className="modal-section-label">РОЛЬ В СИСТЕМЕ</div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Роль в системе</label>
                  <select className="form-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} disabled={!canManageAllRoles}>
                    <option value="intern">Стажер</option>
                    <option value="employee">Сотрудник</option>
                    <option value="projectmanager">Проект-менеджер</option>
                    <option value="admin">Администратор</option>
                    <option value="administrator">Администратор (legacy)</option>
                    <option value="systemadmin">Системный администратор</option>
                    {canManageAllRoles && <option value="superadmin">Суперадмин</option>}
                  </select>
                  {!canManageAllRoles && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--gray-500)' }}>Администратор может создавать только стажеров.</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Статус учетной записи</label>
                  <select className="form-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="active">Активен</option>
                    <option value="blocked">Заблокирован</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Отмена
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Сохранение...' : editUser ? 'Сохранить изменения' : 'Создать пользователя'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div>
            <div className="toast-title">{toast.type === 'error' ? 'Ошибка' : 'Успешно'}</div>
            <div className="toast-msg">{toast.msg}</div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
