import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { departmentsAPI, orgAPI, positionsAPI, subdivisionsAPI, usersAPI } from '../../api/auth';
import { normalizeRole } from '../../utils/roles';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';

const NODE_COLORS = ['#D9F99D', '#FDE68A', '#C4B5FD', '#F9A8D4', '#93C5FD', '#67E8F9', '#FCA5A5', '#FDBA74'];

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
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

function normalizeDepartment(raw) {
  return {
    id: raw.id,
    name: raw.name || raw.title || `Отдел #${raw.id}`,
    parentId: raw.parent || raw.parent_id || raw.parent_department || 0,
    headName: raw.head_name || raw.manager_name || raw.lead_name || raw.head?.full_name || '',
    headRole: raw.head_role || raw.manager_role || raw.head?.role || '',
    comment: raw.comment || '',
    childrenCount: Number(raw.children_count ?? raw.subdivisions_count ?? raw.children?.length ?? 0),
  };
}

function roleLabelRu(role) {
  const r = normalizeRole(role);
  if (r === 'superadmin') return 'Суперадминистратор';
  if (r === 'administrator') return 'Администратор';
  if (r === 'admin') return 'Админ';
  if (r === 'systemadmin') return 'Системный администратор';
  if (r === 'projectmanager') return 'Руководитель проекта';
  if (r === 'intern') return 'Стажер';
  return 'Сотрудник';
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
    username: raw.username || '',
    email: raw.email || '',
    name,
    role,
    roleLabel: raw.role_label || roleLabelRu(role),
    department: raw.department_name || raw.department || '',
    departmentId: raw.department_id || (typeof raw.department === 'number' ? raw.department : null),
    position: raw.position_name || raw.position || '',
    positionId: raw.position_id || (typeof raw.position === 'number' ? raw.position : null),
    phone: raw.phone || '',
    telegram: raw.telegram || '',
    photo: raw.photo || '',
  };
}

export default function Company() {
  const { user } = useAuth();
  const { t } = useLocale();
  const role = normalizeRole(user?.role);
  const canEditStructure = role === 'admin' || role === 'administrator' || role === 'superadmin';
  const canEditMemberProfile = false;

  const [tab, setTab] = useState('structure');
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [positionOptions, setPositionOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [savingNode, setSavingNode] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [modalError, setModalError] = useState('');

  const [selectedMember, setSelectedMember] = useState(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    telegram: '',
    department: '',
    position: '',
    photoFile: null,
  });
  const [savingMember, setSavingMember] = useState(false);
  const [nodeModal, setNodeModal] = useState({ open: false, mode: 'create-subdivision', department: null });
  const [nodeForm, setNodeForm] = useState({ name: '', parent: '', comment: '', isActive: true });

  const fetchCompanyData = async () => {
    const structureRes = await orgAPI.structure();
    const payload = structureRes?.data || {};
    const depRows = safeList(payload.departments);
    const normalizedDeps = depRows.map(normalizeDepartment);
    let normalizedUsers = [];
    try {
      const usersRes = await usersAPI.list();
      normalizedUsers = safeList(usersRes?.data).map(normalizeUser);
    } catch {
      normalizedUsers = [];
    }
    if (normalizedUsers.length === 0) {
      const flatUsers = [];
      depRows.forEach((dep) => {
        safeList(dep?.members).forEach((member) => {
          flatUsers.push({
            ...member,
            department_name: dep.name,
            department_id: dep.id,
          });
        });
      });
      normalizedUsers = flatUsers.map(normalizeUser);
    }

    let deps = [];
    let poss = [];
    if (canEditStructure) {
      const [depRes, posRes] = await Promise.all([departmentsAPI.list(), positionsAPI.list()]);
      deps = safeList(depRes?.data).map((d) => ({ id: d.id, name: d.name || String(d.id) }));
      poss = safeList(posRes?.data).map((p) => ({ id: p.id, name: p.name || String(p.id) }));
    }

    return {
      normalizedDeps,
      normalizedUsers,
      deps,
      poss,
    };
  };

  const reload = async () => {
    const { normalizedDeps, normalizedUsers, deps, poss } = await fetchCompanyData();
    setUsers(normalizedUsers);
    setDepartments(normalizedDeps);
    setDepartmentOptions(deps);
    setPositionOptions(poss);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { normalizedDeps, normalizedUsers, deps, poss } = await fetchCompanyData();
        if (!mounted) return;
        setUsers(normalizedUsers);
        setDepartments(normalizedDeps);
        setDepartmentOptions(deps);
        setPositionOptions(poss);
      } catch (err) {
        if (!mounted) return;
        setUsers([]);
        setDepartments([]);
        if (err?.response?.status === 403) {
          setError('Редактирование структуры недоступно для вашей роли.');
        } else {
          setError(err?.response?.data?.detail || 'Не удалось загрузить данные компании');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const mapStructureError = (err, fallback) => {
    const status = Number(err?.response?.status || 0);
    const data = err?.response?.data;
    if (status === 403) return 'Недостаточно прав';
    if (status === 409) return 'К отделу привязаны пользователи';
    if (status === 400) {
      const parentError = data?.parent;
      if (parentError) return 'Подраздел должен иметь родительский отдел';
    }
    return err?.response?.data?.detail || fallback;
  };

  const openCreateSubdivision = () => {
    setModalError('');
    setNodeModal({ open: true, mode: 'create-subdivision', department: null });
    setNodeForm({ name: '', parent: '', comment: '', isActive: true });
  };

  const openEditNode = (dep) => {
    setModalError('');
    setNodeModal({ open: true, mode: 'edit-node', department: dep });
    setNodeForm({
      name: dep?.name || '',
      parent: dep?.parentId ? String(dep.parentId) : '',
      comment: dep?.comment || '',
      isActive: true,
    });
  };

  const closeNodeModal = () => {
    setNodeModal({ open: false, mode: 'create-subdivision', department: null });
    setNodeForm({ name: '', parent: '', comment: '', isActive: true });
  };

  const submitNodeModal = async () => {
    const name = nodeForm.name.trim();
    if (!name) {
      setModalError('Введите название');
      return;
    }
    if (nodeModal.mode === 'create-subdivision' && !nodeForm.parent) {
      setModalError('Подраздел должен иметь родительский отдел');
      return;
    }

    setSavingNode(true);
    setModalError('');
    setError('');
    setActionMessage('');
    try {
      const payload = {
        name,
        parent: nodeForm.parent ? Number(nodeForm.parent) : null,
        comment: nodeForm.comment.trim(),
        is_active: Boolean(nodeForm.isActive),
      };

      if (nodeModal.mode === 'create-subdivision') {
        await subdivisionsAPI.create(payload);
        setActionMessage('Подраздел успешно добавлен');
      } else {
        await departmentsAPI.update(nodeModal.department.id, payload);
        setActionMessage('Подразделение обновлено');
      }

      await reload();
      closeNodeModal();
    } catch (err) {
      const msg = mapStructureError(err, 'Не удалось сохранить подразделение');
      setModalError(msg);
      setError(msg);
    } finally {
      setSavingNode(false);
    }
  };

  const handleAddDepartment = async () => {
    const name = newDepartmentName.trim();
    if (!name) {
      setError('Введите название отдела');
      return;
    }
    setSavingDepartment(true);
    setError('');
    setActionMessage('');
    try {
      await departmentsAPI.create({ name });
      await reload();
      setNewDepartmentName('');
      setActionMessage('Отдел успешно добавлен');
    } catch (err) {
      setError(mapStructureError(err, 'Не удалось добавить отдел'));
    } finally {
      setSavingDepartment(false);
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm('Удалить отдел?')) return;
    setSavingDepartment(true);
    setError('');
    setActionMessage('');
    try {
      await departmentsAPI.delete(id);
      await reload();
      setActionMessage('Отдел удален');
    } catch (err) {
      setError(mapStructureError(err, 'Не удалось удалить отдел'));
    } finally {
      setSavingDepartment(false);
    }
  };

  const allStaff = useMemo(() => {
    const seen = new Set();
    return users.filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }, [users]);

  const filterByControls = (u) => {
    const q = debouncedQuery;
    const matchesQuery =
      !q ||
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.username || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q) ||
      String(u.position || '').toLowerCase().includes(q) ||
      String(u.department || '').toLowerCase().includes(q);
    const matchesDepartment =
      departmentFilter === 'all' ||
      String(u.departmentId || '') === String(departmentFilter) ||
      String(u.department || '').toLowerCase() === String(departmentFilter || '').toLowerCase();
    const matchesRole = roleFilter === 'all' || normalizeRole(u.role) === roleFilter;
    return matchesQuery && matchesDepartment && matchesRole;
  };

  const filteredStaff = useMemo(() => allStaff.filter(filterByControls), [allStaff, debouncedQuery, departmentFilter, roleFilter]);

  const byParent = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => {
      const key = Number(d.parentId || 0);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    });
    return map;
  }, [departments]);

  const rootDepartments = byParent.get(0) || [];
  const secondLevel = rootDepartments.flatMap((d) => byParent.get(Number(d.id)) || []);
  const effectiveSecondLevel = secondLevel.length > 0 ? secondLevel : departments;
  const filteredDepartments = useMemo(() => {
    if (departmentFilter === 'all') return effectiveSecondLevel;
    return effectiveSecondLevel.filter((d) => String(d.id) === String(departmentFilter) || String(d.name).toLowerCase() === String(departmentFilter).toLowerCase());
  }, [effectiveSecondLevel, departmentFilter]);

  const getDeptStaff = (deptName) => {
    const needle = String(deptName || '').toLowerCase();
    return filteredStaff.filter((e) => String(e.department || '').toLowerCase().includes(needle.slice(0, 5)));
  };

  const directorName = useMemo(() => {
    const chief = allStaff.find((e) => ['superadmin', 'administrator', 'admin'].includes(e.role));
    if (chief) return chief.name;
    const depHead = departments.find((d) => d.headName)?.headName;
    return depHead || '—';
  }, [allStaff, departments]);

  const headForDepartment = (dep) => {
    if (dep.headName) return { name: dep.headName, role: dep.headRole || 'Руководитель' };
    const staff = allStaff.filter((e) => String(e.department || '').toLowerCase() === String(dep.name || '').toLowerCase());
    const manager = staff.find((e) => ['superadmin', 'administrator', 'admin', 'projectmanager'].includes(e.role));
    if (manager) return { name: manager.name, role: manager.position || manager.roleLabel || 'Руководитель' };
    if (staff.length > 0) return { name: staff[0].name, role: staff[0].position || staff[0].roleLabel || 'Сотрудник' };
    return { name: '—', role: '—' };
  };

  const openMember = (member) => {
    setModalError('');
    setSelectedMember(member);
    setMemberForm({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      telegram: member.telegram || '',
      department: member.departmentId || '',
      position: member.positionId || '',
      photoFile: null,
    });
  };

  const saveMember = async () => {
    if (!selectedMember) return;
    setSavingMember(true);
    setModalError('');
    setError('');
    setActionMessage('');
    try {
      const payload = {
        full_name: memberForm.name.trim(),
        email: memberForm.email.trim(),
        username: memberForm.email.trim() || selectedMember.username,
        phone: memberForm.phone.trim(),
        telegram: memberForm.telegram.trim(),
        department: memberForm.department ? Number(memberForm.department) : null,
        position: memberForm.position ? Number(memberForm.position) : null,
      };

      if (memberForm.photoFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== null && v !== undefined) fd.append(k, String(v));
        });
        fd.append('photo', memberForm.photoFile);
        await usersAPI.update(selectedMember.id, fd);
      } else {
        await usersAPI.update(selectedMember.id, payload);
      }

      await reload();
      setActionMessage('Профиль сотрудника обновлен');
      setSelectedMember(null);
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Не удалось обновить сотрудника';
      setModalError(msg);
      setError(msg);
    } finally {
      setSavingMember(false);
    }
  };

  return (
    <MainLayout title={t('company.title', 'Компания')}>
      <div className="page-header">
        <div>
          <div className="page-title">{t('company.title', 'Компания')}</div>
          <div className="page-subtitle">{t('company.subtitle', 'Структура компании и сотрудники')}</div>
        </div>
      </div>

      {error && <div style={{ marginBottom: 14, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
      {actionMessage && <div style={{ marginBottom: 14, color: 'var(--success)', fontSize: 13 }}>{actionMessage}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <input
            className="form-input"
            placeholder={t('company.search.placeholder', 'Поиск: ФИО, логин, email, должность, отдел...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="form-select" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="all">{t('company.filter.all_departments', 'Все отделы')}</option>
            {departments.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.name}
              </option>
            ))}
          </select>
          <select className="form-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">{t('company.filter.all_roles', 'Все роли')}</option>
            <option value="superadmin">{t('company.role.superadmin', 'Суперадминистратор')}</option>
            <option value="administrator">{t('company.role.administrator', 'Администратор')}</option>
            <option value="admin">{t('company.role.admin', 'Админ')}</option>
            <option value="projectmanager">{t('company.role.projectmanager', 'Руководитель проекта')}</option>
            <option value="employee">{t('company.role.employee', 'Сотрудник')}</option>
            <option value="intern">{t('company.role.intern', 'Стажер')}</option>
          </select>
        </div>
      </div>

      {canEditStructure && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className="card-title">{t('company.manage_departments', 'Управление отделами')}</span>
            <button className="btn btn-primary btn-sm" onClick={openCreateSubdivision} disabled={savingNode}>
              Добавить подраздел
            </button>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                placeholder={t('company.new_department_placeholder', 'Название нового отдела')}
                value={newDepartmentName}
                onChange={(e) => setNewDepartmentName(e.target.value)}
                disabled={savingDepartment}
              />
              <button className="btn btn-primary btn-sm" onClick={handleAddDepartment} disabled={savingDepartment}>
                {t('company.btn.add_department', 'Добавить отдел')}
              </button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('company.table.department', 'Отдел')}</th>
                    <th>Комментарий</th>
                    <th>{t('company.table.actions', 'Действия')}</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dep) => (
                    <tr key={`dep-row-${dep.id}`}>
                      <td>{dep.name}</td>
                      <td>{dep.comment || '—'}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditNode(dep)} disabled={savingDepartment || savingNode} style={{ marginRight: 8 }}>
                          Редактировать
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDeleteDepartment(dep.id)} disabled={savingDepartment}>
                          {t('common.delete', 'Удалить')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab-btn ${tab === 'structure' ? 'active' : ''}`} onClick={() => setTab('structure')}>
          {t('company.tab.structure', 'Структура')}
        </button>
        <button className={`tab-btn ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>
          {t('company.tab.employees', 'Сотрудники')}
        </button>
      </div>

      {tab === 'structure' && (
        <div className="card">
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 980 }}>
              <div style={{ textAlign: 'center', fontSize: 36, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 12 }}>{t('company.structure_title', 'Структура компании \"В Плюсе\"')}</div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                <div style={{ background: '#A3E635', border: '1px solid #84CC16', borderRadius: 10, padding: '10px 14px', minWidth: 240, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t('company.ceo', 'Генеральный директор')}</div>
                  <div style={{ fontSize: 12 }}>{directorName}</div>
                </div>
              </div>

              {loading ? (
                <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>{t('common.loading', 'Загрузка...')}</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, filteredDepartments.length)}, minmax(170px, 1fr))`, gap: 10 }}>
                  {filteredDepartments.map((dep, i) => {
                    const staff = getDeptStaff(dep.name);
                    const head = headForDepartment(dep);
                    return (
                      <div key={dep.id} style={{ background: NODE_COLORS[i % NODE_COLORS.length], border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: 10, minHeight: 220 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{dep.name}</div>
                          {canEditStructure && (
                            <button className="btn btn-secondary btn-sm" onClick={() => openEditNode(dep)}>
                              Редактировать
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 12, marginBottom: 8 }}>
                          {head.name} - {head.role}
                        </div>
                        {dep.comment ? <div style={{ fontSize: 11, marginBottom: 6, opacity: 0.85 }}>{dep.comment}</div> : null}
                        <div style={{ marginBottom: 8 }}>
                          <span className="badge badge-blue">Подразделов: {dep.childrenCount || 0}</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>{t('company.employees_block', 'Сотрудники')}</div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {staff.length === 0 && <div style={{ fontSize: 12, opacity: 0.7 }}>{t('company.no_employees', 'Нет сотрудников')}</div>}
                          {staff.slice(0, 8).map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => openMember(s)}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '32px 1fr',
                                alignItems: 'center',
                                gap: 8,
                                textAlign: 'left',
                                background: 'rgba(255,255,255,0.7)',
                                border: '1px solid rgba(0,0,0,0.08)',
                                borderRadius: 8,
                                padding: '6px 7px',
                                cursor: 'pointer',
                              }}
                            >
                              {s.photo ? (
                                <img src={s.photo} alt={s.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E5E7EB', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>
                                  {initials(s.name)}
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                                <div style={{ fontSize: 11 }}>{s.position || '—'}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'employees' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('company.company_employees', 'Сотрудники компании')}</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('company.table.photo', 'ФОТО')}</th>
                  <th>{t('company.table.employee', 'СОТРУДНИК')}</th>
                  <th>{t('company.table.department', 'ОТДЕЛ')}</th>
                  <th>{t('company.table.position', 'ДОЛЖНОСТЬ')}</th>
                  <th>{t('company.table.role', 'РОЛЬ')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} style={{ color: 'var(--gray-500)' }}>
                      {t('common.loading', 'Загрузка...')}
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredStaff.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.photo ? (
                          <img src={u.photo} alt={u.name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#E5E7EB', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>
                            {initials(u.name)}
                          </div>
                        )}
                      </td>
                      <td>{u.name}</td>
                      <td>{u.department || '—'}</td>
                      <td>{u.position || '—'}</td>
                      <td>{u.roleLabel || u.role}</td>
                    </tr>
                  ))}
                {!loading && filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ color: 'var(--gray-500)' }}>
                      {t('company.empty_filtered', 'По текущим фильтрам сотрудники не найдены.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {nodeModal.open && (
        <div className="modal-overlay" onClick={closeNodeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{nodeModal.mode === 'create-subdivision' ? 'Добавить подраздел' : 'Редактировать подразделение'}</div>
              <button className="btn-icon" onClick={closeNodeModal}>x</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Название</label>
                <input
                  className="form-input"
                  value={nodeForm.name}
                  onChange={(e) => setNodeForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Родительский отдел</label>
                <select
                  className="form-select"
                  value={nodeForm.parent}
                  onChange={(e) => setNodeForm((f) => ({ ...f, parent: e.target.value }))}
                >
                  <option value="">—</option>
                  {departments
                    .filter((d) => String(d.id) !== String(nodeModal.department?.id || ''))
                    .map((dep) => (
                      <option key={`parent-option-${dep.id}`} value={dep.id}>
                        {dep.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Комментарий</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={nodeForm.comment}
                  onChange={(e) => setNodeForm((f) => ({ ...f, comment: e.target.value }))}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={Boolean(nodeForm.isActive)}
                  onChange={(e) => setNodeForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Активен
              </label>
              {modalError && <div style={{ marginTop: 8, color: 'var(--danger)', fontSize: 12 }}>{modalError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeNodeModal}>Отмена</button>
              <button className="btn btn-primary" onClick={submitNodeModal} disabled={savingNode}>
                {savingNode ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedMember && (
        <div className="modal-overlay" onClick={() => setSelectedMember(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t('company.member_profile', 'Профиль сотрудника')}</div>
              <button className="btn-icon" onClick={() => setSelectedMember(null)}>x</button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  {selectedMember.photo ? (
                    <img src={selectedMember.photo} alt={selectedMember.name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#E5E7EB', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                      {initials(selectedMember.name)}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedMember.name}</div>
                  <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>{selectedMember.roleLabel}</div>
                  <div style={{ color: 'var(--gray-500)', fontSize: 12, marginTop: 4 }}>Только просмотр</div>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 10 }}>
                <div className="form-group">
                  <label className="form-label">{t('company.field.full_name', 'ФИО')}</label>
                  <input className="form-input" value={memberForm.name} onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))} disabled={!canEditMemberProfile} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={memberForm.email} onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))} disabled={!canEditMemberProfile} />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 10 }}>
                <div className="form-group">
                  <label className="form-label">{t('company.field.phone', 'Телефон')}</label>
                  <input className="form-input" value={memberForm.phone} onChange={(e) => setMemberForm((f) => ({ ...f, phone: e.target.value }))} disabled={!canEditMemberProfile} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telegram</label>
                  <input className="form-input" value={memberForm.telegram} onChange={(e) => setMemberForm((f) => ({ ...f, telegram: e.target.value }))} disabled={!canEditMemberProfile} />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 10 }}>
                <div className="form-group">
                  <label className="form-label">{t('company.field.department', 'Отдел')}</label>
                  <select className="form-select" value={memberForm.department} onChange={(e) => setMemberForm((f) => ({ ...f, department: e.target.value }))} disabled={!canEditMemberProfile}>
                    <option value="">—</option>
                    {departmentOptions.map((dep) => (
                      <option key={dep.id} value={dep.id}>{dep.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('company.field.position', 'Должность')}</label>
                  <select className="form-select" value={memberForm.position} onChange={(e) => setMemberForm((f) => ({ ...f, position: e.target.value }))} disabled={!canEditMemberProfile}>
                    <option value="">—</option>
                    {positionOptions.map((pos) => (
                      <option key={pos.id} value={pos.id}>{pos.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {canEditMemberProfile && (
                <div className="form-group">
                  <label className="form-label">{t('company.field.photo', 'Фото')}</label>
                  <input type="file" accept="image/*" className="form-input" onChange={(e) => setMemberForm((f) => ({ ...f, photoFile: e.target.files?.[0] || null }))} />
                </div>
              )}
              {modalError && (
                <div style={{ marginTop: 8, color: 'var(--danger)', fontSize: 12 }}>
                  {modalError}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedMember(null)}>{t('common.close', 'Закрыть')}</button>
              {canEditMemberProfile && (
                <button className="btn btn-primary" onClick={saveMember} disabled={savingMember}>
                  {savingMember ? t('common.saving', 'Сохранение...') : t('common.save', 'Сохранить')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
