import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { departmentsAPI, positionsAPI } from '../../api/auth';
import MainLayout from '../../layouts/MainLayout';
import { Save, Check } from 'lucide-react';

function buildRoleMeta(t) {
  return {
    intern: { label: t('profile.role.intern', 'Стажер'), color: '#2563EB', bg: 'linear-gradient(135deg,#DBEAFE,#EDE9FE)' },
    employee: { label: t('profile.role.employee', 'Сотрудник'), color: '#16A34A', bg: 'linear-gradient(135deg,#D1FAE5,#DBEAFE)' },
    projectmanager: { label: t('profile.role.projectmanager', 'Проект-менеджер'), color: '#7C3AED', bg: 'linear-gradient(135deg,#EDE9FE,#FEE2E2)' },
    admin: { label: t('profile.role.admin', 'Администратор'), color: '#EA580C', bg: 'linear-gradient(135deg,#FED7AA,#FEF9C3)' },
    administrator: { label: t('profile.role.administrator', 'Администратор'), color: '#EA580C', bg: 'linear-gradient(135deg,#FED7AA,#FEF9C3)' },
    systemadmin: { label: t('profile.role.systemadmin', 'Системный администратор'), color: '#0F766E', bg: 'linear-gradient(135deg,#CCFBF1,#DBEAFE)' },
    superadmin: { label: t('profile.role.superadmin', 'Суперадминистратор'), color: '#BE123C', bg: 'linear-gradient(135deg,#FECDD3,#FED7AA)' },
  };
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

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    full_name: user?.name || '',
    department: user?.department || '',
    subdivision: user?.subdivision || '',
    position: user?.position || '',
    telegram: user?.telegram || '',
    phone: user?.phone || '',
    photoFile: null,
  });
  const [photoPreview, setPhotoPreview] = useState(user?.photo || '');

  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    departmentsAPI
      .list()
      .then((res) => setDepartments(Array.isArray(res.data) ? res.data : []))
      .catch(() => setDepartments([]));

    positionsAPI
      .list()
      .then((res) => setPositions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPositions([]));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const payloadBase = {
        full_name: form.full_name,
        department: form.department,
        subdivision: form.subdivision,
        position: form.position,
        telegram: form.telegram,
        phone: form.phone,
      };

      if (form.photoFile) {
        const fd = new FormData();
        Object.entries(payloadBase).forEach(([k, v]) => {
          if (v !== null && v !== undefined) fd.append(k, String(v));
        });
        fd.append('photo', form.photoFile);
        await updateUser(fd);
      } else {
        await updateUser(payloadBase);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.response?.data?.detail || t('profile.error.save', 'Не удалось сохранить профиль'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      full_name: user?.name || '',
      department: user?.department || '',
      subdivision: user?.subdivision || '',
      position: user?.position || '',
      telegram: user?.telegram || '',
      phone: user?.phone || '',
      photoFile: null,
    });
    setPhotoPreview(user?.photo || '');
    setError('');
  };

  return (
    <MainLayout title={t('profile.title', 'Личный кабинет')}>
      <div style={{ maxWidth: 920 }}>
        <div className="card">
          <div
            style={{
              height: 120,
              background: meta.bg,
              borderRadius: '12px 12px 0 0',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 16,
                background: meta.color,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 20,
              }}
            >
              {meta.label}
            </div>
          </div>

          <div className="card-body" style={{ paddingTop: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 16,
                position: 'relative',
                zIndex: 2,
              }}
            >
              <div
                className="avatar"
                style={{
                  width: 72,
                  height: 72,
                  fontSize: 24,
                  border: '3px solid #fff',
                  boxShadow: 'var(--shadow)',
                  background: meta.color,
                  overflow: 'hidden',
                }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt={t('profile.photo.alt', 'Фото профиля')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initials
                )}
              </div>

              <div style={{ marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{user?.name || user?.username || '—'}</div>
                <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>
                  {(user?.position_name || user?.position || '—')} · {(user?.department_name || user?.department || '—')}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 24,
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius)',
                padding: '14px 16px',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  {t('profile.field.login', 'Логин')}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.login || user?.username || '—'}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  Email
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.email || '—'}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  {t('profile.field.hire_date', 'Дата найма')}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.hireDate || '—'}</div>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">{t('profile.field.full_name', 'ФИО')}</label>
                <input
                  className="form-input"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </div>

              <div className="grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">{t('profile.field.department', 'Отдел')}</label>
                  <select
                    className="form-select"
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  >
                    <option value="">{t('profile.placeholder.department', 'Выберите отдел')}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('profile.field.subdivision', 'Подразделение')}</label>
                  <input
                    className="form-input"
                    value={form.subdivision}
                    onChange={(e) => setForm((f) => ({ ...f, subdivision: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">{t('profile.field.position', 'Должность')}</label>
                <select
                  className="form-select"
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                >
                  <option value="">{t('profile.placeholder.position', 'Выберите должность')}</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-2" style={{ marginBottom: 24 }}>
                <div className="form-group">
                  <label className="form-label">Telegram</label>
                  <input
                    className="form-input"
                    value={form.telegram}
                    onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('profile.field.phone', 'Телефон')}</label>
                  <input
                    className="form-input"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">{t('profile.field.photo', 'Фото профиля')}</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setForm((f) => ({ ...f, photoFile: file }));
                    if (file) {
                      setPhotoPreview(URL.createObjectURL(file));
                    } else {
                      setPhotoPreview(user?.photo || '');
                    }
                  }}
                />
              </div>

              {error && <div style={{ marginBottom: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={saving}>
                  {t('profile.btn.reset', 'Сбросить')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {saved ? (
                    <>
                      <Check size={15} /> {t('profile.btn.saved', 'Сохранено')}
                    </>
                  ) : (
                    <>
                      <Save size={15} /> {t('profile.btn.save_changes', 'Сохранить изменения')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
