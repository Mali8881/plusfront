import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { Plus, Trash2, Camera, Save, Check, Trophy, Flame, Sparkles, ShieldCheck, Clock3 } from 'lucide-react';
import { gamificationAPI } from '../../api/content';

const ROLE_META = {
  intern: { label: 'Стажер', color: '#2563EB', bg: 'linear-gradient(135deg,#DBEAFE,#EDE9FE)' },
  employee: { label: 'Сотрудник', color: '#16A34A', bg: 'linear-gradient(135deg,#D1FAE5,#DBEAFE)' },
  projectmanager: { label: 'Проект-менеджер', color: '#7C3AED', bg: 'linear-gradient(135deg,#EDE9FE,#FEE2E2)' },
  department_head: { label: 'Руководитель отдела', color: '#0EA5E9', bg: 'linear-gradient(135deg,#DBEAFE,#CFFAFE)' },
  admin: { label: 'Админ', color: '#EA580C', bg: 'linear-gradient(135deg,#FED7AA,#FEF9C3)' },
  superadmin: { label: 'Суперадминистратор', color: '#BE123C', bg: 'linear-gradient(135deg,#FECDD3,#FED7AA)' },
};

const DEPARTMENTS = ['Разработка', 'Отдел маркетинга', 'Отдел холодных продаж', 'HR', 'Управление', 'Логистика', 'ОКК'];
const POSITIONS = ['Frontend-разработчик', 'Backend-разработчик', 'Стажер', 'SMM-специалист', 'Проект-менеджер', 'Менеджер продаж', 'HR-менеджер', 'Руководитель отдела', 'Суперадминистратор'];

const GAMIFICATION_THEME = {
  bronze: { accent: '#b45309', bg: 'linear-gradient(135deg,#ffedd5,#fef3c7)', soft: '#fff7ed' },
  silver: { accent: '#475569', bg: 'linear-gradient(135deg,#e2e8f0,#f8fafc)', soft: '#f8fafc' },
  gold: { accent: '#a16207', bg: 'linear-gradient(135deg,#fef3c7,#fde68a)', soft: '#fffbeb' },
  platinum: { accent: '#0f766e', bg: 'linear-gradient(135deg,#ccfbf1,#cffafe)', soft: '#f0fdfa' },
  legend: { accent: '#be123c', bg: 'linear-gradient(135deg,#ffe4e6,#fecdd3)', soft: '#fff1f2' },
};

function OrgSection() {
  const [departments, setDepts] = useState(DEPARTMENTS.map((n, i) => ({ id: i + 1, name: n })));
  const [positions, setPos] = useState(POSITIONS.map((n, i) => ({ id: i + 1, name: n, dept: DEPARTMENTS[i % DEPARTMENTS.length] })));
  const [tab, setTab] = useState('depts');
  const [newDept, setND] = useState('');
  const [newPos, setNP] = useState('');
  const [newPD, setNPD] = useState(DEPARTMENTS[0]);
  const [saved, setSaved] = useState(false);

  const addDept = () => {
    if (!newDept.trim()) return;
    setDepts((d) => [...d, { id: Date.now(), name: newDept.trim() }]);
    setND('');
  };

  const addPos = () => {
    if (!newPos.trim()) return;
    setPos((p) => [...p, { id: Date.now(), name: newPos.trim(), dept: newPD }]);
    setNP('');
  };

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="card-title">Структура компании</span>
        <button className="btn btn-primary btn-sm" onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {saved ? <><Check size={14} /> Сохранено</> : <><Save size={14} /> Сохранить</>}
        </button>
      </div>
      <div className="card-body">
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab-btn ${tab === 'depts' ? 'active' : ''}`} onClick={() => setTab('depts')}>Отделы ({departments.length})</button>
          <button className={`tab-btn ${tab === 'pos' ? 'active' : ''}`} onClick={() => setTab('pos')}>Должности ({positions.length})</button>
        </div>

        {tab === 'depts' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
              {departments.map((d) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</span>
                  <button onClick={() => setDepts((ds) => ds.filter((x) => x.id !== d.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2 }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" placeholder="Название нового отдела" value={newDept} onChange={(e) => setND(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDept()} style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={addDept}><Plus size={14} /> Добавить</button>
            </div>
          </>
        )}

        {tab === 'pos' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
              {positions.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.dept}</div>
                  </div>
                  <button onClick={() => setPos((ps) => ps.filter((x) => x.id !== p.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2 }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" placeholder="Название должности" value={newPos} onChange={(e) => setNP(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPos()} style={{ flex: 1 }} />
              <select className="form-select" value={newPD} onChange={(e) => setNPD(e.target.value)} style={{ width: 180 }}>
                {departments.map((d) => <option key={d.id}>{d.name}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={addPos}><Plus size={14} /> Добавить</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const STATIC_DEPARTMENT = 'IT Department';

const makeInitialForm = (u) => ({
  name: u?.name || '',
  email: u?.email || '',
  telegram: u?.telegram || '',
  phone: u?.phone || '',
});

export default function Profile() {
  const { user, updateUser } = useAuth();
  const meta = ROLE_META[user?.role] || ROLE_META.intern;
  const positionLabel = user?.roleLabel || meta.label || user?.position_name || user?.position || '—';
  const fileRef = useRef();

  const [form, setForm] = useState(() => makeInitialForm(user));
  const [avatar, setAvatar] = useState(user?.photo || null);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [gamification, setGamification] = useState(null);

  useEffect(() => {
    let active = true;
    const loadGamification = async () => {
      try {
        const res = await gamificationAPI.my();
        if (active) setGamification(res?.data || null);
      } catch {
        if (active) setGamification(null);
      }
    };
    loadGamification();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Обязательное поле';
    if (!form.email.trim()) e.email = 'Обязательное поле';
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Введите корректный email';
    return e;
  };

  const handleSave = (e) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) {
      setErrors(e2);
      return;
    }
    setErrors({});
    updateUser?.({
      name: form.name,
      email: form.email,
      telegram: form.telegram,
      phone: form.phone,
      ...(avatar ? { photo: avatar } : {}),
    });
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target.result);
    reader.readAsDataURL(file);
  };

  const initials = form.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '??';
  const levelTheme = GAMIFICATION_THEME[gamification?.tier_key] || GAMIFICATION_THEME.bronze;

  return (
    <MainLayout title="Личный кабинет">
      <div style={{ maxWidth: 760 }}>
        <div className="page-header">
          <div>
            <div className="page-title">Личный кабинет</div>
            <div className="page-subtitle">Управляйте своими данными и настройками</div>
          </div>
        </div>

        <div className="card">
          <div style={{ height: 100, background: meta.bg, borderRadius: '12px 12px 0 0', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 12, right: 16, background: meta.color, color: 'white', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>
              {meta.label}
            </div>
          </div>

          <div className="card-body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: -36, marginBottom: 24 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div className="avatar" style={{ width: 72, height: 72, fontSize: 24, border: '3px solid white', boxShadow: 'var(--shadow)', background: avatar ? 'transparent' : meta.color, overflow: 'hidden' }}>
                  {avatar ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                </div>
                {isEditing && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: meta.color, border: '2px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Camera size={11} color="white" />
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
                  </>
                )}
              </div>
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{form.name || '—'}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{positionLabel} · {STATIC_DEPARTMENT}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24, background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
              {[
                { label: 'Логин', value: user?.login || user?.username || '—' },
                { label: 'Email', value: form.email || '—' },
                { label: 'Дата найма', value: user?.hireDate || user?.hire_date || '—' },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSave}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Персональные данные</div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">ФИО <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  className={`form-input ${errors.name ? 'input-error' : ''}`}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Фамилия Имя Отчество"
                  disabled={!isEditing}
                />
                {errors.name && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.name}</div>}
              </div>

              <div className="grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Отдел</label>
                  <input className="form-input" value={STATIC_DEPARTMENT} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Должность</label>
                  <input className="form-input" value={positionLabel} disabled />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Email <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  className={`form-input ${errors.email ? 'input-error' : ''}`}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  disabled={!isEditing}
                />
                {errors.email && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.email}</div>}
              </div>

              <div className="grid-2" style={{ marginBottom: 24 }}>
                <div className="form-group">
                  <label className="form-label">Telegram</label>
                  <input className="form-input" value={form.telegram} onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))} placeholder="@username" disabled={!isEditing} />
                </div>
                <div className="form-group">
                  <label className="form-label">Телефон</label>
                  <input className="form-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+996 ..." disabled={!isEditing} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setForm(makeInitialForm(user));
                        setAvatar(user?.photo || null);
                        setErrors({});
                        setIsEditing(false);
                      }}
                    >
                      Сбросить
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {saved ? <><Check size={15} /> Сохранено!</> : <><Save size={15} /> Сохранить изменения</>}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsEditing(true)}
                  >
                    Редактировать
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {gamification?.enabled && (
          <div className="card" style={{ marginTop: 20, overflow: 'hidden' }}>
            <div style={{ padding: 20, background: levelTheme.bg, borderBottom: '1px solid rgba(255,255,255,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ width: 82, height: 82, borderRadius: 24, background: 'rgba(255,255,255,0.72)', color: levelTheme.accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow)' }}>
                    <Sparkles size={18} />
                    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{gamification.level}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: levelTheme.accent, marginBottom: 6 }}>
                      Уровень {gamification.level} · {gamification.tier_label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)' }}>Прокачка сотрудника</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 4 }}>
                      {gamification.xp_total} XP всего
                      {gamification.next_level ? ` · до ${gamification.next_level} уровня осталось ${gamification.xp_to_next_level} XP` : ' · максимальный уровень достигнут'}
                    </div>
                  </div>
                </div>
                <div style={{ minWidth: 220, maxWidth: 300, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>
                    <span>Прогресс уровня</span>
                    <span>{gamification.progress_percent}%</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.65)', overflow: 'hidden' }}>
                    <div style={{ width: `${gamification.progress_percent}%`, height: '100%', background: levelTheme.accent, borderRadius: 999 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-600)', marginTop: 8 }}>
                    <span>{gamification.current_level_min_xp} XP</span>
                    <span>{gamification.next_level_xp || gamification.xp_total} XP</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: <Flame size={16} color="#f97316" />, label: 'Текущий стрик', value: `${gamification.current_streak}/${gamification.max_streak}` },
                  { icon: <Trophy size={16} color={levelTheme.accent} />, label: 'Лучший стрик', value: `${gamification.best_streak}/${gamification.max_streak}` },
                  { icon: <Clock3 size={16} color="#0f766e" />, label: 'Следующая цель', value: gamification.next_streak_goal ? `${gamification.next_streak_goal} дней` : 'Все цели закрыты' },
                ].map((item) => (
                  <div key={item.label} style={{ background: levelTheme.soft, border: '1px solid var(--gray-200)', borderRadius: 16, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      {item.icon} {item.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <ShieldCheck size={16} color={levelTheme.accent} />
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Достижения</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {gamification.badges?.length ? gamification.badges.map((badge) => (
                    <div key={badge.code} style={{ minWidth: 180, maxWidth: 240, padding: '10px 12px', borderRadius: 14, border: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>{badge.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>{badge.description}</div>
                    </div>
                  )) : (
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Первые бейджи появятся после регулярных отметок и отчётов.</div>
                  )}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Trophy size={16} color={levelTheme.accent} />
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Последние начисления XP</div>
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {gamification.recent_events?.length ? gamification.recent_events.map((event, index) => (
                    <div key={`${event.event_type}-${event.created_at}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--gray-200)', background: 'white' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>{event.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>{event.description}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: event.xp_delta >= 0 ? '#15803d' : '#b91c1c' }}>
                          {event.xp_delta >= 0 ? `+${event.xp_delta}` : event.xp_delta} XP
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                          {event.created_at ? new Date(event.created_at).toLocaleString('ru-RU') : 'Событие'}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>История появится после первых игровых событий.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {user?.role === 'intern' && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <span className="card-title">Перевод в сотрудники</span>
            </div>
            <div className="card-body">
              <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                Процесс перевода ведет администратор: после завершения стажировки он отправляет запрос суперадминистратору на подтверждение роли сотрудника.
              </div>
            </div>
          </div>
        )}

        {user?.role === 'superadmin' && <OrgSection />}
      </div>
    </MainLayout>
  );
}

