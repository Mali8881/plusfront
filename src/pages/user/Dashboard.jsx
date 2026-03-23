import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageSquare,
  X,
} from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { feedbackAPI, newsAPI, notificationsAPI, onboardingAPI } from '../../api/content';

const BANNERS = {
  intern: { title: 'Портал стажера', action: 'Открыть текущий день', path: '/onboarding?day=1' },
  employee: { title: 'Рабочая панель сотрудника', action: 'Мой профиль', path: '/profile' },
  projectmanager: { title: 'Панель руководителя', action: 'Задачи команды', path: '/tasks' },
  admin: { title: 'Панель администратора', action: 'Открыть админку', path: '/admin/overview' },
  superadmin: { title: 'Панель суперадмина', action: 'Открыть админку', path: '/admin/overview' },
};

const FEEDBACK_TYPES = [
  { label: 'Предложение', value: 'suggestion' },
  { label: 'Жалоба', value: 'complaint' },
  { label: 'Отзыв', value: 'review' },
];

const REPORT_STATUS_LABELS = {
  draft: 'Черновик',
  sent: 'Отправлен',
  accepted: 'Принят',
  revision: 'На доработке',
  rejected: 'Отклонен',
};

const FAQ_ITEMS = [
  {
    question: 'Куда идти в первую очередь?',
    answer: 'Откройте текущий день стажировки и выполните первый незавершенный шаг из блока "Что делать сейчас".',
  },
  {
    question: 'Где смотреть ТЗ или материалы?',
    answer: 'Все материалы и регламенты доступны внутри текущего дня стажировки.',
  },
  {
    question: 'Как понять, что день закрыт?',
    answer: 'День считается завершенным, когда закрыты обязательные материалы, задачи, тест и отправлен отчет.',
  },
  {
    question: 'Как сдавать GitHub-ссылку?',
    answer: 'Добавляйте ссылку на репозиторий или ветку и коротко описывайте, что именно сделано.',
  },
  {
    question: 'Что делать, если отчет вернули?',
    answer: 'Откройте замечание ревьюера, внесите правки и отправьте отчет повторно.',
  },
  {
    question: 'Если не понимаю следующий шаг?',
    answer: 'Сначала откройте инструкцию или регламент. Если вопрос остался, используйте кнопку связи с куратором.',
  },
];

function toAbsoluteMedia(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  const origin = apiBase.replace(/\/api(?:\/v\d+)?\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function stripHtml(input) {
  if (!input) return '';
  return String(input).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeReportStatus(value) {
  const raw = String(value || '').toLowerCase();
  if (raw === 'rework') return 'revision';
  if (raw === 'sent') return 'sent';
  if (raw === 'accepted') return 'accepted';
  if (raw === 'rejected') return 'rejected';
  if (raw === 'revision') return 'revision';
  return 'draft';
}

function getReportBadgeClass(status) {
  if (status === 'accepted') return 'badge-green';
  if (status === 'sent') return 'badge-blue';
  if (status === 'revision') return 'badge-yellow';
  if (status === 'rejected') return 'badge-red';
  return 'badge-gray';
}

function isTaskDone(task) {
  const column = String(task?.column || '').toLowerCase();
  return ['done', 'готов', 'готово', 'выполн', 'заверш', 'complete', 'closed'].some((token) => column.includes(token));
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function getInternAction({ currentDay, currentDetail, currentReport, progressCounts }) {
  if (!currentDay) {
    return {
      title: 'Программа еще не назначена',
      subtitle: 'Проверьте доступ к онбордингу у администратора.',
      cta: 'Обновить страницу',
      path: '/dashboard',
    };
  }

  const regulations = currentDetail?.regulations || [];
  const firstUnreadRegulation = regulations.find((item) => !item.is_read);
  if (firstUnreadRegulation) {
    return {
      title: `Прочитайте материал: ${firstUnreadRegulation.title}`,
      subtitle: `Сейчас открыт день ${currentDay.day_number}. Не завершены материалы: ${progressCounts.materialsDone}/${progressCounts.materialsTotal}.`,
      cta: 'Открыть день',
      path: `/onboarding?day=${currentDay.day_number}`,
    };
  }

  const firstMissingFeedback = regulations.find((item) => item.is_read && !item.has_feedback);
  if (firstMissingFeedback) {
    return {
      title: `Оставьте фидбек по материалу: ${firstMissingFeedback.title}`,
      subtitle: 'Без фидбека день не будет считаться завершенным.',
      cta: 'Продолжить день',
      path: `/onboarding?day=${currentDay.day_number}`,
    };
  }

  const firstMissingQuiz = regulations.find((item) => item.requires_quiz && !item.has_passed_quiz);
  if (firstMissingQuiz) {
    return {
      title: `Пройдите тест: ${firstMissingQuiz.title}`,
      subtitle: `По текущему дню тесты: ${progressCounts.quizDone}/${progressCounts.quizTotal}.`,
      cta: 'Перейти к тесту',
      path: `/onboarding?day=${currentDay.day_number}`,
    };
  }

  const firstUndoneTask = (currentDetail?.tasks || []).find((item) => !isTaskDone(item));
  if (firstUndoneTask) {
    return {
      title: `Закройте задачу: ${firstUndoneTask.title}`,
      subtitle: `По задачам прогресс ${progressCounts.tasksDone}/${progressCounts.tasksTotal}.`,
      cta: 'Открыть задачу',
      path: `/onboarding?day=${currentDay.day_number}`,
    };
  }

  const reportStatus = normalizeReportStatus(currentReport?.status);
  if (!currentReport || reportStatus === 'draft') {
    return {
      title: 'Подготовьте и отправьте отчет',
      subtitle: 'Все основные шаги по дню пройдены. Осталось отправить отчет на проверку.',
      cta: 'Открыть отчет',
      path: `/onboarding?day=${currentDay.day_number}`,
    };
  }

  if (reportStatus === 'revision') {
    return {
      title: 'Отчет вернули на доработку',
      subtitle: currentReport?.reviewer_comment || 'Откройте отчет, внесите правки и отправьте повторно.',
      cta: 'Исправить отчет',
      path: `/onboarding?day=${currentDay.day_number}`,
    };
  }

  if (reportStatus === 'sent') {
    return {
      title: 'Отчет отправлен на проверку',
      subtitle: 'Сейчас можно дождаться проверки или перейти к следующему шагу, если он уже доступен.',
      cta: 'Открыть день',
      path: `/onboarding?day=${currentDay.day_number}`,
    };
  }

  return {
    title: `День ${currentDay.day_number} почти завершен`,
    subtitle: 'Откройте день и проверьте, не осталось ли обязательных действий.',
    cta: 'Проверить день',
    path: `/onboarding?day=${currentDay.day_number}`,
  };
}

function ProgressRow({ label, value }) {
  return (
    <div className="intern-progress-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="stat-card stat-card--intern">
      <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
        <Icon size={18} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function InternDashboard({ user, navigate, news, newsLoading, selectedNews, setSelectedNews }) {
  const [data, setData] = useState({
    loading: true,
    error: '',
    overview: null,
    currentDay: null,
    currentDetail: null,
    reports: [],
    notifications: [],
    progressDetail: null,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [daysRes, overviewRes, reportsRes, notificationsRes, progressRes] = await Promise.all([
          onboardingAPI.listDays(),
          onboardingAPI.getMy(),
          onboardingAPI.getReports(),
          notificationsAPI.list(),
          onboardingAPI.getInternProgress(user.id),
        ]);

        if (!alive) return;

        const days = Array.isArray(daysRes.data) ? daysRes.data : [];
        const overview = overviewRes.data || null;
        const reports = Array.isArray(reportsRes.data) ? reportsRes.data : [];
        const notifications = Array.isArray(notificationsRes?.data?.items) ? notificationsRes.data.items : [];
        const currentDayId = overview?.current_day?.id;
        const currentDay =
          days.find((item) => String(item.id) === String(currentDayId)) ||
          days.find((item) => item.day_number === overview?.current_day?.day_number) ||
          days[0] ||
          null;

        let currentDetail = null;
        if (currentDay?.id) {
          try {
            const currentDetailRes = await onboardingAPI.getDay(currentDay.id);
            if (!alive) return;
            currentDetail = currentDetailRes.data || null;
          } catch {
            currentDetail = null;
          }
        }

        setData({
          loading: false,
          error: '',
          overview,
          currentDay,
          currentDetail,
          reports,
          notifications: notifications.slice(0, 5),
          progressDetail: progressRes.data || null,
        });
      } catch (error) {
        if (!alive) return;
        setData((prev) => ({
          ...prev,
          loading: false,
          error: error.response?.data?.detail || 'Не удалось загрузить данные стажировки.',
        }));
      }
    })();

    return () => {
      alive = false;
    };
  }, [user.id]);

  const { loading, error, overview, currentDay, currentDetail, reports, notifications, progressDetail } = data;

  const reportList = useMemo(
    () => [...reports].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))),
    [reports]
  );

  const currentReport = useMemo(() => {
    if (!currentDay) return null;
    return reportList.find((item) => Number(item.day_number) === Number(currentDay.day_number)) || null;
  }, [currentDay, reportList]);

  const latestCommentedReport = useMemo(
    () =>
      reportList.find((item) => {
        const status = normalizeReportStatus(item.status);
        return !!String(item.reviewer_comment || '').trim() && (status === 'revision' || status === 'rejected');
      }) || null,
    [reportList]
  );

  const progressCounts = useMemo(() => {
    const regulations = currentDetail?.regulations || [];
    const tasks = currentDetail?.tasks || [];
    const quizTotal = regulations.filter((item) => item.requires_quiz).length;
    const quizDone = regulations.filter((item) => item.requires_quiz && item.has_passed_quiz).length;
    return {
      materialsDone: regulations.filter((item) => item.is_read).length,
      materialsTotal: regulations.length,
      tasksDone: tasks.filter(isTaskDone).length,
      tasksTotal: tasks.length,
      quizDone,
      quizTotal,
      reportStatus: normalizeReportStatus(currentReport?.status),
    };
  }, [currentDetail, currentReport]);

  const currentAction = useMemo(
    () => getInternAction({ currentDay, currentDetail, currentReport, progressCounts }),
    [currentDay, currentDetail, currentReport, progressCounts]
  );

  const doneStats = useMemo(() => {
    const dayProgress = overview?.days || [];
    const completedDays = dayProgress.filter((item) => String(item.status).toUpperCase() === 'DONE').length;
    const acceptedReports = reportList.filter((item) => normalizeReportStatus(item.status) === 'accepted').length;
    const sentReports = reportList.filter((item) => normalizeReportStatus(item.status) === 'sent').length;
    const passedTests = (progressDetail?.regulations || []).filter((item) => item.quiz_required && item.quiz_passed).length;
    return { completedDays, acceptedReports, sentReports, passedTests };
  }, [overview, reportList, progressDetail]);

  if (loading) {
    return <div className="card"><div className="card-body">Загрузка...</div></div>;
  }

  return (
    <>
      {error ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ color: 'var(--danger)' }}>{error}</div>
        </div>
      ) : null}

      <div className="intern-dashboard-grid">
        <section className="intern-focus-card">
          <div className="section-label">Что делать сейчас</div>
          <div className="intern-focus-title">{currentAction.title}</div>
          <div className="intern-focus-text">{currentAction.subtitle}</div>
          <div className="intern-focus-meta">
            <span>Текущий день: {currentDay ? `${currentDay.day_number}. ${currentDay.title}` : '—'}</span>
          </div>
          <button className="btn btn-primary" onClick={() => navigate(currentAction.path)}>
            {currentAction.cta} <ArrowRight size={14} />
          </button>
        </section>

        <section className="card intern-equal-card">
          <div className="card-body">
            <div className="section-label">Статус отчета</div>
            <div className="intern-status-card">
              <div className="intern-status-main">
                <span className={`badge ${getReportBadgeClass(progressCounts.reportStatus)}`}>
                  {REPORT_STATUS_LABELS[progressCounts.reportStatus]}
                </span>
                <span className="text-muted">
                  {currentReport ? `Обновлен ${formatDateTime(currentReport.updated_at)}` : 'Отчет по текущему дню еще не создан'}
                </span>
              </div>
              <div className="intern-status-text">
                {String(currentReport?.reviewer_comment || '').trim() || 'Последнего замечания нет. После проверки комментарий появится здесь.'}
              </div>
            </div>
          </div>
        </section>
      </div>

      {latestCommentedReport ? (
        <section className="intern-warning-card">
          <div className="intern-warning-head">
            <MessageSquare size={18} />
            <div style={{ fontWeight: 700 }}>Последние замечания</div>
          </div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            День {latestCommentedReport.day_number} · статус:{' '}
            <span className={`badge ${getReportBadgeClass(normalizeReportStatus(latestCommentedReport.status))}`}>
              {REPORT_STATUS_LABELS[normalizeReportStatus(latestCommentedReport.status)]}
            </span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{latestCommentedReport.reviewer_comment}</div>
          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => navigate(`/onboarding?day=${latestCommentedReport.day_number}`)}>
            Открыть и исправить
          </button>
        </section>
      ) : null}

      <div className="intern-dashboard-grid intern-dashboard-grid--wide">
        <section className="card intern-equal-card">
          <div className="card-body">
            <div className="section-label">Прогресс по дню</div>
            <div className="intern-progress-list">
              <ProgressRow label="Материалы" value={`${progressCounts.materialsDone}/${progressCounts.materialsTotal || 0}`} />
              <ProgressRow label="Задачи" value={`${progressCounts.tasksDone}/${progressCounts.tasksTotal || 0}`} />
              <ProgressRow label="Тест" value={progressCounts.quizTotal > 0 ? `${progressCounts.quizDone}/${progressCounts.quizTotal}` : 'Не требуется'} />
              <ProgressRow label="Отчет" value={REPORT_STATUS_LABELS[progressCounts.reportStatus]} />
            </div>
          </div>
        </section>

        <section className="card intern-equal-card">
          <div className="card-body">
            <div className="section-label">Маршрут адаптации</div>
            <div className="intern-timeline">
              {(overview?.days || []).map((item) => {
                const status = String(item.status || '').toUpperCase();
                const cls = status === 'DONE' ? 'done' : status === 'IN_PROGRESS' ? 'current' : 'locked';
                return (
                  <button
                    key={item.day_id}
                    type="button"
                    className={`intern-timeline-step ${cls}`}
                    onClick={() => navigate(`/onboarding?day=${item.day_number}`)}
                  >
                    <span className="intern-timeline-step-num">День {item.day_number}</span>
                    <span className="intern-timeline-step-status">
                      {status === 'DONE' ? 'Пройден' : status === 'IN_PROGRESS' ? 'Текущий' : 'Впереди'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="stats-grid stats-grid--intern" style={{ marginBottom: 24 }}>
        <StatCard icon={CheckCircle2} label="Закрыто дней" value={doneStats.completedDays} />
        <StatCard icon={FileText} label="Принято отчетов" value={doneStats.acceptedReports} />
        <StatCard icon={ClipboardList} label="Отправлено отчетов" value={doneStats.sentReports} />
        <StatCard icon={BookOpen} label="Пройдено тестов" value={doneStats.passedTests} />
      </div>

      <div className="intern-dashboard-grid intern-dashboard-grid--wide">
        <section className="card intern-equal-card">
          <div className="card-body">
            <div className="section-label">Если застрял</div>
            <div className="intern-help-grid">
              <button className="intern-help-btn" onClick={() => { window.location.href = 'mailto:hr@vpluse.kg?subject=Вопрос по стажировке'; }}>
                <Mail size={16} />
                <span>Написать куратору</span>
              </button>
              <button className="intern-help-btn" onClick={() => navigate('/instructions')}>
                <LifeBuoy size={16} />
                <span>Посмотреть инструкцию</span>
              </button>
              <button className="intern-help-btn" onClick={() => navigate('/onboarding?day=1')}>
                <ExternalLink size={16} />
                <span>Открыть регламент</span>
              </button>
              <button className="intern-help-btn" onClick={() => { window.location.href = 'mailto:hr@vpluse.kg?subject=Нужна помощь по стажировке'; }}>
                <HelpCircle size={16} />
                <span>Задать вопрос</span>
              </button>
            </div>
          </div>
        </section>

        <section className="card intern-equal-card">
          <div className="card-body">
            <div className="section-label">Уведомления</div>
            <div className="intern-notification-list">
              {notifications.map((item) => (
                <div key={item.id} className="intern-notification-item">
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ color: 'var(--gray-600)' }}>{item.message}</div>
                  <div style={{ color: 'var(--gray-400)', marginTop: 4 }}>{formatDateTime(item.created_at)}</div>
                </div>
              ))}
              {notifications.length === 0 ? <div className="text-muted">Новых уведомлений пока нет.</div> : null}
            </div>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div className="section-label">FAQ для первых дней</div>
          <div className="intern-faq-list">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="intern-faq-item">
                <summary>{item.question}</summary>
                <div>{item.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Актуальные новости</h2>
        {newsLoading && <div className="card"><div className="card-body">Загрузка...</div></div>}
        {!newsLoading && (
          <div className="news-grid">
            {news.map((n) => (
              <div key={n.id} className="news-card" onClick={() => setSelectedNews(n)}>
                {n.image ? <img src={n.image} alt={n.title} className="news-card-img" /> : null}
                <div className="news-card-body">
                  <div className="news-card-title">{n.title}</div>
                  <div className="news-card-text">{n.text}</div>
                </div>
              </div>
            ))}
            {news.length === 0 && <div className="card"><div className="card-body">Новостей пока нет.</div></div>}
          </div>
        )}
      </div>

      {selectedNews ? (
        <div className="modal-overlay" onClick={() => setSelectedNews(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, width: 'calc(100vw - 32px)' }}>
            <div className="modal-header">
              <div className="modal-title">{selectedNews.title}</div>
              <button className="btn-icon" onClick={() => setSelectedNews(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {selectedNews.image ? (
                <img src={selectedNews.image} alt={selectedNews.title} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />
              ) : null}
              <p style={{ margin: 0, lineHeight: 1.6 }}>{stripHtml(selectedNews.fullText || selectedNews.text)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);
  const [fbType, setFbType] = useState('suggestion');
  const [fbText, setFbText] = useState('');
  const [fbMode, setFbMode] = useState('named');
  const [fbMsg, setFbMsg] = useState('');

  const banner = useMemo(() => BANNERS[user?.role] || BANNERS.employee, [user?.role]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setNewsLoading(true);
        const res = await newsAPI.list();
        if (!alive) return;
        const items = Array.isArray(res.data) ? res.data : [];
        setNews(
          items.map((n) => ({
            id: n.id,
            title: n.title,
            text: n.short_text || '',
            fullText: n.full_text || n.short_text || '',
            image: toAbsoluteMedia(n.image),
          }))
        );
      } catch {
        if (alive) setNews([]);
      } finally {
        if (alive) setNewsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const sendFeedback = async () => {
    const text = fbText.trim();
    if (!text) return;

    try {
      await feedbackAPI.create({
        type: fbType,
        text,
        is_anonymous: fbMode === 'anonymous',
        full_name: fbMode === 'anonymous' ? '' : (user?.name || user?.username || ''),
        contact: fbMode === 'anonymous' ? '' : (user?.email || ''),
      });
      setFbText('');
      setFbType('suggestion');
      setFbMode('named');
      setFbMsg('Обращение отправлено.');
    } catch {
      setFbMsg('Не удалось отправить обращение.');
    }

    setTimeout(() => setFbMsg(''), 2500);
  };

  return (
    <MainLayout title="Главная">
      <div className="announcement-banner">
        <div>
          <div className="announcement-title">{banner.title}</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => navigate(banner.path)}>
            {banner.action}
          </button>
        </div>
      </div>

      {user?.role === 'intern' ? (
        <InternDashboard
          user={user}
          navigate={navigate}
          news={news}
          newsLoading={newsLoading}
          selectedNews={selectedNews}
          setSelectedNews={setSelectedNews}
        />
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Актуальные новости</h2>
            {newsLoading && <div className="card"><div className="card-body">Загрузка...</div></div>}
            {!newsLoading && (
              <div className="news-grid">
                {news.map((n) => (
                  <div key={n.id} className="news-card" onClick={() => setSelectedNews(n)}>
                    {n.image ? <img src={n.image} alt={n.title} className="news-card-img" /> : null}
                    <div className="news-card-body">
                      <div className="news-card-title">{n.title}</div>
                      <div className="news-card-text">{n.text}</div>
                    </div>
                  </div>
                ))}
                {news.length === 0 && <div className="card"><div className="card-body">Новостей пока нет.</div></div>}
              </div>
            )}
          </div>

          <div className="card" style={{ maxWidth: 720 }}>
            <div className="card-body">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Обратная связь</h3>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Тип</label>
                <select className="form-select" value={fbType} onChange={(e) => setFbType(e.target.value)}>
                  {FEEDBACK_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Сообщение</label>
                <textarea
                  className="form-textarea"
                  value={fbText}
                  onChange={(e) => setFbText(e.target.value)}
                  placeholder="Опишите обращение"
                  style={{ minHeight: 80 }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Формат</label>
                <select className="form-select" value={fbMode} onChange={(e) => setFbMode(e.target.value)}>
                  <option value="named">Неанонимно</option>
                  <option value="anonymous">Анонимно</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={sendFeedback}>Отправить</button>
              {fbMsg ? <div style={{ marginTop: 8, fontSize: 12 }}>{fbMsg}</div> : null}
            </div>
          </div>

          {selectedNews ? (
            <div className="modal-overlay" onClick={() => setSelectedNews(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, width: 'calc(100vw - 32px)' }}>
                <div className="modal-header">
                  <div className="modal-title">{selectedNews.title}</div>
                  <button className="btn-icon" onClick={() => setSelectedNews(null)}><X size={16} /></button>
                </div>
                <div className="modal-body">
                  {selectedNews.image ? (
                    <img src={selectedNews.image} alt={selectedNews.title} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />
                  ) : null}
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{stripHtml(selectedNews.fullText || selectedNews.text)}</p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </MainLayout>
  );
}
