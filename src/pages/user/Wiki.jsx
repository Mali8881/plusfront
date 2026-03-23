import { useEffect, useState } from 'react';
import { Plus, X, BookOpen, AlertTriangle, Clock, CheckCircle, Send } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { wikiAPI } from '../../api/content';

const STATUS_META = {
  draft:        { label: 'Черновик',      color: '#64748b', bg: '#f8fafc' },
  under_review: { label: 'На проверке',   color: '#f59e0b', bg: '#fffbeb' },
  published:    { label: 'Опубликовано',  color: '#22c55e', bg: '#f0fdf4' },
};

const TABS = [
  { key: 'wiki',   label: 'Wiki сообщества', icon: BookOpen },
  { key: 'fails',  label: 'Архив провалов',  icon: AlertTriangle },
  { key: 'my',     label: 'Мои статьи',      icon: Clock },
];

const ADMIN_TABS = [
  ...TABS,
  { key: 'moderation', label: 'Модерация', icon: CheckCircle },
];

const CAN_MODERATE = ['admin', 'administrator', 'superadmin', 'systemadmin'];

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
      background: m.bg, color: m.color, border: `1px solid ${m.color}40`,
    }}>{m.label}</span>
  );
}

function TagList({ tags }) {
  if (!tags?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {tags.map((t) => (
        <span key={t} style={{
          fontSize: 11, padding: '2px 7px', borderRadius: 10,
          background: '#eff6ff', color: '#2563eb',
        }}>{t}</span>
      ))}
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(ts));
}

// ─── Article card ────────────────────────────────────────────────────────────
function ArticleCard({ item, onOpen, actions }) {
  return (
    <div className="card" style={{ border: '1px solid var(--gray-200)', cursor: 'pointer' }} onClick={() => onOpen(item)}>
      <div className="card-body" style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</div>
          {item.status && <StatusBadge status={item.status} />}
        </div>
        <div style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.5 }}>
          {String(item.body || '').slice(0, 180)}{item.body?.length > 180 ? '…' : ''}
        </div>
        <TagList tags={item.tags} />
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--gray-400)', flexWrap: 'wrap' }}>
          {item.author_name && <span>Автор: {item.author_name}</span>}
          {item.category_name && <span>Категория: {item.category_name}</span>}
          <span>{formatDate(item.updated_at || item.created_at)}</span>
        </div>
        {actions && <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>{actions}</div>}
      </div>
    </div>
  );
}

// ─── Fail card ───────────────────────────────────────────────────────────────
function FailCard({ item, actions }) {
  return (
    <div className="card" style={{ border: '1px solid #fecaca' }}>
      <div className="card-body" style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#b91c1c' }}>💥 {item.title}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 2 }}>Что пошло не так</div>
          <div style={{ fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.5 }}>{item.what_happened}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 2 }}>Урок</div>
          <div style={{ fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.5 }}>{item.lesson_learned}</div>
        </div>
        <TagList tags={item.tags} />
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--gray-400)' }}>
          <span>{item.author_display}</span>
          <span>{formatDate(item.created_at)}</span>
        </div>
        {actions && <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>{actions}</div>}
      </div>
    </div>
  );
}

// ─── Article detail modal ────────────────────────────────────────────────────
function ArticleModal({ item, onClose, onSubmit, onDelete, isOwn, canModerate }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  if (!item) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="modal-title">{item.title}</div>
            {item.status && <StatusBadge status={item.status} />}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
          {item.category_name && <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Категория: {item.category_name}</div>}
          <TagList tags={item.tags} />
          <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#1e293b' }}>{item.body}</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
            Автор: {item.author_name} · {formatDate(item.updated_at)}
          </div>
          {item.reject_reason && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
              Причина отклонения: {item.reject_reason}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isOwn && item.status === 'draft' && (
              <button className="btn btn-primary btn-sm" onClick={() => onSubmit(item.id)}>
                <Send size={13} /> Отправить на проверку
              </button>
            )}
            {isOwn && item.status === 'draft' && (
              <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => onDelete(item.id)}>
                Удалить
              </button>
            )}
            {canModerate && item.status === 'under_review' && !showReject && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => onClose('approve', item.id)}>✅ Одобрить</button>
                <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => setShowReject(true)}>❌ Отклонить</button>
              </>
            )}
            {canModerate && showReject && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                <input
                  className="form-input"
                  placeholder="Причина отклонения"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }}
                  onClick={() => rejectReason.trim() && onClose('reject', item.id, rejectReason)}>
                  Отклонить
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowReject(false)}>Отмена</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Wiki() {
  const { user } = useAuth();
  const canModerate = CAN_MODERATE.includes(user?.role);

  const [tab, setTab] = useState('wiki');
  const [wikiItems, setWikiItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [fails, setFails] = useState([]);
  const [queue, setQueue] = useState([]);
  const [failQueue, setFailQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showCreateWiki, setShowCreateWiki] = useState(false);
  const [showCreateFail, setShowCreateFail] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);

  // Forms
  const [wikiForm, setWikiForm] = useState({ title: '', body: '', tags: '' });
  const [failForm, setFailForm] = useState({ title: '', what_happened: '', lesson_learned: '', tags: '', is_anonymous: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [wRes, mRes, fRes, qRes, fqRes] = await Promise.all([
        wikiAPI.list().catch(() => ({ data: [] })),
        wikiAPI.my().catch(() => ({ data: [] })),
        wikiAPI.fails().catch(() => ({ data: [] })),
        canModerate ? wikiAPI.moderationQueue().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        canModerate ? wikiAPI.failsQueue().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setWikiItems(Array.isArray(wRes.data) ? wRes.data : []);
      setMyItems(Array.isArray(mRes.data) ? mRes.data : []);
      setFails(Array.isArray(fRes.data) ? fRes.data : []);
      setQueue(Array.isArray(qRes.data) ? qRes.data : []);
      setFailQueue(Array.isArray(fqRes.data) ? fqRes.data : []);
    } catch {
      setError('Не удалось загрузить данные.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const parseTags = (str) => str.split(',').map((t) => t.trim()).filter(Boolean);

  const handleCreateWiki = async () => {
    if (!wikiForm.title.trim() || !wikiForm.body.trim()) return;
    setSaving(true);
    try {
      await wikiAPI.create({ title: wikiForm.title.trim(), body: wikiForm.body.trim(), tags: parseTags(wikiForm.tags) });
      setWikiForm({ title: '', body: '', tags: '' });
      setShowCreateWiki(false);
      await load();
    } catch { setError('Не удалось создать статью.'); }
    finally { setSaving(false); }
  };

  const handleUpdateWiki = async () => {
    if (!editingArticle || !wikiForm.title.trim()) return;
    setSaving(true);
    try {
      await wikiAPI.update(editingArticle.id, { title: wikiForm.title.trim(), body: wikiForm.body.trim(), tags: parseTags(wikiForm.tags) });
      setEditingArticle(null);
      setWikiForm({ title: '', body: '', tags: '' });
      await load();
    } catch { setError('Не удалось обновить статью.'); }
    finally { setSaving(false); }
  };

  const handleSubmitForReview = async (id) => {
    try {
      await wikiAPI.submit(id);
      setSelectedArticle(null);
      await load();
    } catch { setError('Не удалось отправить на проверку.'); }
  };

  const handleDeleteArticle = async (id) => {
    try {
      await wikiAPI.remove(id);
      setSelectedArticle(null);
      await load();
    } catch { setError('Не удалось удалить.'); }
  };

  const handleArticleModalClose = async (action, id, reason) => {
    if (action === 'approve' || action === 'reject') {
      try {
        await wikiAPI.moderate(id, { action, reason });
        await load();
      } catch { setError('Не удалось выполнить модерацию.'); }
    }
    setSelectedArticle(null);
  };

  const handleCreateFail = async () => {
    if (!failForm.title.trim() || !failForm.what_happened.trim() || !failForm.lesson_learned.trim()) return;
    setSaving(true);
    try {
      await wikiAPI.submitFail({
        title: failForm.title.trim(),
        what_happened: failForm.what_happened.trim(),
        lesson_learned: failForm.lesson_learned.trim(),
        tags: parseTags(failForm.tags),
        is_anonymous: failForm.is_anonymous,
      });
      setFailForm({ title: '', what_happened: '', lesson_learned: '', tags: '', is_anonymous: true });
      setShowCreateFail(false);
      await load();
    } catch { setError('Не удалось отправить.'); }
    finally { setSaving(false); }
  };

  const handleModerateFail = async (id, action, reason) => {
    try {
      await wikiAPI.moderateFail(id, { action, reason });
      await load();
    } catch { setError('Не удалось выполнить модерацию.'); }
  };

  const tabs = canModerate ? ADMIN_TABS : TABS;
  const moderationCount = queue.length + failQueue.length;

  return (
    <MainLayout title="База знаний">
      <div style={{ maxWidth: 960, display: 'grid', gap: 20 }}>

        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">База знаний</div>
            <div className="page-subtitle">Wiki сообщества · Архив провалов · Обмен опытом</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {tab === 'wiki' && <button className="btn btn-primary" onClick={() => { setShowCreateWiki(true); setWikiForm({ title: '', body: '', tags: '' }); }}><Plus size={14} /> Написать статью</button>}
            {tab === 'fails' && <button className="btn btn-primary" onClick={() => { setShowCreateFail(true); setFailForm({ title: '', what_happened: '', lesson_learned: '', tags: '', is_anonymous: true }); }}><Plus size={14} /> Поделиться опытом</button>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const isModTab = t.key === 'moderation';
            return (
              <button
                key={t.key}
                className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTab(t.key)}
                style={{ position: 'relative' }}
              >
                <Icon size={14} /> {t.label}
                {isModTab && moderationCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    background: '#ef4444', color: '#fff',
                    borderRadius: '50%', width: 18, height: 18,
                    fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{moderationCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}

        {loading ? (
          <div className="card"><div className="card-body">Загрузка...</div></div>
        ) : (
          <>
            {/* Wiki tab */}
            {tab === 'wiki' && (
              <div style={{ display: 'grid', gap: 12 }}>
                {wikiItems.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Опубликованных статей пока нет. Будьте первым!</div>}
                {wikiItems.map((item) => (
                  <ArticleCard key={item.id} item={item} onOpen={setSelectedArticle} />
                ))}
              </div>
            )}

            {/* Fails tab */}
            {tab === 'fails' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', padding: '8px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                  💡 Все записи анонимны по умолчанию. Делитесь опытом ошибок — это помогает команде расти.
                </div>
                {fails.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Пока нет записей. Поделитесь своим опытом!</div>}
                {fails.map((f) => <FailCard key={f.id} item={f} />)}
              </div>
            )}

            {/* My articles tab */}
            {tab === 'my' && (
              <div style={{ display: 'grid', gap: 12 }}>
                {myItems.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>У вас ещё нет статей. Напишите первую!</div>}
                {myItems.map((item) => (
                  <ArticleCard
                    key={item.id}
                    item={item}
                    onOpen={(a) => setSelectedArticle(a)}
                    actions={
                      item.status === 'draft' ? (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => {
                            setEditingArticle(item);
                            setWikiForm({ title: item.title, body: item.body, tags: (item.tags || []).join(', ') });
                          }}>Редактировать</button>
                          <button className="btn btn-primary btn-sm" onClick={() => handleSubmitForReview(item.id)}>
                            <Send size={12} /> На проверку
                          </button>
                        </>
                      ) : null
                    }
                  />
                ))}
              </div>
            )}

            {/* Moderation tab */}
            {tab === 'moderation' && canModerate && (
              <div style={{ display: 'grid', gap: 20 }}>
                {/* Wiki queue */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                    Статьи на проверке ({queue.length})
                  </div>
                  {queue.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Очередь пуста.</div>}
                  <div style={{ display: 'grid', gap: 10 }}>
                    {queue.map((item) => (
                      <ArticleCard
                        key={item.id}
                        item={item}
                        onOpen={setSelectedArticle}
                        actions={
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => handleArticleModalClose('approve', item.id)}>✅ Одобрить</button>
                            <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }}
                              onClick={() => {
                                const r = window.prompt('Причина отклонения:');
                                if (r?.trim()) handleArticleModalClose('reject', item.id, r.trim());
                              }}>
                              ❌ Отклонить
                            </button>
                          </>
                        }
                      />
                    ))}
                  </div>
                </div>

                {/* Fails queue */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                    Архив провалов на проверке ({failQueue.length})
                  </div>
                  {failQueue.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Очередь пуста.</div>}
                  <div style={{ display: 'grid', gap: 10 }}>
                    {failQueue.map((f) => (
                      <FailCard
                        key={f.id}
                        item={f}
                        actions={
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => handleModerateFail(f.id, 'approve')}>✅ Одобрить</button>
                            <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }}
                              onClick={() => {
                                const r = window.prompt('Причина отклонения:');
                                if (r?.trim()) handleModerateFail(f.id, 'reject', r.trim());
                              }}>
                              ❌ Отклонить
                            </button>
                          </>
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Article detail modal */}
        {selectedArticle && (
          <ArticleModal
            item={selectedArticle}
            onClose={handleArticleModalClose}
            onSubmit={handleSubmitForReview}
            onDelete={handleDeleteArticle}
            isOwn={selectedArticle.author === user?.id}
            canModerate={canModerate}
          />
        )}

        {/* Create wiki modal */}
        {(showCreateWiki || editingArticle) && (
          <div className="modal-overlay" onClick={() => { setShowCreateWiki(false); setEditingArticle(null); }}>
            <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">{editingArticle ? 'Редактировать статью' : 'Новая статья'}</div>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreateWiki(false); setEditingArticle(null); }}><X size={14} /></button>
              </div>
              <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
                <input className="form-input" placeholder="Заголовок*" value={wikiForm.title} onChange={(e) => setWikiForm((p) => ({ ...p, title: e.target.value }))} />
                <textarea className="form-textarea" rows={8} placeholder="Текст статьи*" value={wikiForm.body} onChange={(e) => setWikiForm((p) => ({ ...p, body: e.target.value }))} />
                <input className="form-input" placeholder="Теги через запятую (например: React, TypeScript)" value={wikiForm.tags} onChange={(e) => setWikiForm((p) => ({ ...p, tags: e.target.value }))} />
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  После создания статью нужно отправить на проверку. Она появится публично только после одобрения администратора.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" disabled={saving} onClick={editingArticle ? handleUpdateWiki : handleCreateWiki}>
                    {saving ? 'Сохранение...' : editingArticle ? 'Сохранить' : 'Создать черновик'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setShowCreateWiki(false); setEditingArticle(null); }}>Отмена</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create fail modal */}
        {showCreateFail && (
          <div className="modal-overlay" onClick={() => setShowCreateFail(false)}>
            <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Поделиться опытом ошибки</div>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateFail(false)}><X size={14} /></button>
              </div>
              <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', padding: '8px 12px', background: '#fffbeb', borderRadius: 8 }}>
                  Ваш опыт поможет другим избежать тех же ошибок. Запись появится после проверки администратором.
                </div>
                <input className="form-input" placeholder="Кратко: что за ситуация?*" value={failForm.title} onChange={(e) => setFailForm((p) => ({ ...p, title: e.target.value }))} />
                <textarea className="form-textarea" rows={3} placeholder="Что пошло не так?*" value={failForm.what_happened} onChange={(e) => setFailForm((p) => ({ ...p, what_happened: e.target.value }))} />
                <textarea className="form-textarea" rows={3} placeholder="Что понял / как исправил?*" value={failForm.lesson_learned} onChange={(e) => setFailForm((p) => ({ ...p, lesson_learned: e.target.value }))} />
                <input className="form-input" placeholder="Теги через запятую" value={failForm.tags} onChange={(e) => setFailForm((p) => ({ ...p, tags: e.target.value }))} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={failForm.is_anonymous} onChange={(e) => setFailForm((p) => ({ ...p, is_anonymous: e.target.checked }))} />
                  Опубликовать анонимно (рекомендуется)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" disabled={saving} onClick={handleCreateFail}>
                    {saving ? 'Отправка...' : 'Отправить на проверку'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowCreateFail(false)}>Отмена</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
