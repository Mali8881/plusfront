import { useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { USERS, ONBOARDING_DAYS } from '../../data/mockData';
import { CheckCircle, XCircle, RotateCcw, Eye, X, MessageSquare } from 'lucide-react';

const STATUS = { draft: { label: 'Черновик', cls: 'badge-gray' }, sent: { label: 'Отправлен', cls: 'badge-blue' }, accepted: { label: 'Принят', cls: 'badge-green' }, rework: { label: 'На доработке', cls: 'badge-yellow' }, rejected: { label: 'Отклонён', cls: 'badge-red' } };

const REPORTS = [
  { id: 1, user: USERS[0], day: 1, date: '25 Окт 2025', status: 'sent', did: 'Изучил внутренние регламенты компании, ознакомился со структурой отделов. Прошёл вводный инструктаж по безопасности. Настроил рабочее окружение.', willDo: 'Завтра планирую начать изучение модуля по продукту и встретиться с ментором.', blockers: 'Проблем не возникло, все доступы работают корректно.' },
  { id: 2, user: USERS[2], day: 1, date: '25 Окт 2025', status: 'draft', did: '', willDo: '', blockers: '' },
];

const INTERN_TASK_PROGRESS = {
  1: { 1: { done: 3, total: 4 }, 2: { done: 1, total: 2 } },
  3: { 1: { done: 2, total: 4 }, 2: { done: 0, total: 2 } },
  5: { 1: { done: 1, total: 4 }, 2: { done: 0, total: 2 } },
};

export default function AdminOnboarding() {
  const [reports, setReports] = useState(REPORTS);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [tab, setTab] = useState('reports');
  const [toast, setToast] = useState(null);
  const interns = USERS.filter(u => u.role === 'intern');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  const getDayProgress = (userId, dayId) => INTERN_TASK_PROGRESS[userId]?.[dayId] || { done: 0, total: 0 };
  const getDayPercent = (userId, dayId) => {
    const { done, total } = getDayProgress(userId, dayId);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };
  const getTotalPercent = (userId) => {
    const perDays = ONBOARDING_DAYS.map(d => getDayProgress(userId, d.id));
    const done = perDays.reduce((sum, d) => sum + d.done, 0);
    const total = perDays.reduce((sum, d) => sum + d.total, 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  const setStatus = (id, status) => {
    setReports(rs => rs.map(r => r.id === id ? { ...r, status, comment: status === 'rework' ? comment : r.comment } : r));
    setSelected(null);
    setComment('');
    showToast(status === 'accepted' ? 'Отчёт принят' : status === 'rework' ? 'Отправлен на доработку' : 'Отчёт отклонён');
  };

  return (
    <MainLayout title="Админ-панель · Онбординг / Отчёты">
      <div className="page-header">
        <div className="page-title">Онбординг / Отчёты</div>
        <div className="page-subtitle">Управление программами онбординга и проверка отчётов стажёров</div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>Отчёты стажёров</button>
        <button className={`tab-btn ${tab === 'programs' ? 'active' : ''}`} onClick={() => setTab('programs')}>Программы</button>
        <button className={`tab-btn ${tab === 'days' ? 'active' : ''}`} onClick={() => setTab('days')}>Дни онбординга</button>
      </div>

      {tab === 'reports' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Прогресс тестовых задач по стажёрам</span>
            </div>
            <div className="card-body" style={{ display: 'grid', gap: 12 }}>
              {interns.map(intern => {
                const totalPercent = getTotalPercent(intern.id);
                return (
                  <div key={intern.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{intern.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{intern.department}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: totalPercent === 100 ? 'var(--success)' : 'var(--primary)' }}>
                        Общий прогресс: {totalPercent}%
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                      {ONBOARDING_DAYS.map(day => {
                        const p = getDayProgress(intern.id, day.id);
                        const percent = getDayPercent(intern.id, day.id);
                        return (
                          <div key={day.id} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '8px 10px' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>День {day.dayNumber}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>{p.done}/{p.total} задач</div>
                            <div style={{ height: 6, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${percent}%`, background: percent === 100 ? '#16A34A' : '#2563EB' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>СТАЖЁР</th>
                    <th>ДЕНЬ</th>
                    <th>ПРОГРЕСС ЗАДАЧ</th>
                    <th>ДАТА</th>
                    <th>СТАТУС</th>
                    <th>ДЕЙСТВИЯ</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => {
                    const progress = getDayProgress(r.user.id, r.day);
                    const percent = getDayPercent(r.user.id, r.day);
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="user-cell">
                            <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                              {r.user.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{r.user.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.user.department}</div>
                            </div>
                          </div>
                        </td>
                        <td>День {r.day}</td>
                        <td>
                          <div style={{ minWidth: 160 }}>
                            <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 4 }}>{progress.done}/{progress.total} задач · {percent}%</div>
                            <div style={{ height: 6, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${percent}%`, background: percent === 100 ? '#16A34A' : '#2563EB' }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{r.date}</td>
                        <td><span className={`badge ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn-icon" onClick={() => setSelected(r)} title="Просмотр"><Eye size={14} /></button>
                            {r.status === 'sent' && (
                              <>
                                <button className="btn-icon" style={{ color: 'var(--success)' }} onClick={() => setStatus(r.id, 'accepted')} title="Принять"><CheckCircle size={14} /></button>
                                <button className="btn-icon" style={{ color: 'var(--warning)' }} onClick={() => { setSelected(r); }} title="На доработку"><RotateCcw size={14} /></button>
                                <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setStatus(r.id, 'rejected')} title="Отклонить"><XCircle size={14} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'programs' && (
        <div className="card">
          <div className="card-body">
            <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Программы онбординга по отделам будут здесь.</p>
          </div>
        </div>
      )}

      {tab === 'days' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ONBOARDING_DAYS.map(d => (
            <div key={d.id} className="card">
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>День {d.dayNumber}: {d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{d.stage} · {d.docs.length} документов · {d.taskTitles.length} задач</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm">Редактировать</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ width: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Отчёт — {selected.user.name}, День {selected.day}</div>
              <button className="btn-icon" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 16 }}>
                {[['ДЕНЬ', `День ${selected.day}`], ['ДАТА', selected.date], ['АВТОР', selected.user.name.split(' ')[0]], ['СТАТУС', selected.status]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                    {l === 'СТАТУС'
                      ? <span className={`badge ${STATUS[v]?.cls}`}>{STATUS[v]?.label}</span>
                      : <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
                    }
                  </div>
                ))}
              </div>
              {[['Что сделал', selected.did || '—'], ['Что буду делать', selected.willDo || '—'], ['Какие проблемы возникли', selected.blockers || '—']].map(([label, val]) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-700)', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '10px 14px', lineHeight: 1.6 }}>{val}</div>
                </div>
              ))}
              {selected.status === 'sent' && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Комментарий (для доработки)</div>
                  <textarea className="form-textarea" value={comment} onChange={e => setComment(e.target.value)} placeholder="Напишите комментарий для стажёра..." style={{ minHeight: 80 }} />
                </div>
              )}
            </div>
            {selected.status === 'sent' && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelected(null)}>Закрыть</button>
                <button className="btn btn-sm" style={{ background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }} onClick={() => setStatus(selected.id, 'rework')}>
                  <RotateCcw size={13} /> На доработку
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setStatus(selected.id, 'rejected')}>Отклонить</button>
                <button className="btn btn-primary btn-sm" onClick={() => setStatus(selected.id, 'accepted')}>
                  <CheckCircle size={13} /> Принять
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast toast-success">
          <div><div className="toast-title">Готово</div><div className="toast-msg">{toast}</div></div>
        </div>
      )}
    </MainLayout>
  );
}
