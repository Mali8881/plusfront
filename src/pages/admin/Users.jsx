import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Lock, Send, Check, Ban, X, MessageSquare } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import {
  usersAPI,
  departmentsAPI,
  subdivisionsAPI,
  promotionRequestsAPI,
} from '../../api/auth';
import { regulationsAPI } from '../../api/content';

const ROLE_LABELS = {
  intern: 'Стажер',
  employee: 'Сотрудник',
  teamlead: 'Тимлид',
  projectmanager: 'Тимлид / Менеджер проекта',
  department_head: 'Руководитель подразделения',
  admin: 'Руководитель подразделения',
  administrator: 'Администратор',
  superadmin: 'Суперадмин',
};

const ROLE_BADGE = {
  intern:         { bg: '#EFF6FF', color: '#2563EB' },
  employee:       { bg: '#F0FDF4', color: '#16A34A' },
  teamlead:       { bg: '#FAF5FF', color: '#7C3AED' },
  projectmanager: { bg: '#FAF5FF', color: '#7C3AED' },
  department_head:{ bg: '#FFF7ED', color: '#C2410C' },
  admin:          { bg: '#FFF7ED', color: '#EA580C' },
  administrator:  { bg: '#E0F2FE', color: '#0369A1' },
  superadmin:     { bg: '#FFF1F2', color: '#BE123C' },
};

const PRIVILEGED_ROLES = new Set(['department_head', 'admin', 'administrator', 'superadmin']);
const MANAGER_ROLES = new Set(['teamlead', 'projectmanager', 'department_head', 'admin']);

const EMPTY_FORM = {
  name: '',
  email: '',
  department: '',
  subdivision: '',
  manager: '',
  role: 'intern',
  password: '',
  notes: '',
};

function extractApiError(error, fallback) {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.error === 'string') return data.error;

  const firstField = Object.keys(data)[0];
  if (!firstField) return fallback;
  const value = data[firstField];
  if (Array.isArray(value) && value.length) return String(value[0]);
  if (typeof value === 'string') return value;
  return fallback;
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function fixedSubdivisionLabelByRole(role) {
  const map = {
    teamlead: 'Вся команда',
    projectmanager: 'Вся команда',
    department_head: 'Весь департамент',
    admin: 'Весь департамент',
    administrator: 'Вся организация',
    superadmin: 'Вся система',
  };
  return map[role] || '-';
}

function mapUser(raw) {
  return {
    id: raw.id,
    name: raw.full_name || raw.username,
    email: raw.email || '',
    role: raw.role || 'intern',
    department: raw.department_name || '',
    departmentId: raw.department || null,
    position: raw.subdivision_name || raw.position_name || '',
    positionId: raw.position || null,
    subdivisionId: raw.subdivision || null,
    subdivisionName: raw.subdivision_name || '',
    managerId: raw.manager || null,
    managerName: raw.manager_name || '',
    status: raw.is_active ? 'active' : 'blocked',
    notes: raw.notes || '',
  };
}

export default function AdminUsers() {
  const { user, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subdivisions, setSubdivisions] = useState([]);
  const [promotionRequests, setPromotionRequests] = useState([]);
  const [internRequests, setInternRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSub, setFilterSub] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  const myRole = String(user?.role || '').toLowerCase();
  const isSuperOrAdmin = isSuperAdmin || myRole === 'administrator';
  const isDepartmentHead = myRole === 'department_head' || myRole === 'admin';
  const canAssignAdminRoles = isSuperOrAdmin;
  const ownDepartmentId = user?.department ? String(user.department) : '';

  const canEdit = (target) => {
    if (isSuperOrAdmin) return true;
    if (isDepartmentHead || myRole === 'admin') return !PRIVILEGED_ROLES.has(target.role);
    return false;
  };

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, depRes, subRes, promotionRes, internReqRes] = await Promise.allSettled([
        usersAPI.list(),
        departmentsAPI.list(),
        subdivisionsAPI.list({ is_active: true }),
        promotionRequestsAPI.list(),
        regulationsAPI.adminInternRequests({ status: 'pending' }),
      ]);

      const usersData = usersRes.status === 'fulfilled' ? usersRes.value?.data : [];
      const departmentsData = depRes.status === 'fulfilled' ? depRes.value?.data : [];
      const subdivisionsData = subRes.status === 'fulfilled' ? subRes.value?.data : [];
      const promotionsData = promotionRes.status === 'fulfilled' ? promotionRes.value?.data : [];
      const internReqData = internReqRes.status === 'fulfilled' ? internReqRes.value?.data : [];

      setUsers((Array.isArray(usersData) ? usersData : []).map(mapUser));
      setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
      setSubdivisions(Array.isArray(subdivisionsData) ? subdivisionsData : []);
      setPromotionRequests(Array.isArray(promotionsData) ? promotionsData : []);
      setInternRequests(Array.isArray(internReqData) ? internReqData : []);

      const failed = [];
      if (usersRes.status === 'rejected') failed.push('пользователи');
      if (depRes.status === 'rejected') failed.push('отделы');
      if (subRes.status === 'rejected') failed.push('подотделы');
      if (promotionRes.status === 'rejected') failed.push('заявки на перевод');
      if (failed.length) setError(`Часть данных не загружена: ${failed.join(', ')}.`);
    } catch {
      setError('Не удалось загрузить данные страницы.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const filterSubOptions = useMemo(() => {
    if (!filterDept) return subdivisions;
    return subdivisions.filter((s) => Number(s.department_id) === Number(filterDept));
  }, [subdivisions, filterDept]);

  const filtered = useMemo(() => {
    let list = users;
    if (filterDept) list = list.filter((u) => Number(u.departmentId) === Number(filterDept));
    if (filterSub)  list = list.filter((u) => Number(u.subdivisionId) === Number(filterSub));
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q) ||
      u.position.toLowerCase().includes(q) ||
      (u.notes || '').toLowerCase().includes(q)
    );
    return list;
  }, [users, search, filterDept, filterSub]);

  const pending = useMemo(
    () => promotionRequests.filter((r) => r.status === 'pending'),
    [promotionRequests]
  );
  const pendingInternRequests = useMemo(
    () => internRequests.filter((r) => String(r.status || '').toLowerCase() === 'pending'),
    [internRequests]
  );

  const openAdd = () => {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (target) => {
    setEditUser(target);
    setForm({
      name: target.name,
      email: target.email,
      department: target.departmentId ? String(target.departmentId) : '',
      subdivision: target.subdivisionId ? String(target.subdivisionId) : '',
      manager: target.managerId ? String(target.managerId) : '',
      role: target.role || 'intern',
      password: '',
      notes: target.notes || '',
    });
    setShowModal(true);
  };

  const saveUser = async () => {
    if (savingUser) return;
    if (!form.name || !form.email) return;
    const name = splitName(form.name);
    let departmentPayload = form.department || null;
    if (isDepartmentHead) {
      if (form.role === 'intern') departmentPayload = null;
      else if (form.role === 'employee' || form.role === 'projectmanager' || form.role === 'teamlead') departmentPayload = ownDepartmentId || null;
    }
    const supportsSubdivision = form.role === 'intern' || form.role === 'employee';
    const payload = {
      username: form.email,
      email: form.email,
      first_name: name.first_name,
      last_name: name.last_name,
      department: departmentPayload,
      position: null,
      subdivision: supportsSubdivision ? (form.subdivision || null) : null,
      manager: (form.role === 'projectmanager' || form.role === 'teamlead') ? null : (form.manager || null),
      role: form.role,
      notes: form.notes || '',
    };
    if (form.password) payload.password = form.password;
    try {
      setSavingUser(true);
      if (editUser) await usersAPI.update(editUser.id, payload);
      else await usersAPI.create(payload);
      setShowModal(false);
      await loadAll();
    } catch (e) {
      setError(extractApiError(e, 'Не удалось сохранить пользователя.'));
    } finally {
      setSavingUser(false);
    }
  };

  const toggleStatus = async (id) => {
    try {
      await usersAPI.toggleStatus(id);
      await loadAll();
    } catch {
      setError('Не удалось изменить статус.');
    }
  };

  const sendPromotion = async (targetUser) => {
    try {
      await promotionRequestsAPI.create({
        user_id: targetUser.id,
        requested_role: 'employee',
        reason: 'Заявка на перевод стажера в сотрудники.',
      });
      await loadAll();
    } catch {
      setError('Не удалось отправить заявку.');
    }
  };

  const handleApprove = async (id) => {
    try {
      await promotionRequestsAPI.approve(id, { comment: 'Одобрено' });
      await loadAll();
    } catch {
      setError('Не удалось одобрить заявку.');
    }
  };

  const handleReject = async (id) => {
    try {
      await promotionRequestsAPI.reject(id, { comment: 'Отклонено' });
      await loadAll();
    } catch {
      setError('Не удалось отклонить заявку.');
    }
  };

  const approveInternCompletion = async (id) => {
    try {
      await regulationsAPI.approveInternRequest(id, {});
      await loadAll();
    } catch {
      setError('Не удалось подтвердить стажировку.');
    }
  };

  const managerOptions = useMemo(() => {
    const effectiveDepartment = isDepartmentHead
      ? ((form.role === 'employee' || form.role === 'projectmanager' || form.role === 'teamlead') ? ownDepartmentId : '')
      : form.department;
    const options = users.filter((u) => {
      if (!MANAGER_ROLES.has(u.role)) return false;
      if (!effectiveDepartment) return true;
      return Number(u.departmentId) === Number(effectiveDepartment);
    });

    if (editUser?.managerId) {
      const currentManager = users.find((u) => Number(u.id) === Number(editUser.managerId));
      if (currentManager && !options.some((u) => Number(u.id) === Number(currentManager.id))) {
        options.unshift(currentManager);
      }
    }

    return options;
  }, [users, form.department, form.role, isDepartmentHead, ownDepartmentId, editUser]);

  const subdivisionOptions = useMemo(() => {
    const effectiveDepartment = isDepartmentHead
      ? ((form.role === 'employee' || form.role === 'projectmanager' || form.role === 'teamlead') ? ownDepartmentId : (form.department || ownDepartmentId))
      : form.department;
    if (!effectiveDepartment) return subdivisions;
    return subdivisions.filter((s) => Number(s.department_id) === Number(effectiveDepartment));
  }, [subdivisions, form.department, form.role, isDepartmentHead, ownDepartmentId]);

  return (
    <MainLayout title="Админ-панель · Пользователи">
      <div className="page-header">
        <div>
          <div className="page-title">Пользователи</div>
          <div className="page-subtitle">{`Управление сотрудниками · ${filtered.length} из ${users.length}`}</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd} disabled={savingUser}><Plus size={15} /> Добавить</button>
      </div>

      {error ? <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: 'var(--danger)' }}>{error}</div></div> : null}

      {isSuperOrAdmin ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Заявки на перевод</span>
            <span className="badge badge-blue">{pending.length}</span>
          </div>
          <div className="card-body">
            {pending.length === 0 ? <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Новых заявок нет.</div> : null}
            {pending.map((req) => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{req.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{req.reason || 'Без комментария'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleApprove(req.id)}><Check size={14} /> Одобрить</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleReject(req.id)}><Ban size={14} /> Отклонить</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {(user?.role === 'admin' || user?.role === 'department_head' || user?.role === 'administrator' || user?.role === 'superadmin') ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Заявки стажеров на завершение</span>
            <span className="badge badge-blue">{pendingInternRequests.length}</span>
          </div>
          <div className="card-body">
            {pendingInternRequests.length === 0 ? <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Новых заявок нет.</div> : null}
            {pendingInternRequests.map((req) => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{req.username || `ID ${req.user}`}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    Отправлено: {String(req.requested_at || '').slice(0, 16).replace('T', ' ') || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => approveInternCompletion(req.id)}>
                    <Check size={14} /> Подтвердить в сотрудника
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: 32 }}
                placeholder="Поиск по имени, email, заметкам..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-select"
              style={{ flex: '0 1 180px' }}
              value={filterDept}
              onChange={(e) => { setFilterDept(e.target.value); setFilterSub(''); }}
            >
              <option value="">Все отделы</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select
              className="form-select"
              style={{ flex: '0 1 180px' }}
              value={filterSub}
              onChange={(e) => setFilterSub(e.target.value)}
            >
              <option value="">Все подотделы</option>
              {filterSubOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {(filterDept || filterSub || search) ? (
              <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFilterDept(''); setFilterSub(''); }}>
                <X size={13} /> Сбросить
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 16 }}>Загрузка...</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Отдел</th>
                  <th>Подотдел</th>
                  <th>Роль</th>
                  <th>Заметка</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>Пользователи не найдены</td></tr>
                ) : null}
                {filtered.map((u) => {
                  const badge = ROLE_BADGE[u.role] || { bg: '#F3F4F6', color: '#6B7280' };
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                            {(u.name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="user-cell-name">{u.name}</div>
                            <div className="user-cell-email">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{u.department || '—'}</td>
                      <td style={{ fontSize: 13 }}>{u.subdivisionName || '—'}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td style={{ maxWidth: 160 }}>
                        {u.notes ? (
                          <span title={u.notes} style={{ fontSize: 12, color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MessageSquare size={12} color="var(--gray-400)" style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.notes}</span>
                          </span>
                        ) : <span style={{ color: 'var(--gray-300)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                          background: u.status === 'active' ? '#F0FDF4' : '#FEF2F2',
                          color: u.status === 'active' ? '#16A34A' : '#DC2626',
                        }}>
                          {u.status === 'active' ? 'Активен' : 'Заблокирован'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {canEdit(u) ? (
                            <button className="btn-icon" title="Редактировать" onClick={() => openEdit(u)}><Pencil size={14} /></button>
                          ) : null}
                          <button className="btn-icon" title="Блок/разблок" onClick={() => toggleStatus(u.id)}><Lock size={14} /></button>
                          {!isSuperOrAdmin && u.role === 'intern' ? (
                            <button className="btn-icon" title="Заявка на перевод" onClick={() => sendPromotion(u)}><Send size={14} /></button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal ? (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editUser ? 'Редактирование пользователя' : 'Новый пользователь'}</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Имя</label>
                  <input className="form-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                </div>
              </div>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <div className="form-group">
                  <label className="form-label">Отдел</label>
                  <select
                    className="form-select"
                    value={
                      isDepartmentHead
                        ? ((form.role === 'employee' || form.role === 'projectmanager' || form.role === 'teamlead') ? ownDepartmentId : '')
                        : form.department
                    }
                    onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                    disabled={isDepartmentHead}
                  >
                    <option value="">-</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Подотдел</label>
                  {form.role === 'intern' || form.role === 'employee' ? (
                    <select
                      className="form-select"
                      value={form.subdivision}
                      onChange={(e) => setForm((prev) => ({ ...prev, subdivision: e.target.value }))}
                    >
                      <option value="">-</option>
                      {subdivisionOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="form-input" value={fixedSubdivisionLabelByRole(form.role) || '-'} disabled />
                  )}
                </div>
              </div>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <div className="form-group">
                  <label className="form-label">Роль</label>
                  <select
                    className="form-select"
                    value={form.role}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        role: nextRole,
                        manager: (nextRole === 'projectmanager' || nextRole === 'teamlead') ? '' : prev.manager,
                        subdivision: (nextRole === 'intern' || nextRole === 'employee') ? prev.subdivision : '',
                      }));
                    }}
                  >
                    <option value="intern">Стажер</option>
                    <option value="employee">Сотрудник</option>
                    <option value="projectmanager">Тимлид / Менеджер проекта</option>
                    {canAssignAdminRoles ? <option value="admin">Руководитель подразделения</option> : null}
                    {isSuperOrAdmin ? <option value="administrator">Администратор</option> : null}
                    {isSuperAdmin ? <option value="superadmin">Суперадмин</option> : null}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Пароль {editUser ? '(опционально)' : ''}</label>
                  <input className="form-input" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
                </div>
              </div>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <div className="form-group">
                  <label className="form-label">Руководитель</label>
                  <select
                    className="form-select"
                    value={form.manager}
                    onChange={(e) => setForm((prev) => ({ ...prev, manager: e.target.value }))}
                    disabled={form.role === 'projectmanager' || form.role === 'teamlead'}
                  >
                    <option value="">— не выбрано —</option>
                    {managerOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {ROLE_LABELS[m.role] ? `(${ROLE_LABELS[m.role]})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Текущий руководитель</label>
                  <input
                    className="form-input"
                    value={editUser?.managerName || '—'}
                    disabled
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 10 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={13} /> Заметки / комментарий
                </label>
                <textarea
                  className="form-input"
                  style={{ resize: 'vertical', minHeight: 72, fontFamily: 'inherit', fontSize: 13 }}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Внутренние заметки (видны только администраторам)"
                  rows={3}
                />
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={saveUser} disabled={savingUser || !form.name || !form.email}>
                {savingUser ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
}
