import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { authAPI, departmentsAPI, positionsAPI, subdivisionsAPI } from '../../api/auth';
import { coursesAPI, gamificationAPI } from '../../api/content';
import MainLayout from '../../layouts/MainLayout';
import { Save, Check, Camera, User, Briefcase, Shield, Eye, EyeOff, Award, Flame, GraduationCap } from 'lucide-react';

function buildRoleMeta(t) {
  return {
    intern: { label: t('profile.role.intern', 'Стажер'), color: '#2563EB', bg: 'linear-gradient(135deg,#DBEAFE,#EDE9FE)' },
    employee: { label: t('profile.role.employee', 'Сотрудник'), color: '#16A34A', bg: 'linear-gradient(135deg,#D1FAE5,#DBEAFE)' },
    teamlead: { label: t('profile.role.projectmanager', 'Тимлид / Менеджер проекта'), color: '#7C3AED', bg: 'linear-gradient(135deg,#EDE9FE,#FEE2E2)' },
    projectmanager: { label: t('profile.role.projectmanager', 'Тимлид / Менеджер проекта'), color: '#7C3AED', bg: 'linear-gradient(135deg,#EDE9FE,#FEE2E2)' },
    department_head: { label: t('profile.role.admin', 'Руководитель подразделения'), color: '#EA580C', bg: 'linear-gradient(135deg,#FED7AA,#FEF9C3)' },
    admin: { label: t('profile.role.admin', 'Руководитель подразделения'), color: '#EA580C', bg: 'linear-gradient(135deg,#FED7AA,#FEF9C3)' },
    administrator: { label: t('profile.role.administrator', 'Администратор'), color: '#0284C7', bg: 'linear-gradient(135deg,#E0F2FE,#DBEAFE)' },
    systemadmin: { label: t('profile.role.systemadmin', 'Сист. администратор'), color: '#0F766E', bg: 'linear-gradient(135deg,#CCFBF1,#DBEAFE)' },
    superadmin: { label: t('profile.role.superadmin', 'Суперадмин'), color: '#BE123C', bg: 'linear-gradient(135deg,#FECDD3,#FED7AA)' },
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
}

function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ru-RU');
}

const TABS = [
  { id: 'general', Icon: User, label: 'Общее' },
  { id: 'work', Icon: Briefcase, label: 'Работа' },
  { id: 'security', Icon: Shield, label: 'Безопасность' },
];

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-800)' }}>{value || '—'}</span>
    </div>
  );
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { t } = useLocale();
  const roleMeta = useMemo(() => buildRoleMeta(t), [t]);
  const meta = roleMeta[user?.role] || roleMeta.employee;

  const initials = useMemo(
    () => (user?.name || user?.username || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
    [user?.name, user?.username]
  );

  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [extrasLoading, setExtrasLoading] = useState(true);
  const [gamification, setGamification] = useState({ current_streak: 0, longest_streak: 0, badges: [], last_report_date: null });
  const [completedCourses, setCompletedCourses] = useState([]);

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  // --- General tab ---
  const [generalForm, setGeneralForm] = useState({
    full_name: user?.name || '',
    phone: user?.phone || '',
    telegram: user?.telegram || '',
    photoFile: null,
  });
  const [photoPreview, setPhotoPreview] = useState(user?.photo || '');

  // --- Work tab ---
  const [workForm, setWorkForm] = useState({
    department: user?.department_id ? String(user.department_id) : '',
    subdivision: user?.subdivision_id ? String(user.subdivision_id) : '',
    position: user?.position_id ? String(user.position_id) : '',
  });
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [subdivisions, setSubdivisions] = useState([]);

  useEffect(() => {
    departmentsAPI.list().then((r) => setDepartments(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    positionsAPI.list().then((r) => setPositions(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!workForm.department) { setSubdivisions([]); return; }
    subdivisionsAPI
      .list({ department_id: workForm.department, is_active: true })
      .then((r) => setSubdivisions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSubdivisions([]));
  }, [workForm.department]);

  useEffect(() => {
    let alive = true;
    const loadExtras = async () => {
      setExtrasLoading(true);
      try {
        const [gamificationRes, coursesRes] = await Promise.allSettled([
          gamificationAPI.my(),
          coursesAPI.my(),
        ]);

        if (!alive) return;

        if (gamificationRes.status === 'fulfilled') {
          setGamification(gamificationRes.value?.data || { current_streak: 0, longest_streak: 0, badges: [], last_report_date: null });
        } else {
          setGamification({ current_streak: 0, longest_streak: 0, badges: [], last_report_date: null });
        }

        if (coursesRes.status === 'fulfilled') {
          const completed = safeList(coursesRes.value?.data)
            .filter((item) => String(item?.status || '').toLowerCase() === 'completed' || Number(item?.progress_percent || 0) >= 100)
            .map((item) => ({
              id: item.id,
              title: item.course?.title || 'Курс',
              description: item.course?.description || '',
              completedAt: item.completed_at || item.updated_at || '',
              progress: Number(item.progress_percent || 0),
            }));
          setCompletedCourses(completed);
        } else {
          setCompletedCourses([]);
        }
      } finally {
        if (alive) setExtrasLoading(false);
      }
    };

    loadExtras();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // --- Security tab ---
  const [passForm, setPassForm] = useState({ email_confirm: '', current_password: '', new_password: '', new_password_confirm: '' });
  const [showPass, setShowPass] = useState({ current: false, next: false, confirm: false });
  const [passError, setPassError] = useState('');
  const [passSaved, setPassSaved] = useState(false);
  const [passSaving, setPassSaving] = useState(false);

  const badges = safeList(gamification?.badges);

  // --- Handlers ---
  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      const { first_name, last_name } = splitFullName(generalForm.full_name);
      if (generalForm.photoFile) {
        const fd = new FormData();
        fd.append('first_name', first_name);
        fd.append('last_name', last_name);
        fd.append('phone', generalForm.phone);
        fd.append('telegram', generalForm.telegram);
        fd.append('photo', generalForm.photoFile);
        await updateUser(fd);
        setGeneralForm((f) => ({ ...f, photoFile: null }));
      } else {
        await updateUser({ first_name, last_name, phone: generalForm.phone, telegram: generalForm.telegram });
      }
      flashSaved();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось сохранить');
    } finally { setSaving(false); }
  };

  const handleSaveWork = async (e) => {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      const payload = {};
      if (workForm.department) payload.department = Number(workForm.department);
      if (workForm.subdivision) payload.subdivision = Number(workForm.subdivision);
      if (workForm.position) payload.position = Number(workForm.position);
      await updateUser(payload);
      flashSaved();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось сохранить');
    } finally { setSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    if (passForm.email_confirm.trim().toLowerCase() !== (user?.email || '').toLowerCase()) {
      setPassError('Введённый email не совпадает с вашим адресом.');
      return;
    }
    setPassSaving(true); setPassSaved(false);
    try {
      await authAPI.changePassword({
        current_password: passForm.current_password,
        new_password: passForm.new_password,
        new_password_confirm: passForm.new_password_confirm,
      });
      setPassSaved(true);
      setPassForm({ email_confirm: '', current_password: '', new_password: '', new_password_confirm: '' });
      setTimeout(() => setPassSaved(false), 3000);
      // Refresh user so must_change_password banner disappears
      try { await updateUser({}); } catch { /* ignore */ }
    } catch (err) {
      const data = err?.response?.data;
      setPassError(
        typeof data === 'string' ? data :
        data?.detail || data?.non_field_errors?.[0] ||
        data?.current_password?.[0] || data?.new_password?.[0] ||
        'Не удалось сменить пароль'
      );
    } finally { setPassSaving(false); }
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
    <MainLayout title={t('profile.title', 'Профиль')}>
      <div style={{ maxWidth: 860 }}>

        {/* ===== HEADER CARD ===== */}
        <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
          {/* Banner */}
          <div style={{ height: 110, background: meta.bg, position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 14, right: 16,
              background: meta.color, color: '#fff',
              fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 20,
            }}>
              {meta.label}
            </div>
          </div>

          <div className="card-body" style={{ paddingTop: 0 }}>
            {/* Avatar + name row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: -40, marginBottom: 16 }}>
              <label htmlFor="photo-upload-header" title="Нажмите чтобы изменить фото" style={{ flexShrink: 0, cursor: 'pointer', position: 'relative' }}>
                <div className="avatar" style={{
                  width: 80, height: 80, fontSize: 26, fontWeight: 700,
                  border: '3px solid #fff', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                  background: meta.color, overflow: 'hidden', borderRadius: '50%',
                  position: 'relative',
                }}>
                  {photoPreview
                    ? <img src={photoPreview} alt="Фото" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials}
                  {/* hover overlay */}
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.35)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.2s',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                  >
                    <Camera size={20} color="#fff" />
                  </div>
                </div>
                <input id="photo-upload-header" type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setGeneralForm((f) => ({ ...f, photoFile: file }));
                    if (file) setPhotoPreview(URL.createObjectURL(file));
                    else setPhotoPreview(user?.photo || '');
                    if (file) setActiveTab('general');
                  }}
                />
              </label>

              <div style={{ flex: 1, paddingBottom: 6 }}>
                <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.2, color: 'var(--gray-900)' }}>
                  {user?.name || user?.username || '—'}
                </div>
                <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 3 }}>
                  {user?.position_name || '—'} · {user?.department_name || '—'}
                </div>
              </div>
            </div>

            {/* Stats bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius)',
              padding: '12px 16px',
            }}>
              <InfoRow label={t('profile.field.login', 'Логин')} value={user?.login || user?.username} />
              <InfoRow label="Email" value={user?.email} />
              <InfoRow label={t('profile.field.hire_date', 'Дата найма')} value={user?.hireDate} />
              {user?.subdivision_name && (
                <InfoRow label={t('profile.field.subdivision', 'Подразделение')} value={user.subdivision_name} />
              )}
            </div>
          </div>
        </div>

        {/* ===== TABS NAV ===== */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--gray-200)' }}>
          {TABS.map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setActiveTab(id); setError(''); setSaved(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', border: 'none', background: 'none',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                color: activeTab === id ? 'var(--primary)' : 'var(--gray-500)',
                borderBottom: activeTab === id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2, transition: 'color 0.15s',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* ===== TAB: ОБЩЕЕ ===== */}
        {activeTab === 'general' && (
          <div style={{ display: 'grid', gap: 16 }}>
          <div className="card">
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
              <span className="card-title">Личная информация</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleSaveGeneral}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">{t('profile.field.full_name', 'ФИО')}</label>
                    <input
                      className="form-input"
                      value={generalForm.full_name}
                      onChange={(e) => setGeneralForm((f) => ({ ...f, full_name: e.target.value }))}
                      placeholder="Иванов Иван Иванович"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" value={user?.email || ''} readOnly
                      style={{ background: 'var(--gray-50)', color: 'var(--gray-500)', cursor: 'not-allowed' }} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('profile.field.hire_date', 'Дата найма')}</label>
                    <input className="form-input" value={formatDate(user?.hireDate)} readOnly
                      style={{ background: 'var(--gray-50)', color: 'var(--gray-500)', cursor: 'not-allowed' }} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('profile.field.phone', 'Телефон')}</label>
                    <input
                      className="form-input"
                      value={generalForm.phone}
                      onChange={(e) => setGeneralForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+7 (999) 123-45-67"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Telegram</label>
                    <input
                      className="form-input"
                      value={generalForm.telegram}
                      onChange={(e) => setGeneralForm((f) => ({ ...f, telegram: e.target.value }))}
                      placeholder="@username"
                    />
                  </div>
                </div>

                {generalForm.photoFile && (
                  <div style={{ marginTop: 8, fontSize: 13, color: '#2563EB', background: '#EFF6FF', padding: '6px 10px', borderRadius: 6 }}>
                    Новое фото выбрано — нажмите «Сохранить» чтобы применить
                  </div>
                )}

                {error && <div style={{ marginTop: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {saved ? <><Check size={15} /> Сохранено</> : <><Save size={15} /> Сохранить</>}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Flame size={16} />
                  Огонек и бейджи
                </span>
              </div>
              <div className="card-body">
                {extrasLoading ? (
                  <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>Загружаем достижения...</div>
                ) : (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                      <div style={{ padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Сейчас</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' }}>{gamification?.current_streak || 0}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>дней подряд</div>
                      </div>
                      <div style={{ padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Лучший</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' }}>{gamification?.longest_streak || 0}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>дней подряд</div>
                      </div>
                      <div style={{ padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Бейджи</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' }}>{badges.length}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>разблокировано</div>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      Последний отчет: {formatDate(gamification?.last_report_date)}
                    </div>

                    {badges.length > 0 ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {badges.map((badge) => (
                          <div key={badge.code || badge.name} style={{ padding: '12px 14px', border: '1px solid var(--gray-200)', borderRadius: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Award size={16} color="#D97706" />
                              <strong style={{ fontSize: 14, color: 'var(--gray-900)' }}>{badge.name}</strong>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                              {badge.description || 'Достижение разблокировано.'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
                              Получен: {formatDate(badge.awarded_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>
                        Пока нет бейджей. Они появятся после стабильной активности и завершения курсов.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Check size={16} />
                    Достижения
                  </span>
                </div>
                <div className="card-body">
                  {extrasLoading ? (
                    <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>Загружаем достижения...</div>
                  ) : completedCourses.length > 0 ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {completedCourses.map((course) => (
                        <div key={course.id} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--gray-50)' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>{course.title}</div>
                          {course.description ? (
                            <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>{course.description}</div>
                          ) : null}
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
                            Завершен: {formatDate(course.completedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>Завершенных курсов пока нет.</div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <GraduationCap size={16} />
                    Сертификаты
                  </span>
                </div>
                <div className="card-body">
                  {extrasLoading ? (
                    <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>Загружаем статус сертификатов...</div>
                  ) : completedCourses.length > 0 ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {completedCourses.map((course) => (
                        <div key={`certificate-${course.id}`} style={{ padding: '12px 14px', border: '1px dashed var(--gray-200)', borderRadius: 12 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>{course.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>
                            Курс завершен на 100%, значит сертификат готов к выдаче.
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
                            Дата завершения: {formatDate(course.completedAt)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
                            Backend пока не отдает файл сертификата, поэтому здесь показан статус готовности.
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>Сертификаты появятся после завершения курсов.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ===== TAB: РАБОТА ===== */}
        {activeTab === 'work' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Рабочие данные</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleSaveWork}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">{t('profile.field.department', 'Отдел')}</label>
                    <select className="form-select" value={workForm.department}
                      onChange={(e) => setWorkForm((f) => ({ ...f, department: e.target.value, subdivision: '' }))}>
                      <option value="">Выберите отдел</option>
                      {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('profile.field.subdivision', 'Подразделение')}</label>
                    <select className="form-select" value={workForm.subdivision}
                      onChange={(e) => setWorkForm((f) => ({ ...f, subdivision: e.target.value }))}
                      disabled={!workForm.department || subdivisions.length === 0}>
                      <option value="">Выберите подразделение</option>
                      {subdivisions.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">{t('profile.field.position', 'Должность')}</label>
                    <select className="form-select" value={workForm.position}
                      onChange={(e) => setWorkForm((f) => ({ ...f, position: e.target.value }))}>
                      <option value="">Выберите должность</option>
                      {positions.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    </select>
                  </div>

                </div>

                {error && <div style={{ marginTop: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {saved ? <><Check size={15} /> Сохранено</> : <><Save size={15} /> Сохранить</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== TAB: БЕЗОПАСНОСТЬ ===== */}
        {activeTab === 'security' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Смена пароля</span>
            </div>
            <div className="card-body">
              {user?.must_change_password && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: '#FFF7ED', border: '1px solid #FED7AA',
                  borderRadius: 8, padding: '12px 16px', marginBottom: 20,
                }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#92400E' }}>
                      Требуется смена пароля
                    </div>
                    <div style={{ fontSize: 13, color: '#78350F', marginTop: 4 }}>
                      Вы вошли с временным паролем. Пожалуйста, установите новый пароль прямо сейчас.
                    </div>
                  </div>
                </div>
              )}
              <form onSubmit={handleChangePassword}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>

                  {/* Email confirmation */}
                  <div className="form-group">
                    <label className="form-label">Подтвердите ваш Email</label>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>
                      Введите свой email для подтверждения действия
                    </div>
                    <input
                      className="form-input"
                      type="email"
                      value={passForm.email_confirm}
                      onChange={(e) => setPassForm((f) => ({ ...f, email_confirm: e.target.value }))}
                      placeholder={user?.email || 'ваш@email.com'}
                      required
                    />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--gray-200)', margin: '4px 0' }} />

                  {[
                    { key: 'current_password', label: 'Текущий пароль', showKey: 'current' },
                    { key: 'new_password', label: 'Новый пароль', showKey: 'next' },
                    { key: 'new_password_confirm', label: 'Подтвердите новый пароль', showKey: 'confirm' },
                  ].map(({ key, label, showKey }) => (
                    <div className="form-group" key={key}>
                      <label className="form-label">{label}</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          className="form-input"
                          type={showPass[showKey] ? 'text' : 'password'}
                          value={passForm[key]}
                          onChange={(e) => setPassForm((f) => ({ ...f, [key]: e.target.value }))}
                          style={{ paddingRight: 40 }}
                          required
                        />
                        <button type="button"
                          onClick={() => setShowPass((s) => ({ ...s, [showKey]: !s[showKey] }))}
                          style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--gray-400)', padding: 0,
                          }}>
                          {showPass[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  ))}

                  {passError && (
                    <div style={{ color: 'var(--danger)', fontSize: 13, background: 'var(--danger-bg, #FEF2F2)', padding: '8px 12px', borderRadius: 6 }}>
                      {passError}
                    </div>
                  )}

                  <div>
                    <button type="submit" className="btn btn-primary" disabled={passSaving}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {passSaved ? <><Check size={15} /> Пароль изменён</> : <><Save size={15} /> Сменить пароль</>}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
