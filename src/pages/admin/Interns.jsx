import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Eye, RotateCcw, X, XCircle } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { onboardingAPI } from '../../api/content';
import { usersAPI } from '../../api/auth';

const STATUS = {
  DRAFT: { label: 'Черновик', cls: 'badge-gray' },
  SENT: { label: 'Отправлен', cls: 'badge-blue' },
  ACCEPTED: { label: 'Принят', cls: 'badge-green' },
  REVISION: { label: 'На доработке', cls: 'badge-yellow' },
  REJECTED: { label: 'Отклонен', cls: 'badge-red' },
};

const STEP_LABEL = {
  read: 'Чтение',
  feedback: 'Фидбек',
  quiz: 'Тест',
  done: 'Завершено',
};

const toAbsoluteMedia = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  const origin = apiBase.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

function resolveCurrentStep(progress, reports) {
  const currentDay = progress?.overview?.current_day_number;
  if (!currentDay) return '—';

  const currentDayReports = (reports || []).filter((r) => Number(r.day_number) === Number(currentDay));
  if (currentDayReports.length > 0) {
    const latestReport = [...currentDayReports].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0];
    return `Отчет: ${STATUS[String(latestReport.status || '').toUpperCase()]?.label || latestReport.status || '—'}`;
  }

  const dayRegulations = (progress?.regulations || [])
    .filter((item) => Number(item.day_number) === Number(currentDay))
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  if (dayRegulations.length > 0) {
    const firstIncomplete = dayRegulations.find((item) => String(item.step || '').toLowerCase() !== 'done');
    if (firstIncomplete) return STEP_LABEL[firstIncomplete.step] || firstIncomplete.step || '—';
    return STEP_LABEL.done;
  }

  return 'Ожидает активность';
}

function getRegulationStats(progress) {
  const regulations = Array.isArray(progress?.regulations) ? progress.regulations : [];
  const quizRequired = regulations.filter((r) => !!r.quiz_required);
  const quizPassed = quizRequired.filter((r) => !!r.quiz_passed);
  const withFeedback = regulations.filter((r) => String(r.feedback || '').trim().length > 0);
  return {
    quizPassed: quizPassed.length,
    quizTotal: quizRequired.length,
    feedbackCount: withFeedback.length,
    regulations,
  };
}

export default function AdminInterns() {
  const [interns, setInterns] = useState([]);
  const [reports, setReports] = useState([]);
  const [days, setDays] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, daysRes, reportsRes] = await Promise.all([
        usersAPI.list(),
        onboardingAPI.listDays(),
        onboardingAPI.getReports(),
      ]);
      const allUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
      const nextInterns = allUsers.filter((u) => String(u.role || '').toLowerCase() === 'intern');
      const nextReports = Array.isArray(reportsRes.data) ? reportsRes.data : [];
      setInterns(nextInterns);
      setDays(Array.isArray(daysRes.data) ? daysRes.data : []);
      setReports(nextReports);

      const progressResults = await Promise.all(
        nextInterns.map(async (u) => {
          try {
            const res = await onboardingAPI.getInternProgress(u.id);
            return [String(u.id), res.data || null];
          } catch {
            return [String(u.id), null];
          }
        })
      );
      setProgressMap(Object.fromEntries(progressResults));
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось загрузить данные по стажерам.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reportsByIntern = useMemo(() => {
    const map = new Map();
    reports.forEach((item) => {
      const key = String(item.user_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [reports]);

  const rows = useMemo(
    () =>
      interns.map((intern) => {
        const key = String(intern.id);
        const progress = progressMap[key];
        const completedDays = Number(progress?.overview?.completed_days || 0);
        const totalDays = Number(progress?.overview?.total_days || days.length || 0);
        const percent = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
        const internReports = reportsByIntern.get(key) || [];
        const sentCount = internReports.filter((r) => String(r.status || '').toUpperCase() === 'SENT').length;
        const regStats = getRegulationStats(progress);
        return {
          id: key,
          name: `${intern.first_name || ''} ${intern.last_name || ''}`.trim() || intern.username || `ID ${intern.id}`,
          username: intern.username || '',
          progress,
          reports: internReports.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))),
          currentDay: progress?.overview?.current_day_number || '—',
          currentStep: resolveCurrentStep(progress, internReports),
          completedDays,
          totalDays,
          percent,
          sentCount,
          quizPassed: regStats.quizPassed,
          quizTotal: regStats.quizTotal,
          feedbackCount: regStats.feedbackCount,
          regulations: regStats.regulations,
        };
      }),
    [days.length, interns, progressMap, reportsByIntern]
  );

  const onOpenIntern = (row) => {
    setSelectedIntern(row);
    setSelectedReport(null);
    setComment('');
  };

  const onOpenReport = (report) => {
    setSelectedReport(report);
    setComment('');
  };

  const review = async (report, status) => {
    const normalized = String(status || '').toUpperCase();
    const requiresComment = normalized === 'REVISION' || normalized === 'REJECTED';
    if (requiresComment && !String(comment || '').trim()) {
      setError('Для статуса "На доработку" и "Отклонен" комментарий обязателен.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onboardingAPI.reviewReport(report.id, {
        status: normalized,
        comment,
      });
      setToast(
        normalized === 'ACCEPTED'
          ? 'Отчет принят'
          : normalized === 'REVISION'
            ? 'Отчет отправлен на доработку'
            : 'Отчет отклонен'
      );
      setTimeout(() => setToast(''), 2500);
      await load();
      setSelectedReport(null);
      setComment('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось отправить фидбек.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout title="Управление · Стажеры">
      <div className="page-header">
        <div className="page-title">Стажеры</div>
        <div className="page-subtitle">Контроль дня/шага, отчетов, тестов и фидбеков по регламентам</div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ color: '#b91c1c' }}>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="card"><div className="card-body">Загрузка...</div></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>СТАЖЕР</th>
                  <th>ДЕНЬ</th>
                  <th>ШАГ</th>
                  <th>ПРОГРЕСС</th>
                  <th>ТЕСТЫ</th>
                  <th>ФИДБЕКИ</th>
                  <th>SENT</th>
                  <th>ДЕЙСТВИЯ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.username}</div>
                    </td>
                    <td>День {row.currentDay}</td>
                    <td>{row.currentStep}</td>
                    <td style={{ minWidth: 210 }}>
                      <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}>
                        {row.completedDays}/{row.totalDays} дней
                      </div>
                      <div style={{ height: 7, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${row.percent}%`, background: row.percent === 100 ? '#16A34A' : '#2563EB' }} />
                      </div>
                    </td>
                    <td>{row.quizPassed}/{row.quizTotal}</td>
                    <td>{row.feedbackCount}</td>
                    <td>{row.sentCount}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => onOpenIntern(row)}>
                        <Eye size={14} /> Открыть
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={8}>Стажеры не найдены.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedIntern && (
        <div className="modal-overlay" onClick={() => setSelectedIntern(null)}>
          <div className="modal" style={{ width: 980 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {selectedIntern.name} · День {selectedIntern.currentDay} · Шаг: {selectedIntern.currentStep}
              </div>
              <button className="btn-icon" onClick={() => setSelectedIntern(null)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Работы (задачи)</div>
                {(selectedIntern.progress?.tasks || []).slice(0, 12).map((task) => (
                  <div key={task.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{task.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      Колонка: {task.column || '—'} | День {task.onboarding_day_number || '—'}
                    </div>
                  </div>
                ))}
                {(!selectedIntern.progress?.tasks || selectedIntern.progress.tasks.length === 0) && (
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Задач пока нет.</div>
                )}
              </div>

              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Отчеты стажера</div>
                {selectedIntern.reports.map((r) => (
                  <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>День {r.day_number}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                        {String(r.updated_at || '').slice(0, 16).replace('T', ' ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${STATUS[r.status]?.cls || 'badge-gray'}`}>{STATUS[r.status]?.label || r.status}</span>
                      <button className="btn btn-secondary btn-sm" onClick={() => onOpenReport(r)}>
                        <Eye size={13} /> Детали
                      </button>
                    </div>
                  </div>
                ))}
                {selectedIntern.reports.length === 0 && <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Отчетов пока нет.</div>}
              </div>

              <div style={{ gridColumn: '1 / -1', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>Результаты по регламентам (тесты и фидбеки)</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                    Тесты: {selectedIntern.quizPassed}/{selectedIntern.quizTotal} | Фидбеки: {selectedIntern.feedbackCount}
                  </div>
                </div>

                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8 }}>
                  <table className="table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>РЕГЛАМЕНТ</th>
                        <th>ДЕНЬ</th>
                        <th>ШАГ</th>
                        <th>ТЕСТ</th>
                        <th>ФИДБЕК</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedIntern.regulations || []).map((reg) => (
                        <tr key={reg.id}>
                          <td style={{ maxWidth: 260 }}>{reg.title || '—'}</td>
                          <td>{reg.day_number || '—'}</td>
                          <td>{STEP_LABEL[String(reg.step || '').toLowerCase()] || reg.step || '—'}</td>
                          <td>
                            {reg.quiz_required
                              ? `Правильных ${reg.quiz_score || 0} из ${reg.quiz_total || 0}`
                              : 'Без теста'}
                          </td>
                          <td style={{ maxWidth: 320 }}>{String(reg.feedback || '').trim() || '—'}</td>
                        </tr>
                      ))}
                      {(!selectedIntern.regulations || selectedIntern.regulations.length === 0) && (
                        <tr><td colSpan={5}>Данных по регламентам пока нет.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="modal" style={{ width: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Отчет · День {selectedReport.day_number}</div>
              <button className="btn-icon" onClick={() => setSelectedReport(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <ViewBlock label="Что сделал" value={selectedReport.did} />
              <ViewBlock label="Что буду делать" value={selectedReport.will_do} />
              <ViewBlock label="Проблемы" value={selectedReport.problems} />
              <ViewBlock label="Название работы" value={selectedReport.report_title} />
              <ViewBlock label="Описание работы" value={selectedReport.report_description} />

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Ссылка</div>
                {selectedReport.github_url ? (
                  <a href={selectedReport.github_url} target="_blank" rel="noreferrer">{selectedReport.github_url}</a>
                ) : (
                  <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>—</div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Файл</div>
                {selectedReport.attachment ? (
                  <a href={toAbsoluteMedia(selectedReport.attachment)} target="_blank" rel="noreferrer">Открыть вложение</a>
                ) : (
                  <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>—</div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Текущий комментарий ревьюера</div>
                <div style={{ fontSize: 13, color: 'var(--gray-700)' }}>{selectedReport.reviewer_comment || '—'}</div>
              </div>

              {String(selectedReport.status || '').toUpperCase() === 'SENT' && (
                <div className="form-group">
                  <label className="form-label">Фидбек</label>
                  <textarea
                    className="form-textarea"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    style={{ minHeight: 100 }}
                    placeholder="Комментарий для стажера"
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedReport(null)}>Закрыть</button>
              {String(selectedReport.status || '').toUpperCase() === 'SENT' && (
                <>
                  <button
                    className="btn btn-sm"
                    style={{ background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }}
                    onClick={() => review(selectedReport, 'REVISION')}
                    disabled={saving}
                  >
                    <RotateCcw size={13} /> На доработку
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => review(selectedReport, 'REJECTED')} disabled={saving}>
                    <XCircle size={13} /> Отклонить
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => review(selectedReport, 'ACCEPTED')} disabled={saving}>
                    <CheckCircle size={13} /> Принять
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast toast-success"><div><div className="toast-title">Готово</div><div className="toast-msg">{toast}</div></div></div>}
    </MainLayout>
  );
}

function ViewBlock({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--gray-700)', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '10px 14px', lineHeight: 1.5 }}>
        {value || '—'}
      </div>
    </div>
  );
}
