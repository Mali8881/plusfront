import MainLayout from '../../layouts/MainLayout';
import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Globe, FileText, Link2, MessageSquare, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { regulationsAPI } from '../../api/content';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { isInternRole } from '../../utils/roles';
import LockedVideoPlayer, { isLockedVideoCandidate } from '../../components/LockedVideoPlayer';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
let BACKEND_ORIGIN = 'http://127.0.0.1:8000';
try {
  BACKEND_ORIGIN = new URL(API_BASE_URL).origin;
} catch {
  // keep default origin
}

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ru-RU');
}

function isLikelyUrl(value) {
  return /^https?:\/\//i.test(String(value || '')) || String(value || '').startsWith('/');
}

function normalizeOpenUrl(url) {
  if (!url) return '';
  const raw = String(url).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${BACKEND_ORIGIN}${raw}`;
  return raw;
}

function toOpenUrl(raw) {
  const actionUrl = raw?.action?.url || raw?.action_url || (typeof raw?.action === 'string' && isLikelyUrl(raw.action) ? raw.action : '');
  const contentUrl =
    raw?.content?.url ||
    raw?.content_url ||
    (typeof raw?.content === 'string' && isLikelyUrl(raw.content) ? raw.content : '') ||
    raw?.external_url ||
    raw?.url ||
    raw?.file ||
    raw?.file_url ||
    raw?.document ||
    '';

  return normalizeOpenUrl(actionUrl || contentUrl || '');
}

function fileExtFromUrl(url) {
  const clean = String(url || '').split('?')[0].split('#')[0];
  const part = clean.split('.').pop();
  return (part || '').toLowerCase();
}

function canInlinePreview(url) {
  const ext = fileExtFromUrl(url);
  return ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'txt'].includes(ext);
}

function normalizeReg(raw = {}) {
  const typeRaw = String(raw.type || raw.kind || '').toLowerCase();
  const type = typeRaw.includes('link') ? 'link' : 'file';
  const openUrl = toOpenUrl(raw);

  const requiresQuiz = Boolean(raw.requires_quiz ?? raw.quiz_required ?? raw.quizRequired);
  const hasPassedQuiz = Boolean(raw.has_passed_quiz ?? raw.quiz_passed ?? raw.quizPassed);
  let quizQuestions = Array.isArray(raw.quiz_questions) ? raw.quiz_questions : [];

  // Legacy single-question format (compat API).
  const legacyQuestion = raw.quiz_question || raw.quiz?.question || '';
  const legacyOptions = Array.isArray(raw.quiz_options)
    ? raw.quiz_options
    : Array.isArray(raw.quiz?.options)
      ? raw.quiz.options
      : [];
  if (!quizQuestions.length && (legacyQuestion || legacyOptions.length)) {
    quizQuestions = [{ question: legacyQuestion || 'Вопрос', options: legacyOptions }];
  }

  return {
    id: raw.id,
    title: raw.title || raw.name || raw.file_name || `Регламент #${raw.id}`,
    description: raw.description || raw.desc || raw.summary || '',
    type,
    openUrl,
    updatedAt: formatDate(raw.updated_at || raw.modified || raw.created_at || raw.date),
    size: raw.size || raw.file_size || '',

    isAcknowledged: Boolean(raw.is_acknowledged),
    acknowledgedAt: formatDate(raw.acknowledged_at),
    isOverdue: Boolean(raw.is_overdue),

    quizRequired: requiresQuiz,
    quizPassed: hasPassedQuiz,
    quizQuestions,
    quizQuestion: legacyQuestion,
    quizOptions: legacyOptions,

    reportRequiredToday: Boolean(raw.report_required_today),
    reportSubmittedToday: Boolean(raw.report_submitted_today),
  };
}

export default function Regulations() {
  const { user } = useAuth();
  const { t, tr } = useLocale();
  const isIntern = isInternRole(user?.role);

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const [quizDoc, setQuizDoc] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState([]);

  const loadDocs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await regulationsAPI.list();
      setDocs(safeList(res.data).map(normalizeReg));
    } catch (err) {
      setDocs([]);
      setError(err?.response?.data?.detail || tr('Не удалось загрузить регламенты'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const docsToShow = useMemo(() => docs, [docs]);

  const withReload = async (docId, action, successMessage) => {
    setBusyId(docId);
    try {
      await action();
      setActionMsg(successMessage);
      await loadDocs();
    } catch (err) {
      const data = err?.response?.data || {};
      const payload = data?.errors || data;
      const retry = Number(payload?.retry_after_seconds || 0);
      if (retry > 0) {
        const minutes = Math.ceil(retry / 60);
        setActionMsg(`${payload?.detail || tr('Повторите позже')} (${tr('через')} ${minutes} ${tr('мин')})`);
      } else {
        setActionMsg(data?.detail || payload?.detail || tr('Операция не выполнена'));
      }
    } finally {
      setBusyId(null);
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  const openRegulation = async (doc) => {
    try {
      const res = await regulationsAPI.detail(doc.id);
      const detailed = normalizeReg(res.data || {});
      setPreviewDoc(detailed);
      if (!detailed.openUrl && !doc.openUrl) {
        setActionMsg(tr('У документа нет content/action URL для открытия'));
        setTimeout(() => setActionMsg(''), 3000);
      }
    } catch {
      setPreviewDoc(doc);
    }
  };

  const acknowledge = async (doc) => {
    setBusyId(doc.id);
    try {
      await regulationsAPI.acknowledge(doc.id);
      setActionMsg(tr('Прочтение отмечено'));
      await loadDocs();
      if (isIntern && doc.quizRequired && !doc.quizPassed) {
        setQuizDoc(doc);
        const total = Array.isArray(doc.quizQuestions) && doc.quizQuestions.length ? doc.quizQuestions.length : 1;
        setQuizAnswers(new Array(total).fill(''));
      }
    } catch (err) {
      setActionMsg(err?.response?.data?.detail || tr('Операция не выполнена'));
    } finally {
      setBusyId(null);
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  const sendRegFeedback = async (doc) => {
    const text = window.prompt(tr('Введите feedback по регламенту'));
    if (!text?.trim()) return;

    await withReload(
      doc.id,
      () => regulationsAPI.submitFeedback(doc.id, { text: text.trim(), message: text.trim(), feedback: text.trim() }),
      tr('Feedback отправлен')
    );
  };

  const submitQuiz = async (doc) => {
    if (!isIntern) {
      const answer = window.prompt(tr('Введите ответ для quiz/теста'));
      if (!answer?.trim()) return;
      await withReload(
        doc.id,
        () => regulationsAPI.submitQuiz(doc.id, { answer: answer.trim(), user_answer: answer.trim() }),
        tr('Тест отправлен')
      );
      return;
    }
    setQuizDoc(doc);
    const total = Array.isArray(doc.quizQuestions) && doc.quizQuestions.length ? doc.quizQuestions.length : 1;
    setQuizAnswers(new Array(total).fill(''));
  };

  const submitInternQuiz = async () => {
    if (!quizDoc) return;
    const answers = Array.isArray(quizAnswers) ? quizAnswers.map((x) => String(x || '').trim()) : [];
    if (!answers.length || answers.some((a) => !a)) return;

    await withReload(
      quizDoc.id,
      () => {
        if (Array.isArray(quizDoc.quizQuestions) && quizDoc.quizQuestions.length > 1) {
          return regulationsAPI.submitQuiz(quizDoc.id, { answers });
        }
        // Single-question: backend supports either `answer` or `answers`.
        return regulationsAPI.submitQuiz(quizDoc.id, { answer: answers[0], user_answer: answers[0], answers });
      },
      tr('Тест отправлен')
    );

    setQuizDoc(null);
    setQuizAnswers([]);
  };

  const submitReadReport = async (doc) => {
    const report = window.prompt(tr('Краткий отчет по прочтению'));
    if (!report?.trim()) return;

    await withReload(
      doc.id,
      () => regulationsAPI.submitReadReport(doc.id, { report: report.trim(), text: report.trim(), message: report.trim() }),
      tr('Отчет отправлен')
    );
  };

  return (
    <MainLayout title={tr('Регламенты компании')}>
      <div className="page-header">
        <div>
          <div className="page-title">{tr('Внутренние регламенты и инструкции')}</div>
          <div className="page-subtitle">{tr('Список документов, подтверждение прочтения, quiz и отчеты')}</div>
        </div>
      </div>

      {error && <div style={{ marginBottom: 14, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
      {actionMsg && <div style={{ marginBottom: 14, color: actionMsg.toLowerCase().includes('не') ? 'var(--danger)' : 'var(--success)', fontSize: 13 }}>{actionMsg}</div>}

      <div className="reg-grid">
        {loading && <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>{t('common.loading', 'Загрузка...')}</div>}
        {!loading && docsToShow.length === 0 && <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>{tr('Документы пока не добавлены')}</div>}

        {!loading &&
          docsToShow.map((doc) => (
            <div key={doc.id} className="reg-card">
              <div
                className="reg-icon"
                style={{
                  background: doc.type === 'link' ? '#EDE9FE' : '#DBEAFE',
                  color: doc.type === 'link' ? '#7C3AED' : '#2563EB',
                }}
              >
                {doc.type === 'link' ? <Link2 size={18} /> : <FileText size={18} />}
              </div>

              <div className="reg-title">{doc.title}</div>
              <div className="reg-desc">{doc.description || tr('Без описания')}</div>

              <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={`badge ${doc.isAcknowledged ? 'badge-green' : 'badge-gray'}`}>
                  {doc.isAcknowledged ? tr('Прочтено') : tr('Не прочитано')}
                </span>
                {doc.isOverdue && <span className="badge badge-red">{tr('Просрочено')}</span>}
                {doc.quizRequired && <span className={`badge ${doc.quizPassed ? 'badge-green' : 'badge-yellow'}`}>{doc.quizPassed ? tr('Quiz пройден') : tr('Quiz обязателен')}</span>}
                {doc.reportRequiredToday && (
                  <span className={`badge ${doc.reportSubmittedToday ? 'badge-green' : 'badge-yellow'}`}>
                    {doc.reportSubmittedToday ? tr('Отчет отправлен') : tr('Нужен отчет сегодня')}
                  </span>
                )}
              </div>

              {!!doc.updatedAt && <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--gray-400)' }}>{tr('Обновлено:')} {doc.updatedAt}</div>}

              <div className="reg-action" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-outline btn-sm" onClick={() => openRegulation(doc)} disabled={busyId === doc.id}>
                  <Globe size={13} /> {tr('Открыть')}
                </button>

                {!doc.isAcknowledged && (
                  <button className="btn btn-secondary btn-sm" onClick={() => acknowledge(doc)} disabled={busyId === doc.id}>
                    <CheckCircle2 size={13} /> {tr('Отметить прочтение')}
                  </button>
                )}

                {doc.quizRequired && !doc.quizPassed && (
                  <button className="btn btn-secondary btn-sm" onClick={() => submitQuiz(doc)} disabled={busyId === doc.id}>
                    <ClipboardCheck size={13} /> {tr('Мини-тест')}
                  </button>
                )}

                {doc.reportRequiredToday && !doc.reportSubmittedToday && (
                  <button className="btn btn-secondary btn-sm" onClick={() => submitReadReport(doc)} disabled={busyId === doc.id}>
                    <FileText size={13} /> {tr('Отправить отчет')}
                  </button>
                )}

                <button className="btn btn-secondary btn-sm" onClick={() => sendRegFeedback(doc)} disabled={busyId === doc.id}>
                  <MessageSquare size={13} /> Feedback
                </button>

                {doc.openUrl && (
                  <a className="btn btn-primary btn-sm" href={doc.openUrl} target="_blank" rel="noreferrer">
                    {doc.type === 'link' ? <ExternalLink size={13} /> : <Download size={13} />} {doc.type === 'link' ? tr('Ссылка') : tr('Открыть файл')} {doc.size ? `(${doc.size})` : ''}
                  </a>
                )}
              </div>
            </div>
          ))}
      </div>

      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100vw',
              width: '100vw',
              height: '100vh',
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="modal-header">
              <div className="modal-title">{previewDoc.title}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {previewDoc.openUrl && (
                  <a className="btn btn-primary btn-sm" href={previewDoc.openUrl} target="_blank" rel="noreferrer">
                    {tr('Открыть в новой вкладке')}
                  </a>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setPreviewDoc(null)}>
                  {tr('Закрыть')}
                </button>
              </div>
            </div>
              <div className="modal-body" style={{ flex: 1, minHeight: 0 }}>
                {previewDoc.openUrl ? (
                  isLockedVideoCandidate(previewDoc.openUrl) ? (
                    <LockedVideoPlayer src={previewDoc.openUrl} title={previewDoc.title} />
                  ) : canInlinePreview(previewDoc.openUrl) ? (
                    <iframe
                      src={previewDoc.openUrl}
                      title={previewDoc.title}
                      style={{ width: '100%', height: '100%', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}
                    />
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ color: 'var(--gray-500)' }}>
                        {tr('Предпросмотр этого формата недоступен во встроенном окне. Откройте файл в новой вкладке.')}
                      </div>
                      <a className="btn btn-primary btn-sm" href={previewDoc.openUrl} target="_blank" rel="noreferrer" style={{ width: 'fit-content' }}>
                        {tr('Открыть файл')}
                      </a>
                    </div>
                  )
                ) : (
                  <div style={{ color: 'var(--gray-500)' }}>{tr('Для этого документа не передан URL в `content/action`.')}</div>
                )}
            </div>
          </div>
        </div>
      )}

      {quizDoc && (
        <div className="modal-overlay" onClick={() => setQuizDoc(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div className="modal-title">{tr('Мини-тест:')} {quizDoc.title}</div>
              <button className="btn btn-secondary btn-sm" onClick={() => setQuizDoc(null)}>
                {tr('Закрыть')}
              </button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              {Array.isArray(quizDoc.quizQuestions) && quizDoc.quizQuestions.length > 0 ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  {quizDoc.quizQuestions.map((q, qi) => {
                    const question = String(q?.question || '').trim() || `${tr('Вопрос')} ${qi + 1}`;
                    const options = Array.isArray(q?.options) ? q.options : [];
                    const current = String(quizAnswers[qi] || '');
                    return (
                      <div key={`q-${quizDoc.id}-${qi}`} style={{ padding: 12, border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', background: 'var(--gray-50)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>
                          {qi + 1}. {question}
                        </div>
                        {options.length > 0 ? (
                          <div style={{ display: 'grid', gap: 8 }}>
                            {options.map((opt, oi) => (
                              <label key={`opt-${qi}-${oi}`} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                  type="radio"
                                  name={`quiz-${quizDoc.id}-${qi}`}
                                  checked={current === String(opt)}
                                  onChange={() => {
                                    const next = [...quizAnswers];
                                    next[qi] = String(opt);
                                    setQuizAnswers(next);
                                  }}
                                />
                                <span>{String(opt)}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            className="form-input"
                            placeholder={tr('Введите ваш ответ')}
                            value={current}
                            onChange={(e) => {
                              const next = [...quizAnswers];
                              next[qi] = e.target.value;
                              setQuizAnswers(next);
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: 'var(--gray-500)' }}>{tr('Вопросы теста не настроены.')}</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setQuizDoc(null)}>
                {tr('Отмена')}
              </button>
              <button
                className="btn btn-primary"
                onClick={submitInternQuiz}
                disabled={!Array.isArray(quizAnswers) || !quizAnswers.length || quizAnswers.some((a) => !String(a || '').trim())}
              >
                {tr('Отправить ответ')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
