import MainLayout from '../../layouts/MainLayout';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Circle, Save, Tag } from 'lucide-react';
import { userLessonsAPI } from '../../api/content';
import { useLocale } from '../../context/LocaleContext';

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeItem(raw = {}) {
  const lesson = raw.lesson || {};
  return {
    id: raw.id,
    source: raw.source || '',
    note: raw.note || '',
    assignedAt: raw.assigned_at || '',
    completedAt: raw.completed_at || null,
    isCompleted: raw.is_completed || false,
    lesson: {
      id: lesson.id,
      title: lesson.title || 'Материал',
      description: lesson.description || '',
      content: lesson.content || '',
      tags: Array.isArray(lesson.tags) ? lesson.tags : [],
    },
  };
}

function sourceLabel(source) {
  if (source === 'auto_quiz') return { text: 'Авто (тест)', color: '#0E7490', bg: '#ECFEFF' };
  return { text: 'Вручную', color: '#6B7280', bg: '#F3F4F6' };
}

function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('ru-RU'); } catch { return ''; }
}

export default function Lessons() {
  const { t, tr } = useLocale();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState('');
  const [filterDone, setFilterDone] = useState('all'); // 'all' | 'active' | 'done'

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await userLessonsAPI.list();
      setItems(safeList(res.data).map(normalizeItem));
    } catch (e) {
      setItems([]);
      setError(e?.response?.data?.detail || tr('Не удалось загрузить материалы'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const viewItems = useMemo(() => {
    if (filterDone === 'active') return items.filter((x) => !x.isCompleted);
    if (filterDone === 'done') return items.filter((x) => x.isCompleted);
    return items;
  }, [items, filterDone]);

  const setNoteValue = (id, value) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, note: value } : x)));

  const saveNote = async (id) => {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    setSavingId(id);
    try {
      await userLessonsAPI.update(id, { note: item.note || '' });
    } catch { /* toast handled by interceptor */ } finally {
      setSavingId(null);
    }
  };

  const toggleComplete = async (id) => {
    const item = items.find((x) => x.id === id);
    if (!item || togglingId === id) return;
    setTogglingId(id);
    try {
      const res = await userLessonsAPI.update(id, { is_completed: !item.isCompleted });
      const updated = normalizeItem(res.data);
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isCompleted: updated.isCompleted, completedAt: updated.completedAt } : x)));
    } catch { /* ignore */ } finally {
      setTogglingId(null);
    }
  };

  const doneCount = items.filter((x) => x.isCompleted).length;

  return (
    <MainLayout title={tr('Материалы и заметки')}>
      <div className="page-header">
        <div>
          <div className="page-title">{tr('Рекомендованные материалы')}</div>
          <div className="page-subtitle">
            {tr('Материалы назначаются автоматически по слабым темам тестов. Тут можно вести личные заметки.')}
          </div>
        </div>
        {items.length > 0 && (
          <div style={{ fontSize: 13, color: 'var(--gray-500)', alignSelf: 'center' }}>
            {doneCount}/{items.length} {tr('выполнено')}
          </div>
        )}
      </div>

      {error && <div style={{ marginBottom: 14, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {/* Filter tabs */}
      {!loading && items.length > 0 && (
        <div className="tabs" style={{ marginBottom: 14 }}>
          {['all', 'active', 'done'].map((f) => (
            <button
              key={f}
              className={`tab-btn ${filterDone === f ? 'active' : ''}`}
              onClick={() => setFilterDone(f)}
            >
              {f === 'all' ? tr('Все') : f === 'active' ? tr('Активные') : tr('Выполненные')}
            </button>
          ))}
        </div>
      )}

      {loading && <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>{t('common.loading', 'Загрузка...')}</div>}

      {!loading && viewItems.length === 0 && (
        <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>
          {items.length === 0
            ? tr('Пока нет назначенных материалов. Они появятся после прохождения тестов.')
            : tr('Нет материалов в этой категории.')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {viewItems.map((item) => {
          const sl = sourceLabel(item.source);
          return (
            <div
              key={item.id}
              className="card"
              style={{
                padding: 16,
                borderRadius: 'var(--radius)',
                border: `1px solid ${item.isCompleted ? '#BBF7D0' : 'var(--gray-200)'}`,
                background: item.isCompleted ? '#F0FDF4' : 'white',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: item.isCompleted ? '#DCFCE7' : '#EEF2FF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: item.isCompleted ? '#16A34A' : '#4F46E5',
                }}>
                  <BookOpen size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: 14, lineHeight: 1.3 }}>
                    {item.lesson.title}
                  </div>
                  {item.lesson.description && (
                    <div style={{ marginTop: 3, color: 'var(--gray-600)', fontSize: 12 }}>
                      {item.lesson.description}
                    </div>
                  )}
                </div>
                {/* Complete toggle */}
                <button
                  type="button"
                  onClick={() => toggleComplete(item.id)}
                  disabled={togglingId === item.id}
                  title={item.isCompleted ? tr('Снять отметку') : tr('Отметить выполненным')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: item.isCompleted ? '#16A34A' : 'var(--gray-400)', flexShrink: 0 }}
                >
                  {item.isCompleted ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>
              </div>

              {/* Tags & meta */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, borderRadius: 999, padding: '3px 8px', background: sl.bg, color: sl.color }}>
                  {sl.text}
                </span>
                {item.lesson.tags.map((tg) => (
                  <span key={String(tg)} style={{ fontSize: 11, borderRadius: 999, padding: '3px 8px', background: '#F3F4F6', color: 'var(--gray-700)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Tag size={10} /> {String(tg)}
                  </span>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gray-400)' }}>
                  {item.isCompleted && item.completedAt
                    ? `${tr('Выполнено')} ${fmtDate(item.completedAt)}`
                    : item.assignedAt
                    ? `${tr('Назначено')} ${fmtDate(item.assignedAt)}`
                    : ''}
                </span>
              </div>

              {/* Lesson content */}
              {item.lesson.content && (
                <div style={{ fontSize: 13, color: 'var(--gray-800)', whiteSpace: 'pre-wrap', borderTop: '1px solid var(--gray-100)', paddingTop: 10 }}>
                  {item.lesson.content}
                </div>
              )}

              {/* Note */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 5 }}>
                  {tr('Моя заметка')}
                </div>
                <textarea
                  className="form-input"
                  value={item.note}
                  onChange={(e) => setNoteValue(item.id, e.target.value)}
                  placeholder={tr('Пиши сюда свои заметки по материалу...')}
                  style={{ width: '100%', minHeight: 80, resize: 'vertical', fontSize: 13 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => saveNote(item.id)}
                    disabled={savingId === item.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                  >
                    <Save size={13} />
                    {savingId === item.id ? tr('Сохраняю...') : tr('Сохранить')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </MainLayout>
  );
}
