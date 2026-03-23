import { useEffect, useMemo, useState } from 'react';
import { Eye, CheckCircle, Clock, AlertCircle, Trash2, X, Send, MessageSquare, Star } from 'lucide-react';
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

function normalizeFeedback(item) {
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

function normalizeExitSurvey(item) {
  return {
    id: item.id,
    reason: item.reason || '',
    managementRating: Number(item.management_rating || 0),
    comment: item.comment || '',
    createdAt: item.created_at,
  };
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
}

export default function AdminFeedback() {
  const [mode, setMode] = useState('tickets');
  const [tickets, setTickets] = useState([]);
  const [exitSurveys, setExitSurveys] = useState([]);
  const [exitSummary, setExitSummary] = useState({ total: 0, average_rating: null, by_rating: {} });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedExitSurvey, setSelectedExitSurvey] = useState(null);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const load = async () => {
    try {
      setLoading(true);
      const [ticketsRes, exitRes] = await Promise.all([
        feedbackAPI.list(),
        feedbackAPI.exitSurveys().catch(() => ({ data: { items: [], summary: { total: 0, average_rating: null, by_rating: {} } } })),
      ]);
      const ticketItems = Array.isArray(ticketsRes.data) ? ticketsRes.data : (ticketsRes.data?.results || []);
      const exitPayload = exitRes.data || {};
      setTickets(ticketItems.map(normalizeFeedback));
      setExitSurveys((Array.isArray(exitPayload.items) ? exitPayload.items : []).map(normalizeExitSurvey));
      setExitSummary(exitPayload.summary || { total: 0, average_rating: null, by_rating: {} });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {
      setTickets([]);
      setExitSurveys([]);
      setExitSummary({ total: 0, average_rating: null, by_rating: {} });
    });
  }, []);

  const filteredTickets = useMemo(
    () => (filterStatus === 'all' ? tickets : tickets.filter((item) => item.status === filterStatus)),
    [tickets, filterStatus]
  );

  const ticketCounts = useMemo(
    () => ({
      all: tickets.length,
      new: tickets.filter((item) => item.status === 'new').length,
      in_progress: tickets.filter((item) => item.status === 'in_progress').length,
      closed: tickets.filter((item) => item.status === 'closed').length,
    }),
    [tickets]
  );

  const setStatus = async (id, status) => {
    try {
      await feedbackAPI.reply(id, { status });
      setTickets((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, status }));
      if (selectedTicket?.id === id) setSelectedTicket((prev) => ({ ...prev, status }));
    } catch { flash('Не удалось изменить статус.'); }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setReplying(true);
    try {
      await feedbackAPI.reply(selected.id, { status: 'in_progress', admin_reply: replyText.trim() });
      const updated = { ...selected, adminReply: replyText.trim(), status: 'in_progress' };
      setSelected(updated);
      setTickets((prev) => prev.map((i) => (i.id === selected.id ? updated : i)));
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
      setTickets((prev) => prev.filter((i) => i.id !== id));
      if (selected?.id === id) setSelected(null);
      if (selectedTicket?.id === id) setSelectedTicket(null);
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
          <div className="page-subtitle">Обычные обращения и отдельный анонимный поток exit-интервью</div>
        </div>
      </div>

      {toast && <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#DCFCE7', color: '#166534', fontWeight: 600, fontSize: 13 }}>{toast}</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          className={mode === 'tickets' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setMode('tickets')}
        >
          <MessageSquare size={15} /> Обращения
        </button>
        <button
          className={mode === 'exit' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setMode('exit')}
        >
          <Star size={15} /> Exit-интервью
        </button>
      </div>

      {mode === 'tickets' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { key: 'all', label: 'Всего' },
              { key: 'new', label: 'Новые' },
              { key: 'in_progress', label: 'В работе' },
              { key: 'closed', label: 'Закрыто' },
            ].map((s) => (
              <div key={s.key} className="card" style={{ cursor: 'pointer', outline: filterStatus === s.key ? '2px solid var(--primary)' : 'none' }} onClick={() => setFilterStatus(s.key)}>
                <div className="card-body" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{ticketCounts[s.key] || 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 16 }}>Загрузка...</div>
              ) : filteredTickets.length === 0 ? (
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
                    {filteredTickets.map((item) => (
                      <tr key={item.id}>
                        <td><span className="badge badge-gray">{TYPE_LABELS[item.type] || item.type}</span></td>
                        <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{item.text}</td>
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
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div className="card">
              <div className="card-body" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{exitSummary.total || 0}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>Всего анонимных отзывов</div>
              </div>
            </div>
            <div className="card">
              <div className="card-body" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{exitSummary.average_rating ?? '-'}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>Средняя оценка менеджмента</div>
              </div>
            </div>
            <div className="card">
              <div className="card-body" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <span key={rating} className="badge badge-gray">
                      {rating}: {exitSummary.by_rating?.[String(rating)] || 0}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>Распределение оценок</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: '14px 16px', color: 'var(--gray-600)', fontSize: 13 }}>
              Ответы после отправки больше не связаны с карточкой конкретного сотрудника и отображаются только здесь в анонимном виде.
            </div>
          </div>

          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 16 }}>Загрузка...</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Причина ухода</th>
                      <th>Комментарий</th>
                      <th>Оценка менеджмента</th>
                      <th>Дата</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exitSurveys.map((item) => (
                      <tr key={item.id}>
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{item.reason}</td>
                        <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{item.comment || '—'}</td>
                        <td>
                          <span className="badge badge-blue">{item.managementRating}/5</span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{formatDateTime(item.createdAt)}</td>
                        <td>
                          <button className="btn-icon" title="Посмотреть" onClick={() => setSelectedExitSurvey(item)}>
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!exitSurveys.length ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 16, color: 'var(--gray-500)' }}>
                          Пока нет отправленных exit-интервью.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

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

      {selectedTicket ? (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Обращение #{selectedTicket.id}</div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTicket(null)}>Закрыть</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 10 }}><b>Тип:</b> {TYPE_LABELS[selectedTicket.type] || selectedTicket.type}</div>
              <div style={{ marginBottom: 10 }}><b>Статус:</b> {STATUS_LABELS[selectedTicket.status] || selectedTicket.status}</div>
              <div style={{ marginBottom: 10 }}><b>Автор:</b> {selectedTicket.isAnonymous ? 'Анонимно' : (selectedTicket.fullName || 'Пользователь')}</div>
              <div><b>Текст:</b><div style={{ marginTop: 6 }}>{selectedTicket.text}</div></div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedExitSurvey ? (
        <div className="modal-overlay" onClick={() => setSelectedExitSurvey(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Анонимное exit-интервью #{selectedExitSurvey.id}</div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedExitSurvey(null)}>Закрыть</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 10 }}><b>Дата:</b> {formatDateTime(selectedExitSurvey.createdAt)}</div>
              <div style={{ marginBottom: 10 }}><b>Оценка менеджмента:</b> {selectedExitSurvey.managementRating}/5</div>
              <div style={{ marginBottom: 10 }}>
                <b>Причина ухода:</b>
                <div style={{ marginTop: 6 }}>{selectedExitSurvey.reason}</div>
              </div>
              <div>
                <b>Комментарий:</b>
                <div style={{ marginTop: 6 }}>{selectedExitSurvey.comment || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
}
