import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, CheckCircle, Clock, AlertCircle, X, Eye } from 'lucide-react';
import { feedbackAPI } from '../../api/content';
import { normalizeRole } from '../../utils/roles';
import { getFeedbackTypeLabel, normalizeFeedbackType } from '../../utils/feedback';

const STATUS_LABELS = { new: 'Новое', in_progress: 'В работе', resolved: 'Решено' };
const STATUS_COLORS = { new: 'badge-blue', in_progress: 'badge-yellow', resolved: 'badge-green' };
const STATUS_ICONS = { new: <AlertCircle size={14} />, in_progress: <Clock size={14} />, resolved: <CheckCircle size={14} /> };

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function normalizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'resolved' || s === 'closed' || s === 'done') return 'resolved';
  if (s === 'in_progress' || s === 'processing' || s === 'pending') return 'in_progress';
  return 'new';
}

function normalizeTicket(raw = {}) {
  const typeCode = normalizeFeedbackType(raw.type || raw.category || raw.kind || raw.type_label);
  const normalizedType = raw.type_label || getFeedbackTypeLabel(typeCode);

  return {
    id: raw.id,
    typeCode,
    type: normalizedType,
    text: raw.text || raw.message || raw.body || '',
    user: raw.full_name || raw.user_name || raw.user?.full_name || raw.user?.username || raw.author_name || (raw.is_anonymous ? 'Анонимно' : '—'),
    userRole: normalizeRole(raw.sender_role || raw.user_role || raw.user?.role || raw.user?.role_code || 'employee'),
    isAnonymous: Boolean(raw.is_anonymous),
    date: raw.created_at ? new Date(raw.created_at).toLocaleString('ru-RU') : raw.date || '—',
    status: normalizeStatus(raw.status || raw.state),
  };
}

export default function AdminFeedback() {
  const { user, isSuperAdmin } = useAuth();
  const normalizedRole = normalizeRole(user?.role);
  const canModerate = ['admin', 'administrator', 'projectmanager'].includes(normalizedRole);
  const [items, setItems] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const loadTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await feedbackAPI.list();
      setItems(safeList(res.data).map(normalizeTicket));
    } catch (err) {
      setItems([]);
      setError(err?.response?.data?.detail || 'Не удалось загрузить обращения');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const baseItems = useMemo(
    () =>
      isSuperAdmin
        ? items
        : items.filter((i) => ['intern', 'employee', 'projectmanager'].includes(i.userRole)),
    [isSuperAdmin, items]
  );

  const filtered = useMemo(
    () => (filterStatus === 'all' ? baseItems : baseItems.filter((i) => i.status === filterStatus)),
    [baseItems, filterStatus]
  );

  const counts = useMemo(
    () => ({
      all: baseItems.length,
      new: baseItems.filter((i) => i.status === 'new').length,
      in_progress: baseItems.filter((i) => i.status === 'in_progress').length,
      resolved: baseItems.filter((i) => i.status === 'resolved').length,
    }),
    [baseItems]
  );

  const setStatus = async (id, status) => {
    if (!canModerate) {
      setActionError('Для этой роли доступен только просмотр обращений.');
      return;
    }

    try {
      await feedbackAPI.reply(id, { status });
    } catch (err) {
      setActionError(err?.response?.data?.detail || 'Не удалось изменить статус обращения');
      return;
    }

    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    if (selected?.id === id) setSelected((s) => ({ ...s, status }));
  };

  return (
    <MainLayout title="Админ-панель · Обратная связь">
      <div className="page-header">
        <div>
          <div className="page-title">Обратная связь</div>
          <div className="page-subtitle">
            {isSuperAdmin
              ? 'История жалоб сотрудников и стажеров (только просмотр).'
              : canModerate
              ? 'Жалобы сотрудников и стажеров, направленные администраторам.'
              : 'Просмотр обращений без права изменения статусов для текущей роли.'}
          </div>
        </div>
      </div>

      {actionError && (
        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--danger)' }}>
          {actionError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { key: 'all', label: 'Всего', color: 'var(--gray-800)' },
          { key: 'new', label: 'Новые', color: 'var(--primary)' },
          { key: 'in_progress', label: 'В работе', color: 'var(--warning)' },
          { key: 'resolved', label: 'Решено', color: 'var(--success)' },
        ].map((s) => (
          <div key={s.key} className="card" style={{ cursor: 'pointer', border: filterStatus === s.key ? `2px solid ${s.color}` : undefined }} onClick={() => setFilterStatus(s.key)}>
            <div className="card-body" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{counts[s.key]}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Сообщение</th>
                <th>Сотрудник</th>
                <th>Формат</th>
                <th>Дата</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--gray-500)' }}>Загрузка...</td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--danger)' }}>{error}</td>
                </tr>
              )}

              {!loading && !error && filtered.map((item) => (
                <tr key={item.id}>
                  <td><span className="badge badge-gray">{item.type}</span></td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{item.text}</td>
                  <td style={{ fontSize: 13 }}>{item.user}</td>
                  <td>
                    <span className={`badge ${item.isAnonymous ? 'badge-yellow' : 'badge-blue'}`}>
                      {item.isAnonymous ? 'Анонимно' : 'Неанонимно'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{item.date}</td>
                  <td>
                    <span className={`badge ${STATUS_COLORS[item.status]}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {STATUS_ICONS[item.status]} {STATUS_LABELS[item.status]}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" title="Посмотреть" onClick={() => setSelected(item)}><Eye size={14} /></button>
                      {canModerate && item.status !== 'in_progress' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(item.id, 'in_progress')}>В работу</button>}
                      {canModerate && item.status !== 'resolved' && <button className="btn btn-sm" style={{ background: 'var(--success-light)', color: 'var(--success)', border: 'none' }} onClick={() => setStatus(item.id, 'resolved')}>Решено</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && !error && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
              Обращений нет
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Обращение #{selected.id}</div>
              <button className="btn-icon" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>Тип</div><span className="badge badge-gray">{selected.type}</span></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>Статус</div><span className={`badge ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>Сотрудник</div><span style={{ fontSize: 13 }}>{selected.user}</span></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>Формат</div><span style={{ fontSize: 13 }}>{selected.isAnonymous ? 'Анонимно' : 'Неанонимно'}</span></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>Дата</div><span style={{ fontSize: 13 }}>{selected.date}</span></div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 8 }}>Сообщение</div>
                <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: 12, fontSize: 14, lineHeight: 1.6 }}>{selected.text}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Закрыть</button>
              {canModerate && selected.status !== 'resolved' && (
                <button className="btn btn-primary" onClick={() => { setStatus(selected.id, 'resolved'); setSelected(null); }}>
                  <CheckCircle size={14} /> Отметить решенным
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
