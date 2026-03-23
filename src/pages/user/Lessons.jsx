import MainLayout from '../../layouts/MainLayout';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Save, Tag } from 'lucide-react';
import { userLessonsAPI } from '../../api/content';
import { useLocale } from '../../context/LocaleContext';

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function normalizeItem(raw = {}) {
  const lesson = raw.lesson || {};
  return {
    id: raw.id,
    tag: raw.tag || '',
    source: raw.source || '',
    note: raw.note || '',
    createdAt: raw.created_at || '',
    lesson: {
      id: lesson.id,
      title: lesson.title || 'Материал',
      description: lesson.description || '',
      content: lesson.content || '',
      tags: Array.isArray(lesson.tags) ? lesson.tags : [],
    },
  };
}

export default function Lessons() {
  const { t, tr } = useLocale();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [dirtyNotes, setDirtyNotes] = useState({});

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

  useEffect(() => {
    load();
  }, []);

  const viewItems = useMemo(() => items, [items]);

  const setNoteValue = (id, value) => {
    setDirtyNotes((prev) => ({ ...prev, [id]: value }));
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, note: value } : x)));
  };

  const saveNote = async (id) => {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    setSavingId(id);
    try {
      await userLessonsAPI.update(id, item.note || '');
    } catch (e) {
      // axios interceptor will toast; keep UI stable
    } finally {
      setSavingId(null);
    }
  };

  return (
    <MainLayout title={tr('Материалы и заметки')}>
      <div className="page-header">
        <div>
          <div className="page-title">{tr('Рекомендованные материалы')}</div>
          <div className="page-subtitle">{tr('Материалы назначаются автоматически по слабым темам тестов. Тут можно вести личные заметки.')}</div>
        </div>
      </div>

      {error && <div style={{ marginBottom: 14, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {loading && <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>{t('common.loading', 'Загрузка...')}</div>}

      {!loading && viewItems.length === 0 && (
        <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>
          {tr('Пока нет назначенных материалов. Они появятся после прохождения тестов.')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {viewItems.map((item) => (
          <div key={item.id} className="card" style={{ padding: 14, borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)', background: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                <BookOpen size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: 14, lineHeight: 1.2 }}>
                  {item.lesson.title}
                </div>
                {item.lesson.description && (
                  <div style={{ marginTop: 4, color: 'var(--gray-600)', fontSize: 12 }}>
                    {item.lesson.description}
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {item.tag && (
                    <span style={{ fontSize: 11, borderRadius: 999, padding: '3px 8px', background: '#ECFEFF', color: '#0E7490', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Tag size={12} /> {item.tag}
                    </span>
                  )}
                  {item.lesson.tags.slice(0, 6).map((tg) => (
                    <span key={String(tg)} style={{ fontSize: 11, borderRadius: 999, padding: '3px 8px', background: '#F3F4F6', color: 'var(--gray-700)' }}>
                      {String(tg)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {item.lesson.content && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--gray-800)', whiteSpace: 'pre-wrap' }}>
                {item.lesson.content}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 6 }}>
                {tr('Моя заметка')}
              </div>
              <textarea
                className="form-input"
                value={item.note}
                onChange={(e) => setNoteValue(item.id, e.target.value)}
                placeholder={tr('Пиши сюда свои заметки по материалу...')}
                style={{ width: '100%', minHeight: 90, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => saveNote(item.id)}
                  disabled={savingId === item.id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <Save size={14} /> {savingId === item.id ? tr('Сохраняю...') : tr('Сохранить')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </MainLayout>
  );
}

