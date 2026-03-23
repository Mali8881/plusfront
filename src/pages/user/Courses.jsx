import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { useLocale } from '../../context/LocaleContext';
import { coursesAPI } from '../../api/content';
import { BookOpen, CheckCircle2, Play, RefreshCw } from 'lucide-react';

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function normalizeCourse(raw = {}) {
  return {
    id: raw.id,
    title: raw.title || 'Курс',
    description: raw.description || '',
    visibility: raw.visibility || 'public',
    departmentName: raw.department_name || '',
    isActive: Boolean(raw.is_active ?? true),
  };
}

function normalizeEnrollment(raw = {}) {
  const course = normalizeCourse(raw.course || {});
  return {
    id: raw.id,
    status: String(raw.status || '').toLowerCase(),
    source: String(raw.source || '').toLowerCase(),
    progress: Number(raw.progress_percent || 0),
    acceptedAt: raw.accepted_at || '',
    startedAt: raw.started_at || '',
    completedAt: raw.completed_at || '',
    updatedAt: raw.updated_at || '',
    course,
  };
}

function statusLabel(status, tr) {
  if (status === 'assigned') return tr('Назначен');
  if (status === 'accepted') return tr('Принят');
  if (status === 'in_progress') return tr('В процессе');
  if (status === 'completed') return tr('Завершён');
  return status || '—';
}

export default function Courses() {
  const { t, tr } = useLocale();
  const [tab, setTab] = useState('my');
  const [menu, setMenu] = useState({ loading: true, has_access: true, reason: '' });
  const [available, setAvailable] = useState([]);
  const [my, setMy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [draftProgress, setDraftProgress] = useState({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const accessRes = await coursesAPI.menuAccess();
      const access = accessRes?.data || {};
      setMenu({ loading: false, has_access: Boolean(access.has_access), reason: access.reason || '' });
      if (!access.has_access) {
        setAvailable([]);
        setMy([]);
        return;
      }

      const [availableRes, myRes] = await Promise.all([
        coursesAPI.available(),
        coursesAPI.my(),
      ]);
      setAvailable(safeList(availableRes?.data).map(normalizeCourse));
      const enrollments = safeList(myRes?.data).map(normalizeEnrollment);
      setMy(enrollments);
      setDraftProgress((prev) => {
        const next = { ...prev };
        enrollments.forEach((e) => {
          if (next[e.id] === undefined) next[e.id] = e.progress;
        });
        return next;
      });
    } catch (e) {
      setAvailable([]);
      setMy([]);
      setMenu({ loading: false, has_access: true, reason: '' });
      setError(e?.response?.data?.detail || tr('Не удалось загрузить курсы'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const myByCourseId = useMemo(() => {
    const map = new Map();
    my.forEach((e) => map.set(String(e.course.id), e));
    return map;
  }, [my]);

  const doAction = async (id, action) => {
    setBusyId(id);
    setError('');
    try {
      await action();
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || tr('Операция не выполнена'));
    } finally {
      setBusyId(null);
    }
  };

  const viewMy = useMemo(() => my, [my]);
  const viewAvailable = useMemo(() => available, [available]);

  return (
    <MainLayout title={tr('Курсы')}>
      <div className="page-header">
        <div>
          <div className="page-title">{tr('Курсы')}</div>
          <div className="page-subtitle">{tr('Назначенные и доступные курсы для обучения')}</div>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={load}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <RefreshCw size={14} /> {t('common.refresh', 'Обновить')}
        </button>
      </div>

      {error && <div style={{ marginBottom: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {!menu.loading && !menu.has_access && (
        <div className="card">
          <div className="card-body" style={{ color: 'var(--gray-700)', fontSize: 13 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{tr('Доступ к курсам ограничен')}</div>
            <div>{menu.reason || tr('Недостаточно прав')}</div>
          </div>
        </div>
      )}

      {menu.has_access && (
        <>
          <div className="tabs" style={{ marginBottom: 12 }}>
            <button className={`tab-btn ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>
              {tr('Мои курсы')} ({viewMy.length})
            </button>
            <button className={`tab-btn ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')}>
              {tr('Доступные')} ({viewAvailable.length})
            </button>
          </div>

          {loading && <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>{t('common.loading', 'Загрузка...')}</div>}

          {!loading && tab === 'my' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {viewMy.map((enrollment) => {
                const canAccept = enrollment.source === 'admin' && enrollment.status === 'assigned';
                const canStart = enrollment.status === 'accepted';
                const canUpdateProgress = enrollment.status === 'in_progress' || enrollment.status === 'accepted';
                const isCompleted = enrollment.status === 'completed' || enrollment.progress >= 100;
                const progressValue = Math.max(0, Math.min(100, Number(draftProgress[enrollment.id] ?? enrollment.progress)));

                return (
                  <div key={enrollment.id} className="card">
                    <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                          <BookOpen size={18} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--gray-900)' }}>{enrollment.course.title}</div>
                          {enrollment.course.description && (
                            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gray-600)' }}>{enrollment.course.description}</div>
                          )}
                          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, borderRadius: 999, padding: '3px 8px', background: '#F3F4F6', color: 'var(--gray-700)' }}>
                              {tr('Статус')}: {statusLabel(enrollment.status, tr)}
                            </span>
                            <span style={{ fontSize: 11, borderRadius: 999, padding: '3px 8px', background: '#ECFEFF', color: '#0E7490' }}>
                              {tr('Прогресс')}: {enrollment.progress}%
                            </span>
                          </div>
                        </div>
                        {isCompleted && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#16A34A', fontWeight: 700 }}>
                            <CheckCircle2 size={16} /> {tr('Готово')}
                          </div>
                        )}
                      </div>

                      {canAccept && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            disabled={busyId === enrollment.id}
                            onClick={() => doAction(enrollment.id, () => coursesAPI.accept(enrollment.id))}
                          >
                            {busyId === enrollment.id ? tr('Обработка...') : tr('Принять')}
                          </button>
                        </div>
                      )}

                      {canStart && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            disabled={busyId === enrollment.id}
                            onClick={() => doAction(enrollment.id, () => coursesAPI.start(enrollment.id))}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                          >
                            <Play size={14} /> {busyId === enrollment.id ? tr('Обработка...') : tr('Начать')}
                          </button>
                        </div>
                      )}

                      {canUpdateProgress && (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={progressValue}
                              onChange={(e) => setDraftProgress((p) => ({ ...p, [enrollment.id]: Number(e.target.value) }))}
                              style={{ flex: 1 }}
                            />
                            <div style={{ width: 46, textAlign: 'right', fontSize: 12, color: 'var(--gray-700)', fontWeight: 700 }}>
                              {progressValue}%
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              disabled={busyId === enrollment.id || progressValue === enrollment.progress}
                              onClick={() => doAction(enrollment.id, () => coursesAPI.progress(enrollment.id, progressValue))}
                            >
                              {busyId === enrollment.id ? tr('Сохранение...') : tr('Сохранить прогресс')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {viewMy.length === 0 && (
                <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>{tr('Пока нет назначенных или выбранных курсов.')}</div>
              )}
            </div>
          )}

          {!loading && tab === 'available' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
              {viewAvailable.map((course) => {
                const existing = myByCourseId.get(String(course.id));
                const canEnroll = !existing;
                return (
                  <div key={course.id} className="card">
                    <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                          <BookOpen size={18} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--gray-900)' }}>{course.title}</div>
                          {course.description && (
                            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gray-600)' }}>{course.description}</div>
                          )}
                          {course.departmentName && (
                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray-500)' }}>
                              {tr('Отдел')}: {course.departmentName}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {existing ? (
                          <button className="btn btn-secondary btn-sm" type="button" disabled>
                            {tr('Уже в моих курсах')}
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            disabled={!canEnroll || busyId === course.id}
                            onClick={() => doAction(course.id, () => coursesAPI.selfEnroll(course.id))}
                          >
                            {busyId === course.id ? tr('Добавление...') : tr('Выбрать курс')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {viewAvailable.length === 0 && (
                <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>{tr('Доступных курсов нет.')}</div>
              )}
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
}

