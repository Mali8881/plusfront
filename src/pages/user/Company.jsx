import { useEffect, useMemo, useState } from 'react';
import { X, Pencil } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { companyAPI } from '../../api/content';
import { usersAPI, departmentsAPI } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

const DEPT_COLORS = [
  { bg: '#FEF9C3', border: '#EAB308', badge: '#854D0E' },
  { bg: '#DCFCE7', border: '#22C55E', badge: '#14532D' },
  { bg: '#EDE9FE', border: '#8B5CF6', badge: '#4C1D95' },
  { bg: '#FCE7F3', border: '#EC4899', badge: '#831843' },
  { bg: '#DBEAFE', border: '#3B82F6', badge: '#1E3A8A' },
  { bg: '#CFFAFE', border: '#06B6D4', badge: '#164E63' },
  { bg: '#FEE2E2', border: '#EF4444', badge: '#7F1D1D' },
  { bg: '#FED7AA', border: '#F97316', badge: '#7C2D12' },
];

const ROLE_LABELS = {
  projectmanager: 'Тимлид',
  teamlead: 'Тимлид',
  department_head: 'Руководитель',
  employee: 'Сотрудник',
  intern: 'Стажер',
  admin: 'Администратор',
  administrator: 'Администратор',
  superadmin: 'Суперадмин',
};

function roleWeight(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'department_head') return 0;
  if (r === 'projectmanager' || r === 'teamlead') return 1;
  if (r === 'employee') return 2;
  if (r === 'intern') return 3;
  return 99;
}

function sortMembers(list) {
  return [...list].sort((a, b) => {
    const byRole = roleWeight(a.role) - roleWeight(b.role);
    if (byRole !== 0) return byRole;
    return (a.full_name || '').localeCompare(b.full_name || '', 'ru');
  });
}

function Avatar({ name, photo, size = 40, bg = '#6B7280', style = {} }) {
  const initials = (name || '?').split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: photo ? 'transparent' : bg,
      overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: Math.round(size * 0.36),
      border: '2px solid rgba(255,255,255,0.9)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      ...style,
    }}>
      {photo
        ? <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  );
}

// ─── connector line styles ────────────────────────────────────────────────────
const LINE_COLOR = '#CBD5E1';

function VLine({ height = 28 }) {
  return <div style={{ width: 2, height, background: LINE_COLOR, margin: '0 auto' }} />;
}

// ─── Member mini-card (inside dept box) ──────────────────────────────────────
function MemberCard({ member, usersById, onClick }) {
  const profile = usersById.get(Number(member.id)) || {};
  return (
    <button
      type="button"
      onClick={() => onClick({ ...member, ...profile })}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 8,
        background: 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(0,0,0,0.08)',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; }}
    >
      <Avatar name={member.full_name || member.username} photo={profile.photo} size={32} bg="#94A3B8" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {member.full_name || member.username}
        </div>
        <div style={{ fontSize: 11, color: '#64748B' }}>
          {ROLE_LABELS[member.role] || member.role || '—'}
        </div>
      </div>
    </button>
  );
}

// ─── Department node ──────────────────────────────────────────────────────────
function DeptNode({ dep, index, members, usersById, onMemberClick, canEdit, onEditComment }) {
  const c = DEPT_COLORS[index % DEPT_COLORS.length];
  const head = dep.head || members.find((m) => m.role === 'department_head') || null;
  const others = members.filter((m) => m.id !== head?.id);
  const headProfile = head ? (usersById.get(Number(head.id)) || {}) : {};

  return (
    <div style={{
      background: c.bg,
      border: `2px solid ${c.border}`,
      borderRadius: 12,
      minWidth: 200,
      maxWidth: 240,
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${c.border}40` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'inline-block',
              background: c.badge, color: '#fff',
              fontSize: 10, fontWeight: 700, padding: '2px 8px',
              borderRadius: 20, marginBottom: 6, letterSpacing: '0.05em',
            }}>
              ОТДЕЛ
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
              {dep.name}
            </div>
            {dep.comment && (
              <div style={{ fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
                {dep.comment}
              </div>
            )}
          </div>
          {canEdit && (
            <button
              type="button"
              title="Редактировать описание"
              onClick={() => onEditComment(dep)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: c.badge, padding: 2, borderRadius: 4, flexShrink: 0,
                opacity: 0.6, transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Head */}
      {head && (
        <button
          type="button"
          onClick={() => onMemberClick({ ...head, ...headProfile })}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left', borderBottom: `1px solid ${c.border}30`,
          }}
        >
          <Avatar name={head.full_name || head.username} photo={headProfile.photo} size={36} bg={c.badge} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.badge, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Руководитель
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>
              {head.full_name || head.username}
            </div>
          </div>
        </button>
      )}

      {/* Members */}
      {others.length > 0 && (
        <div style={{ padding: '6px 8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {others.map((m) => (
            <MemberCard key={m.id} member={m} usersById={usersById} onClick={onMemberClick} />
          ))}
        </div>
      )}

      {members.length === 0 && (
        <div style={{ padding: '8px 12px', fontSize: 12, color: '#94A3B8' }}>Сотрудников нет</div>
      )}
    </div>
  );
}

// ─── Edit comment modal ───────────────────────────────────────────────────────
function EditCommentModal({ dep, onClose, onSaved }) {
  const [value, setValue] = useState(dep?.comment || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      await departmentsAPI.update(dep.id, { comment: value.trim() });
      onSaved(dep.id, value.trim());
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Не удалось сохранить.');
    } finally {
      setSaving(false);
    }
  };

  if (!dep) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">Описание отдела: {dep.name}</div>
          <button className="btn-icon" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {err && <div style={{ color: '#b91c1c', marginBottom: 10, fontSize: 13 }}>{err}</div>}
          <textarea
            className="form-input"
            placeholder="Описание / комментарий к отделу"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            style={{ resize: 'vertical', fontSize: 13, width: '100%' }}
            autoFocus
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile modal ────────────────────────────────────────────────────────────
function ProfileModal({ member, onClose }) {
  if (!member) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title">Профиль сотрудника</div>
          <button className="btn-icon" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <Avatar name={member.full_name || member.username} photo={member.photo} size={64} bg="#6366F1" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#0F172A' }}>
                {member.full_name || member.username || '—'}
              </div>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                {ROLE_LABELS[member.role] || member.role || '—'}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Отдел', member.department_name],
              ['Подразделение', member.subdivision_name],
              ['Должность', member.position_name],
              ['Email', member.email],
              ['Телефон', member.phone],
              ['Telegram', member.telegram],
              ['Логин', member.username],
              ['Дата найма', member.hire_date],
            ].map(([label, val]) => val ? (
              <div key={label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1E293B' }}>{val}</div>
              </div>
            ) : null)}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

// ─── Employees list tab ───────────────────────────────────────────────────────
function EmployeesTab({ org, usersById }) {
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const deptOptions = useMemo(() => (org?.departments || []).map((d) => d.name), [org]);

  const rows = useMemo(() => {
    const list = [];
    (org?.departments || []).forEach((dep) => {
      sortMembers(dep.members || []).forEach((m) => {
        const profile = usersById.get(Number(m.id)) || {};
        list.push({ ...m, ...profile, departmentName: dep.name });
      });
    });
    return list;
  }, [org, usersById]);

  const filtered = useMemo(() => {
    let res = rows;
    if (filterDept) res = res.filter((r) => r.departmentName === filterDept);
    if (filterRole) res = res.filter((r) => (r.role || '') === filterRole);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((r) =>
        (r.full_name || r.username || '').toLowerCase().includes(q) ||
        (r.departmentName || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      );
    }
    return res;
  }, [rows, filterDept, filterRole, search]);

  const hasFilters = filterDept || filterRole || search.trim();

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="card-title">Сотрудники компании</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ width: 200 }}
            placeholder="Поиск по имени..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-select" style={{ width: 160 }} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">Все отделы</option>
            {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="form-select" style={{ width: 160 }} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">Все роли</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {hasFilters && (
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setSearch(''); setFilterDept(''); setFilterRole(''); }}>
              Сбросить
            </button>
          )}
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Отдел</th>
              <th>Подразделение</th>
              <th>Должность</th>
              <th>Роль</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={`${u.id}-${u.departmentName}`}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={u.full_name || u.username} photo={u.photo} size={32} bg="#6366F1" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name || u.username}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{u.email || ''}</div>
                    </div>
                  </div>
                </td>
                <td>{u.departmentName || '—'}</td>
                <td>{u.subdivision_name || '—'}</td>
                <td>{u.position_name || '—'}</td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F1F5F9', color: '#475569' }}>
                    {ROLE_LABELS[u.role] || u.role || '—'}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ color: 'var(--gray-400)', textAlign: 'center' }}>Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Company() {
  const { user, isSuperAdmin } = useAuth();
  const myRole = String(user?.role || '').toLowerCase();
  const canEditDepts = isSuperAdmin || myRole === 'administrator';

  const [tab, setTab] = useState('structure');
  const [structure, setStructure] = useState(null);
  const [org, setOrg] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  // structure tab filter
  const [structSearch, setStructSearch] = useState('');

  // dept comment editing
  const [editingDept, setEditingDept] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sRes, oRes, uRes] = await Promise.all([
          companyAPI.structure(),
          companyAPI.org(),
          usersAPI.list().catch(() => ({ data: [] })),
        ]);
        setStructure(sRes.data || null);
        setOrg(oRes.data || null);
        setUsers(Array.isArray(uRes.data) ? uRes.data : []);
      } catch (e) {
        setError(e.response?.data?.detail || 'Не удалось загрузить данные компании.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((u) => map.set(Number(u.id), u));
    return map;
  }, [users]);

  const membersByDeptId = useMemo(() => {
    const map = new Map();
    (org?.departments || []).forEach((dep) => {
      map.set(dep.id, sortMembers(dep.members || []));
    });
    return map;
  }, [org]);

  // Update comment locally after save (no full reload needed)
  const handleCommentSaved = (deptId, newComment) => {
    const patch = (list) => list.map((d) => d.id === deptId ? { ...d, comment: newComment } : d);
    if (structure) setStructure((s) => ({ ...s, departments: patch(s.departments || []) }));
    if (org) setOrg((o) => ({ ...o, departments: patch(o.departments || []) }));
  };

  const allDepts = structure?.departments || org?.departments || [];
  const owner = structure?.owner || null;

  const filteredDepts = useMemo(() => {
    if (!structSearch.trim()) return allDepts;
    const q = structSearch.toLowerCase();
    return allDepts.filter((d) => (d.name || '').toLowerCase().includes(q));
  }, [allDepts, structSearch]);

  return (
    <MainLayout title="Компания">
      <div className="page-header">
        <div>
          <div className="page-title">Компания</div>
          <div className="page-subtitle">Организационная структура и сотрудники</div>
        </div>
      </div>

      {error && <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#b91c1c' }}>{error}</div></div>}
      {loading && <div className="card"><div className="card-body">Загрузка...</div></div>}

      {!loading && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid var(--gray-200)' }}>
            {[['structure', 'Структура'], ['employees', 'Сотрудники']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} style={{
                padding: '10px 20px', border: 'none', background: 'none',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                color: tab === id ? 'var(--primary)' : 'var(--gray-500)',
                borderBottom: tab === id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2,
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── STRUCTURE TAB ── */}
          {tab === 'structure' && (
            <div className="card">
              {/* Search bar */}
              <div className="card-header">
                <span className="card-title">Структура компании</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="form-input"
                    style={{ width: 220 }}
                    placeholder="Поиск по отделу..."
                    value={structSearch}
                    onChange={(e) => setStructSearch(e.target.value)}
                  />
                  {structSearch && (
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setStructSearch('')}>
                      Сбросить
                    </button>
                  )}
                </div>
              </div>

              <div className="card-body" style={{ overflowX: 'auto', overflowY: 'visible', padding: '24px 16px' }}>
                <div style={{ minWidth: Math.max(900, filteredDepts.length * 220), paddingBottom: 20 }}>

                  {/* CEO node */}
                  {owner && !structSearch && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 0 }}>
                      <div style={{
                        background: '#DCFCE7', border: '2px solid #22C55E',
                        borderRadius: 12, padding: '10px 20px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}>
                        <Avatar name={owner.full_name || owner.username} photo={owner.photo} size={44} bg="#15803D" />
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#14532D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Руководитель компании
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                            {owner.full_name || owner.username}
                          </div>
                        </div>
                      </div>
                      <VLine height={28} />
                    </div>
                  )}

                  {/* Horizontal connector */}
                  {filteredDepts.length > 1 && !structSearch && (
                    <div style={{ position: 'relative', height: 2, margin: '0 auto', marginBottom: 0 }}>
                      <div style={{
                        position: 'absolute', left: `calc(100% / ${filteredDepts.length} / 2)`,
                        right: `calc(100% / ${filteredDepts.length} / 2)`,
                        height: 2, background: LINE_COLOR, top: 0,
                      }} />
                    </div>
                  )}

                  {/* Department row */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'flex-start', position: 'relative', flexWrap: structSearch ? 'wrap' : 'nowrap' }}>
                    {filteredDepts.map((dep, i) => {
                      const members = membersByDeptId.get(dep.id) || dep.members || [];
                      return (
                        <div key={dep.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          {!structSearch && <VLine height={filteredDepts.length > 1 ? 24 : 0} />}
                          <DeptNode
                            dep={dep}
                            index={i}
                            members={sortMembers(members)}
                            usersById={usersById}
                            onMemberClick={setSelected}
                            canEdit={canEditDepts}
                            onEditComment={setEditingDept}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {filteredDepts.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#94A3B8', padding: 40, fontSize: 14 }}>
                      {structSearch ? 'Отделы не найдены' : 'Структура компании не настроена'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── EMPLOYEES TAB ── */}
          {tab === 'employees' && <EmployeesTab org={org} usersById={usersById} />}
        </>
      )}

      <ProfileModal member={selected} onClose={() => setSelected(null)} />
      {editingDept && (
        <EditCommentModal
          dep={editingDept}
          onClose={() => setEditingDept(null)}
          onSaved={handleCommentSaved}
        />
      )}
    </MainLayout>
  );
}
