import { useEffect, useMemo, useState } from 'react';
import { Eye, CheckCircle, Clock, AlertCircle, Trash2, X, Send } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { feedbackAPI } from '../../api/content';

const STATUS_LABELS = { new: 'Новое', in_progress: 'В работе', closed: 'Закрыто' };
const STATUS_COLORS = { new: 'badge-blue', in_progress: 'badge-yellow', closed: 'badge-green' };
const STATUS_ICONS = {
  new: <AlertCircle size={14} />,
  in_progress: <Clock size={14} />,
  closed: <CheckCircle size={14} />,
};

const TYPE_LABELS = { review: 'Отзыв', suggestion: 'Предложение', complaint: 'Жалоба', question: 'Вопрос', other: 'Другое' };

function normalize(item) {
  return {
    id: item.id,
    type: item.type || 'review',
    text: item.text || item.message || '',
    status: item.status || 'new',
    isAnonymous: Boolean(item.is_anonymous),
    fullName: item.full_name || '',
    createdAt: item.created_at,
    adminReply: item.admin_reply || item.reply || '',
  };
}

export default function AdminFeedback() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const load = async () => {
    try {
      setLoading(true);
      const res = await feedbackAPI.list();
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setItems(list.map(normalize));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load().catch(() => setItems([])); }, []);

  const filtered = useMemo(
    () => (filterStatus === 'all' ? items : items.filter((i) => i.status === filterStatus)),
    [items, filterStatus]
  );

  const counts = useMemo(() => ({
    all: items.length,
    new: items.filter((i) => i.status === 'new').length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    closed: items.filter((i) => i.status === 'closed').length,
  }), [items]);

  const setStatus = async (id, status) => {
    try {
      await feedbackAPI.reply(id, { status });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, status }));
    } catch { flash('Не удалось изменить статус.'); }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setReplying(true);
    try {
      await feedbackAPI.reply(selected.id, { status: 'in_progress', admin_reply: replyText.trim() });
      const updated = { ...selected, adminReply: replyText.trim(), status: 'in_progress' };
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === selected.id ? updated : i)));
      setReplyText('');
      flash('Ответ отправлен.');
    } catch { flash('Не удалось отправить ответ.'); }
    finally { setReplying(false); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Удалить обращение?')) return;
    setDeleting(id);
    try {
      await feedbackAPI.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selected?.id === id) setSelected(null);
      flash('Обращение удалено.');
    } catch { flash('Не удалось удалить.'); }
    finally { setDeleting(null); }
  };

  const openSelected = (item) => { setSelected(item); setReplyText(''); };

  return (
    <MainLayout title="Админ-панель · Обратная связь">
      <div className="page-header">
        <div>
          <div className="page-title">Обратная связь</div>
          <div className="page-subtitle">Обращения сотрудников</div>
        </div>
      </div>

      {toast && <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#DCFCE7', color: '#166534', fontWeight: 600, fontSize: 13 }}>{toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { key: 'all', label: 'Всего' },
          { key: 'new', label: 'Новые' },
          { key: 'in_progress', label: 'В работе' },
          { key: 'closed', label: 'Закрыто' },
        ].map((s) => (
          <div key={s.key} className="card" style={{ cursor: 'pointer', outline: filterStatus === s.key ? '2px solid var(--primary)' : 'none' }} onClick={() => setFilterStatus(s.key)}>
            <div className="card-body" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{counts[s.key] || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 16 }}>Загрузка...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)' }}>Обращений нет.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Сообщение</th>
                  <th>Автор</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td><span className="badge badge-gray">{TYPE_LABELS[item.type] || item.type}</span></td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{item.text}</td>
                    <td style={{ fontSize: 13 }}>{item.isAnonymous ? 'Анонимно' : (item.fullName || 'Пользователь')}</td>
                    <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{item.createdAt ? new Date(item.createdAt).toLocaleString('ru-RU') : '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[item.status] || 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {STATUS_ICONS[item.status]} {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn-icon" title="Открыть" onClick={() => openSelected(item)}><Eye size={14} /></button>
                        {item.status !== 'in_progress' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(item.id, 'in_progress')}>В работу</button>}
                        {item.status !== 'closed' && <button className="btn btn-sm" style={{ background: 'var(--success-light)', color: 'var(--success)', border: 'none' }} onClick={() => setStatus(item.id, 'closed')}>Закрыть</button>}
                        <button className="btn-icon" title="Удалить" style={{ color: '#b91c1c' }} onClick={() => deleteItem(item.id)} disabled={deleting === item.id}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Обращение #{selected.id}</div>
              <button className="btn-icon" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 13 }}><b>Тип:</b> {TYPE_LABELS[selected.type] || selected.type}</div>
                <div style={{ fontSize: 13 }}><b>Автор:</b> {selected.isAnonymous ? 'Анонимно' : (selected.fullName || 'Пользователь')}</div>
                <div style={{ fontSize: 13 }}><b>Дата:</b> {selected.createdAt ? new Date(selected.createdAt).toLocaleString('ru-RU') : '—'}</div>
                <div style={{ fontSize: 13 }}>
                  <b>Статус:</b>{' '}
                  <span className={`badge ${STATUS_COLORS[selected.status] || 'badge-gray'}`}>{STATUS_LABELS[selected.status] || selected.status}</span>
                </div>
              </div>

              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Сообщение:</div>
              <div style={{ fontSize: 13, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '10px 12px', marginBottom: 16, lineHeight: 1.5 }}>
                {selected.text || '—'}
              </div>

              {selected.adminReply && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Ваш ответ:</div>
                  <div style={{ fontSize: 13, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '10px 12px', lineHeight: 1.5 }}>
                    {selected.adminReply}
                  </div>
                </div>
              )}

              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                {selected.adminReply ? 'Изменить ответ:' : 'Написать ответ:'}
              </div>
              <textarea
                className="form-input"
                rows={3}
                style={{ resize: 'vertical', marginBottom: 8 }}
                placeholder="Ваш ответ сотруднику..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={sendReply} disabled={replying || !replyText.trim()}>
                  <Send size={13} /> {replying ? 'Отправка...' : 'Отправить ответ'}
                </button>
                {selected.status !== 'closed' && (
                  <button className="btn btn-sm" style={{ background: 'var(--success-light)', color: 'var(--success)', border: 'none' }} onClick={() => setStatus(selected.id, 'closed')}>
                    <CheckCircle size={13} /> Закрыть обращение
                  </button>
                )}
                {selected.status !== 'in_progress' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setStatus(selected.id, 'in_progress')}>В работу</button>
                )}
                <button className="btn btn-secondary btn-sm" style={{ color: '#b91c1c', marginLeft: 'auto' }} onClick={() => deleteItem(selected.id)} disabled={deleting === selected.id}>
                  <Trash2 size={13} /> Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
