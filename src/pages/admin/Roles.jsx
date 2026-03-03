import { useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { ROLES } from '../../data/mockData';
import { Plus, MoreVertical, Pencil, Trash2, X } from 'lucide-react';

export default function AdminRoles() {
  const [roles, setRoles] = useState(ROLES);
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [form, setForm] = useState({ name: '', desc: '', perms: '' });

  const openAdd = () => { setEditRole(null); setForm({ name: '', desc: '', perms: '' }); setShowModal(true); };
  const openEdit = (r) => { setEditRole(r); setForm({ name: r.name, desc: r.desc, perms: r.perms.join(', ') }); setShowModal(true); };

  const handleSave = () => {
    const newRole = { id: form.name.toLowerCase().replace(' ', '_'), ...form, perms: form.perms.split(',').map(p => p.trim()).filter(Boolean), count: 0, isSystem: false };
    if (editRole) setRoles(rs => rs.map(r => r.id === editRole.id ? { ...r, ...newRole, id: r.id } : r));
    else setRoles(rs => [...rs, newRole]);
    setShowModal(false);
  };

  const deleteRole = (id) => setRoles(rs => rs.filter(r => r.id !== id));

  return (
    <MainLayout title="Управление системой">
      <div className="page-header">
        <div>
          <div className="page-title">Роли и права доступа</div>
          <div className="page-subtitle">Управление шаблонами доступа для сотрудников компании</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Создать роль</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {roles.map(role => (
          <div key={role.id} className="card">
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{role.id === 'superadmin' ? '👑' : role.id === 'intern' ? '📖' : '🛡️'}</span>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{role.name}</span>
                  {role.isSystem && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>🔒</span>}
                </div>
                {!role.isSystem && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" onClick={() => openEdit(role)}><Pencil size={13} /></button>
                    <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => deleteRole(role.id)}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14, lineHeight: 1.5 }}>{role.desc}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {role.perms.map(p => (
                  <span key={p} className="badge badge-blue" style={{ fontSize: 11 }}>{p}</span>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  👤 {role.count} пользователей
                </span>
                {role.isSystem && <span style={{ fontSize: 12, color: 'var(--primary)' }}>Системная роль</span>}
                {!role.isSystem && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(role)}>Изменить</button>
                    <button className="btn btn-sm" style={{ color: 'var(--danger)', border: '1px solid var(--danger)', background: 'none' }} onClick={() => deleteRole(role.id)}>Удалить</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editRole ? 'Редактировать роль' : 'Создать роль'}</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Название роли</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Например: Контент-менеджер" />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Описание</label>
                <textarea className="form-textarea" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="Опишите обязанности и доступ данной роли" style={{ minHeight: 80 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Права (через запятую)</label>
                <input className="form-input" value={form.perms} onChange={e => setForm(f => ({ ...f, perms: e.target.value }))} placeholder="Управление контентом, Регламенты, ..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={handleSave}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
