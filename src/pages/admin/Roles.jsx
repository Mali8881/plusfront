import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { rolesAPI, usersAPI } from '../../api/auth';

const ROLE_META = {
  superadmin: {
    label: 'Суперадмин',
    icon: 'SA',
    desc: 'Полный доступ ко всей системе, включая системные разделы.',
    perms: ['Все права', 'Система/Безопасность', 'Интерфейс'],
    fixed: true,
  },
  administrator: {
    label: 'Администратор',
    icon: 'AD',
    desc: 'Операционное управление: пользователи, зарплаты, онбординг, контент.',
    perms: ['Пользователи', 'Зарплаты', 'Онбординг', 'Контент', 'Графики', 'Обратная связь'],
    fixed: true,
  },
  admin: {
    label: 'Админ',
    icon: 'AM',
    desc: 'Почти полный доступ, кроме системных разделов.',
    perms: ['Пользователи', 'Роли', 'Контент', 'Графики', 'Обратная связь'],
    fixed: true,
  },
  department_head: {
    label: 'Руководитель отдела',
    icon: 'RО',
    desc: 'Управление сотрудниками своего отдела и операционными процессами.',
    perms: ['Пользователи отдела', 'Графики', 'Обратная связь'],
    fixed: true,
  },
  projectmanager: {
    label: 'Тимлид',
    icon: 'ТЛ',
    desc: 'Управление задачами команды и просмотр отчетов подчиненных.',
    perms: ['Задачи команды', 'Отчеты команды'],
    fixed: true,
  },
  employee: {
    label: 'Сотрудник',
    icon: 'СО',
    desc: 'Работа в личном кабинете: задачи, график, отчеты.',
    perms: ['Личный кабинет', 'Задачи', 'График'],
    fixed: true,
  },
  intern: {
    label: 'Стажер',
    icon: 'СТ',
    desc: 'Прохождение программы адаптации и отчеты стажировки.',
    perms: ['Онбординг', 'Отчеты'],
    fixed: true,
  },
};

const EMPTY_FORM = { name: '', description: '', permissions: '' };

function extractErrorMessage(e, fallback) {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    const firstKey = Object.keys(data)[0];
    const firstVal = data[firstKey];
    if (Array.isArray(firstVal) && firstVal.length) return String(firstVal[0]);
    if (typeof firstVal === 'string') return firstVal;
  }
  return fallback;
}

function normalizeRoleKey(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (!normalized) return 'employee';
  if (normalized === 'SUPER_ADMIN' || normalized === 'SUPERADMIN') return 'superadmin';
  if (normalized === 'ADMINISTRATOR') return 'administrator';
  if (normalized === 'ADMIN') return 'admin';
  if (normalized === 'DEPARTMENT_HEAD' || normalized === 'DEPARTMENTHEAD') return 'department_head';
  if (normalized === 'TEAMLEAD' || normalized === 'PROJECTMANAGER' || normalized === 'PROJECT_MANAGER') return 'projectmanager';
  if (normalized === 'EMPLOYEE') return 'employee';
  if (normalized === 'INTERN') return 'intern';
  return normalized.toLowerCase();
}

export default function AdminRoles() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, rolesRes] = await Promise.all([usersAPI.list(), rolesAPI.list()]);
      setUsers(Array.isArray(usersRes?.data) ? usersRes.data : []);
      setRoles(Array.isArray(rolesRes?.data) ? rolesRes.data : []);
    } catch (e) {
      setError(extractErrorMessage(e, 'Не удалось загрузить данные страницы.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const roleCards = useMemo(() => {
    const counts = users.reduce((acc, user) => {
      const key = normalizeRoleKey(user.role);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    // System roles
    const systemCards = Object.entries(ROLE_META).map(([id, meta]) => ({
      id,
      apiId: null,
      ...meta,
      count: counts[id] || 0,
    }));

    // Custom roles from API (not in ROLE_META)
    const customCards = roles
      .filter((r) => !ROLE_META[normalizeRoleKey(r.name)])
      .map((r) => ({
        id: normalizeRoleKey(r.name),
        apiId: r.id,
        label: r.name,
        icon: String(r.name || '').slice(0, 2).toUpperCase(),
        desc: r.description || 'Пользовательская роль',
        perms: r.permissions ? String(r.permissions).split(',').map((p) => p.trim()).filter(Boolean) : [],
        count: counts[normalizeRoleKey(r.name)] || 0,
        fixed: false,
      }));

    return [...systemCards, ...customCards];
  }, [roles, users]);

  const openCreate = () => {
    setEditRole(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (card) => {
    setEditRole(card);
    setForm({
      name: card.label,
      description: card.desc,
      permissions: card.perms.join(', '),
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditRole(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Введите название роли.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        permissions: form.permissions.trim(),
      };
      if (editRole?.apiId) {
        await rolesAPI.update(editRole.apiId, payload);
      } else {
        await rolesAPI.create(payload);
      }
      closeModal();
      await loadAll();
    } catch (e) {
      setFormError(extractErrorMessage(e, 'Не удалось сохранить роль.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (card) => {
    if (!card.apiId) return;
    if (!window.confirm(`Удалить роль «${card.label}»? Пользователи с этой ролью останутся без изменений.`)) return;
    setDeleteId(card.apiId);
    setDeleting(true);
    try {
      await rolesAPI.delete(card.apiId);
      await loadAll();
    } catch (e) {
      setError(extractErrorMessage(e, 'Не удалось удалить роль.'));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <MainLayout title="Роли и права">
      <div className="page-header">
        <div>
          <div className="page-title">Роли и права доступа</div>
          <div className="page-subtitle">Системные роли и пользовательские роли организации</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={14} /> Создать роль
        </button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ color: '#b91c1c' }}>{error}</div>
        </div>
      )}
      {loading && <div className="card"><div className="card-body">Загрузка...</div></div>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {roleCards.map((role) => (
            <div key={role.id} className="card">
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 6px',
                        background: 'var(--primary)', color: 'white', borderRadius: 4,
                      }}
                    >
                      {role.icon}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{role.label}</span>
                    {role.fixed && (
                      <span style={{ fontSize: 10, color: 'var(--gray-400)', border: '1px solid var(--gray-200)', borderRadius: 4, padding: '1px 5px' }}>
                        системная
                      </span>
                    )}
                  </div>
                  {!role.fixed && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(role)}
                        title="Редактировать"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                        onClick={() => handleDelete(role)}
                        disabled={deleting && deleteId === role.apiId}
                        title="Удалить"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14, lineHeight: 1.5 }}>{role.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {role.perms.map((perm) => (
                    <span key={perm} className="badge badge-blue" style={{ fontSize: 11 }}>{perm}</span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Пользователей: {role.count}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="card" style={{ width: 480, maxWidth: '95vw', margin: 0 }}>
            <div className="card-header">
              <span className="card-title">{editRole ? 'Редактировать роль' : 'Создать роль'}</span>
              <button className="btn btn-secondary btn-sm" onClick={closeModal}><X size={14} /></button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Название роли *</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Например: HR-менеджер"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Описание</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Кратко опишите роль"
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Права доступа (через запятую)</label>
                <input
                  className="form-input"
                  value={form.permissions}
                  onChange={(e) => setForm((f) => ({ ...f, permissions: e.target.value }))}
                  placeholder="Пользователи, Контент, Задачи"
                />
              </div>
              {formError && <div style={{ color: '#b91c1c', fontSize: 13 }}>{formError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn-secondary" onClick={closeModal}>Отмена</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
