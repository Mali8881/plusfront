import { useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { ONBOARDING_DAYS } from '../../data/mockData';
import { Clock, Download, ExternalLink, CheckCircle, Send, AlertCircle, CheckSquare, Square } from 'lucide-react';

const STATUS_LABELS = { draft: 'Черновик', sent: 'Отправлен', accepted: 'Принят', rework: 'На доработке', rejected: 'Отклонён' };
const STATUS_COLORS = { draft: 'badge-gray', sent: 'badge-blue', accepted: 'badge-green', rework: 'badge-yellow', rejected: 'badge-red' };

const INIT_TASKS = {
  1: [
    { id: 1, title: 'Изучить регламент компании',           done: false },
    { id: 2, title: 'Установить все рабочие инструменты',   done: false },
    { id: 3, title: 'Посмотреть видео-приветствие',         done: false },
    { id: 4, title: 'Познакомиться с командой',             done: false },
  ],
  2: [
    { id: 5, title: 'Изучить презентацию продукта',         done: false },
    { id: 6, title: 'Поговорить с наставником',             done: false },
  ],
};

export default function Onboarding() {
  const [tab,        setTab]        = useState('onboarding');
  const [activeDay,  setActiveDay]  = useState(ONBOARDING_DAYS[0]);
  const [tasks,      setTasks]      = useState(INIT_TASKS);
  const [reportData, setReportData] = useState({ did: '', willDo: '', blockers: '', status: 'draft' });
  const [submitted,  setSubmitted]  = useState(false);
  const [toast,      setToast]      = useState(null);

  const showToast = (title, msg) => { setToast({ title, msg }); setTimeout(() => setToast(null), 3500); };

  const toggleTask = (dayId, taskId) => {
    setTasks(t => ({
      ...t,
      [dayId]: t[dayId].map(x => x.id === taskId ? { ...x, done: !x.done } : x),
    }));
  };

  const handleSend = () => {
    if (!reportData.did.trim()) { showToast('Ошибка', 'Заполните поле «Что сделал»'); return; }
    setReportData(r => ({ ...r, status: 'sent' }));
    setSubmitted(true);
    showToast('Успешно', `Отчёт за День ${activeDay.dayNumber} отправлен.`);
  };

  const dayTasks    = tasks[activeDay.id] || [];
  const doneTasks   = dayTasks.filter(t => t.done).length;
  const totalTasks  = dayTasks.length;
  const progress    = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <MainLayout title="Программа адаптации">
      <div className="page-header">
        <div>
          <div className="page-title">Программа адаптации</div>
          <div className="page-subtitle">Изучай материалы, выполняй задания и отправляй ежедневные отчёты</div>
        </div>
      </div>

      {/* Day selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {ONBOARDING_DAYS.map(day => {
          const dt = tasks[day.id] || [];
          const dp = dt.length ? Math.round((dt.filter(t=>t.done).length / dt.length) * 100) : 0;
          return (
            <button key={day.id} onClick={() => setActiveDay(day)}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius)', border: '1px solid',
                borderColor: activeDay.id === day.id ? 'var(--primary)' : 'var(--gray-200)',
                background: activeDay.id === day.id ? 'var(--primary-light)' : 'white',
                color: activeDay.id === day.id ? 'var(--primary)' : 'var(--gray-700)',
                fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              }}>
              День {day.dayNumber}
              {dp === 100 && <CheckCircle size={13} color="#16A34A" />}
            </button>
          );
        })}
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'onboarding' ? 'active' : ''}`} onClick={() => setTab('onboarding')}>Онбординг</button>
        <button className={`tab-btn ${tab === 'tasks'     ? 'active' : ''}`} onClick={() => setTab('tasks')}>
          Задачи {doneTasks}/{totalTasks}
        </button>
        <button className={`tab-btn ${tab === 'report'    ? 'active' : ''}`} onClick={() => setTab('report')}>Отчёт</button>
      </div>

      {/* ── TAB: Онбординг ── */}
      {tab === 'onboarding' && (
        <div className="onboarding-day-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 4 }}>
                День {activeDay.dayNumber}. {activeDay.title}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Этап: {activeDay.stage}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>
              <Clock size={14} /> Дедлайн: {activeDay.deadline}
            </div>
          </div>

          <div className="section-label">ЦЕЛИ ДНЯ</div>
          <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
            {activeDay.goals.map((g, i) => (
              <li key={i} style={{ fontSize: 14, color: 'var(--gray-700)', marginBottom: 6, lineHeight: 1.5 }}>{g}</li>
            ))}
          </ul>

          <div className="section-label">ИНСТРУКЦИИ</div>
          <p style={{ fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.7, marginBottom: 20 }}>{activeDay.instructions}</p>

          <div className="section-label">РЕГЛАМЕНТЫ И ДОКУМЕНТЫ</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {activeDay.docs.map((doc, i) => {
              const href = doc.url || '#';
              const isLink = doc.type === 'link';
              return (
              <a
                key={i}
                className="doc-card"
                href={href}
                target="_blank"
                rel="noreferrer"
                style={{ flex: '1', minWidth: 180, textDecoration: 'none', color: 'inherit' }}
              >
                <div className="doc-icon" style={{ background: doc.type === 'pdf' ? '#FEE2E2' : doc.type === 'docx' ? '#DBEAFE' : '#EDE9FE' }}>
                  {doc.type === 'pdf' ? '📄' : doc.type === 'docx' ? '📝' : '🔗'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-800)' }}>{doc.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{doc.size || 'Внешняя ссылка'}</div>
                </div>
                {isLink ? <ExternalLink size={14} color="var(--gray-400)" /> : <Download size={14} color="var(--gray-400)" />}
              </a>
            );})}
          </div>

          <div className="section-label">ОБУЧАЮЩИЕ МАТЕРИАЛЫ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ borderRadius: 'var(--radius)', background: 'var(--gray-100)', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 13 }}>🎥 Видео-приветствие</div>
            <div style={{ borderRadius: 'var(--radius)', background: 'var(--gray-100)', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 13 }}>📊 Презентация</div>
          </div>
        </div>
      )}

      {/* ── TAB: Задачи ── */}
      {tab === 'tasks' && (
        <div className="onboarding-day-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Задачи · День {activeDay.dayNumber}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>{activeDay.title}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: progress === 100 ? '#16A34A' : 'var(--primary)' }}>
                {doneTasks}/{totalTasks}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>выполнено</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: progress + '%',
              background: progress === 100 ? '#16A34A' : 'var(--primary)',
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>

          {/* Task list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dayTasks.map(task => (
              <div key={task.id}
                onClick={() => toggleTask(activeDay.id, task.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid',
                  borderColor: task.done ? '#A7F3D0' : 'var(--gray-200)',
                  background: task.done ? '#F0FDF4' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                <div style={{ flexShrink: 0, color: task.done ? '#16A34A' : 'var(--gray-300)' }}>
                  {task.done
                    ? <CheckSquare size={20} />
                    : <Square size={20} />
                  }
                </div>
                <span style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: task.done ? 'var(--gray-400)' : 'var(--gray-800)',
                  textDecoration: task.done ? 'line-through' : 'none',
                  flex: 1,
                }}>
                  {task.title}
                </span>
                {task.done && (
                  <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ Готово</span>
                )}
              </div>
            ))}
          </div>

          {progress === 100 && (
            <div style={{ marginTop: 20, padding: '14px 16px', background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 'var(--radius)', color: '#065F46', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} /> Все задачи выполнены! Не забудь заполнить и отправить отчёт.
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Отчёт ── */}
      {tab === 'report' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
          <div className="onboarding-day-card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20, padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
              {[['ДЕНЬ', `День ${activeDay.dayNumber}`], ['ДАТА', '25 Окт 2025'], ['АВТОР', 'Алексей П.'], ['СТАТУС', reportData.status]].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-400)', marginBottom: 4 }}>{label}</div>
                  {label === 'СТАТУС'
                    ? <span className={`badge ${STATUS_COLORS[val]}`}>{STATUS_LABELS[val]}</span>
                    : <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)' }}>{val}</div>
                  }
                </div>
              ))}
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 14, fontWeight: 600 }}>Что сделал</label>
              <textarea className="form-textarea" placeholder="Опишите выполненные задачи за сегодня..."
                value={reportData.did} onChange={e => setReportData(r => ({ ...r, did: e.target.value }))}
                disabled={submitted} style={{ minHeight: 120 }} />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 14, fontWeight: 600 }}>Что буду делать</label>
              <textarea className="form-textarea" placeholder="Планы на завтрашний день..."
                value={reportData.willDo} onChange={e => setReportData(r => ({ ...r, willDo: e.target.value }))}
                disabled={submitted} style={{ minHeight: 120 }} />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 14, fontWeight: 600 }}>Какие проблемы возникли</label>
              <textarea className="form-textarea" placeholder="Возникли ли трудности? Если нет — оставьте пустым."
                value={reportData.blockers} onChange={e => setReportData(r => ({ ...r, blockers: e.target.value }))}
                disabled={submitted} style={{ minHeight: 100 }} />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontSize: 14, fontWeight: 600 }}>Вложения (опционально)</label>
              <div style={{ border: '1px dashed var(--gray-300)', borderRadius: 'var(--radius)', padding: '20px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13, cursor: 'pointer' }}>
                Перетащите файл или нажмите для выбора
              </div>
            </div>
            {!submitted && (
              <button className="btn btn-primary" onClick={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={14} /> Отправить отчёт
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="report-history">
              <div className="report-history-title">История отчётов</div>
              <div className="report-history-item">
                <span className="status-dot blue" />
                <div>
                  <div style={{ fontWeight: 500 }}>День {activeDay.dayNumber}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{submitted ? 'Отправлен (сегодня)' : 'Черновик (текущий)'}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)', paddingTop: 8, textAlign: 'center' }}>Предыдущих отчётов нет</div>
            </div>

            <div style={submitted ? { background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 'var(--radius)', padding: '12px 14px', color: '#065F46' } : { background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
              {submitted ? (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} /> Ожидание проверки</div>
                  <div style={{ fontSize: 12 }}>Отчёт отправлен. Вы получите уведомление когда статус изменится.</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={14} /> Важно</div>
                  <div style={{ fontSize: 12 }}>Отчёт нельзя отредактировать после отправки.</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.title === 'Успешно' ? 'toast-success' : 'toast-error'}`}>
          <div>
            <div className="toast-title">{toast.title}</div>
            <div className="toast-msg">{toast.msg}</div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
