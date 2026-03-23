import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Flame,
  MapPin,
  Newspaper,
  PauseCircle,
  PlayCircle,
  Target,
  Users,
  ArrowRight,
  BookOpen,
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
import { useLocale } from '../../context/LocaleContext';
import { attendanceAPI, feedbackAPI, gamificationAPI, newsAPI, onboardingAPI, schedulesAPI, tasksAPI } from '../../api/content';
import { usersAPI } from '../../api/auth';
import { buildFeedbackCreatePayload, FEEDBACK_TYPE_CODES, FEEDBACK_TYPE_OPTIONS } from '../../utils/feedback';
import { ROLE_LABELS, normalizeRole } from '../../utils/roles';

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function mondayOf(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function weekdayMonBased(dateObj) {
  const jsDay = dateObj.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function shortTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function normalizeNews(raw = {}) {
  return {
    id: raw.id,
    title: raw.title || raw.name || 'Без названия',
    text: raw.text || raw.description || '',
    category: raw.category || raw.type || 'Новости',
    date: raw.published_at
      ? new Date(raw.published_at).toLocaleDateString('ru-RU')
      : raw.created_at
      ? new Date(raw.created_at).toLocaleDateString('ru-RU')
      : raw.date || '—',
    img: raw.image || raw.cover || raw.image_url || '',
  };
}

function normalizeOrgMember(raw = {}, departmentName = '') {
  const role = normalizeRole(raw.role || raw.user_role || raw.role_code || raw.account?.role || 'employee');
  const fullName =
    raw.full_name ||
    [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() ||
    raw.name ||
    raw.username ||
    raw.email ||
    `Пользователь #${raw.id}`;
  return {
    id: raw.id,
    name: fullName,
    role,
    position: raw.position_name || raw.position || 'Сотрудник',
    department: raw.department_name || raw.department || departmentName || '',
    managerId: raw.manager_id || raw.lead_id || raw.supervisor_id || null,
  };
}

function normalizeTask(raw = {}) {
  return {
    id: raw.id,
    title: raw.title || 'Задача',
    priority: String(raw.priority || 'medium').toLowerCase(),
    dueDate: raw.due_date || '',
    status: raw.status || '',
    statusLabel: raw.status_label || '',
    isOverdue: Boolean(raw.is_overdue),
  };
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function resolveTodayShift({ todayIsoValue, todayWeekStart, weeklyPlans, mySchedule, workSchedules }) {
  const plansForCurrentWeek = safeList(weeklyPlans).filter(
    (plan) => String(plan.week_start) === String(todayWeekStart)
  );
  const approvedPlan = plansForCurrentWeek.find((plan) => String(plan.status).toLowerCase() === 'approved');
  const selectedPlan = approvedPlan || plansForCurrentWeek[0];
  const dayFromPlan = selectedPlan?.days?.find((item) => String(item.date) === String(todayIsoValue));

  if (dayFromPlan) {
    return {
      mode: dayFromPlan.mode || 'day_off',
      startTime: dayFromPlan.start_time || '',
      endTime: dayFromPlan.end_time || '',
      source: selectedPlan ? 'weekly_plan' : 'none',
      status: selectedPlan?.status || '',
    };
  }

  const assignedSchedule = safeList(workSchedules).find(
    (item) => String(item.id) === String(mySchedule?.schedule)
  );
  if (assignedSchedule) {
    const todayDate = parseIsoDate(todayIsoValue) || new Date();
    const isWorkday =
      Array.isArray(assignedSchedule.work_days) &&
      assignedSchedule.work_days.includes(weekdayMonBased(todayDate));
    return {
      mode: isWorkday ? 'office' : 'day_off',
      startTime: isWorkday ? shortTime(assignedSchedule.start_time) : '',
      endTime: isWorkday ? shortTime(assignedSchedule.end_time) : '',
      source: 'template',
      status: mySchedule?.status || '',
    };
  }

  return {
    mode: 'day_off',
    startTime: '',
    endTime: '',
    source: 'none',
    status: '',
  };
}

function roleBanner(role) {
  const normalized = normalizeRole(role);
  if (normalized === 'intern') {
    return {
      title: 'Личный кабинет стажировки',
      sub: 'Следующий шаг обучения, новости и активность за день собраны на одном экране.',
      action: 'Продолжить онбординг',
      path: '/onboarding',
      bg: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
    };
  }
  if (['projectmanager', 'teamlead'].includes(normalized)) {
    return {
      title: 'CRM-день руководителя',
      sub: 'Смена, фокус, активность команды и операционные новости всегда под рукой.',
      action: 'Открыть задачи',
      path: '/tasks',
      bg: 'linear-gradient(135deg, #7C3AED 0%, #EA580C 100%)',
    };
  }
  if (['department_head', 'admin', 'administrator', 'superadmin', 'systemadmin'].includes(normalized)) {
    return {
      title: 'Контур управления',
      sub: 'Контролируйте рабочий день, важные события и командную активность из единой точки.',
      action: 'Перейти в панель',
      path: '/admin/overview',
      bg: 'linear-gradient(135deg, #0F766E 0%, #2563EB 100%)',
    };
  }
  return {
    title: 'Рабочий день под контролем',
    sub: 'Начните смену, держите фокус на задачах и следите за активностью команды.',
    action: 'Мои задачи',
    path: '/tasks',
    bg: 'linear-gradient(135deg, #16A34A 0%, #2563EB 100%)',
  };
}

const PRIORITY_LABELS = {
  critical: 'Критический',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

export default function Dashboard() {
  const { user } = useAuth();
  const { t, tr } = useLocale();
  const navigate = useNavigate();
  const role = normalizeRole(user?.role);
  const canSendFeedback = !['intern', 'admin', 'administrator', 'superadmin'].includes(role);

  const [selectedNews, setSelectedNews] = useState(null);
  const [readNewsIds, setReadNewsIds] = useState([]);
  const [fbType, setFbType] = useState(FEEDBACK_TYPE_CODES.suggestion);
  const [fbText, setFbText] = useState('');
  const [fbMode, setFbMode] = useState('named');
  const [fbMsg, setFbMsg] = useState('');

  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [orgTeam, setOrgTeam] = useState([]);

  const [mySession, setMySession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [tick, setTick] = useState(Date.now());

  const [focusLoading, setFocusLoading] = useState(true);
  const [internOverview, setInternOverview] = useState(null);
  const [focusTasks, setFocusTasks] = useState([]);

  const [streakLoading, setStreakLoading] = useState(true);
  const [streak, setStreak] = useState(null);

  const [onlineLoading, setOnlineLoading] = useState(true);
  const [onlineRows, setOnlineRows] = useState([]);
  const [onlineHint, setOnlineHint] = useState('');

  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [workSchedules, setWorkSchedules] = useState([]);
  const [mySchedule, setMySchedule] = useState(null);
  const [weeklyPlans, setWeeklyPlans] = useState([]);

  const banner = roleBanner(role);

  const loadNews = async () => {
    setNewsLoading(true);
    try {
      const res = await newsAPI.list();
      setNews(safeList(res.data).map(normalizeNews));
    } catch {
      setNews([]);
    } finally {
      setNewsLoading(false);
    }
  };

  const loadOrgTeam = async () => {
    if (!canSendFeedback) return;
    try {
      const res = await usersAPI.list();
      const myId = Number(user?.id || 0);
      const members = safeList(res?.data)
        .map((m) => normalizeOrgMember(m))
        .filter((m) => Number(m.id) !== myId)
        .slice(0, 4);
      setOrgTeam(members);
    } catch {
      setOrgTeam([]);
    }
  };

  const loadSession = async () => {
    setSessionLoading(true);
    setSessionError('');
    try {
      const res = await attendanceAPI.mySession();
      setMySession(res?.data?.session || null);
    } catch (err) {
      setMySession(null);
      setSessionError(err?.response?.data?.detail || 'Не удалось загрузить смену.');
    } finally {
      setSessionLoading(false);
    }
  };

  const loadFocus = async () => {
    setFocusLoading(true);
    try {
      if (role === 'intern') {
        const res = await onboardingAPI.getMy();
        setInternOverview(res.data || null);
        setFocusTasks([]);
      } else {
        const res = await tasksAPI.my();
        const list = safeList(res.data)
          .map(normalizeTask)
          .sort((a, b) => {
            const order = { critical: 0, high: 1, medium: 2, low: 3 };
            const diff = (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
            if (diff !== 0) return diff;
            return Number(b.isOverdue) - Number(a.isOverdue);
          })
          .slice(0, 4);
        setFocusTasks(list);
        setInternOverview(null);
      }
    } catch {
      setInternOverview(null);
      setFocusTasks([]);
    } finally {
      setFocusLoading(false);
    }
  };

  const loadStreak = async () => {
    setStreakLoading(true);
    try {
      const res = await gamificationAPI.my();
      setStreak(res.data || null);
    } catch {
      setStreak(null);
    } finally {
      setStreakLoading(false);
    }
  };

  const loadOnline = async () => {
    setOnlineLoading(true);
    setOnlineHint('');
    try {
      const res = await attendanceAPI.checkinsReport({ date: todayISO() });
      const rows = safeList(res.data?.rows)
        .filter((row) => row.checked_at)
        .sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at));
      setOnlineRows(rows);
    } catch {
      setOnlineRows([]);
      setOnlineHint('Статус коллег онлайн сейчас доступен руководителям и администраторам.');
    } finally {
      setOnlineLoading(false);
    }
  };

  const loadScheduleContext = async () => {
    setScheduleLoading(true);
    try {
      const [templatesRes, myRes, plansRes] = await Promise.all([
        schedulesAPI.getWorkSchedules(),
        schedulesAPI.getMine(),
        schedulesAPI.weeklyPlansMy(),
      ]);
      setWorkSchedules(safeList(templatesRes.data));
      setMySchedule(myRes?.data || null);
      setWeeklyPlans(safeList(plansRes.data));
    } catch {
      setWorkSchedules([]);
      setMySchedule(null);
      setWeeklyPlans([]);
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
    loadOrgTeam();
    loadSession();
    loadFocus();
    loadStreak();
    loadOnline();
    loadScheduleContext();
  }, [user?.id, role]);

  useEffect(() => {
    if (!mySession?.checked_at || mySession?.checked_out_at) return undefined;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [mySession?.checked_at, mySession?.checked_out_at]);

  const isShiftActive = Boolean(mySession?.checked_at && !mySession?.checked_out_at);
  const shiftDuration = useMemo(() => {
    if (!mySession?.checked_at) return '00:00:00';
    const startedAt = new Date(mySession.checked_at).getTime();
    const finishedAt = mySession?.checked_out_at ? new Date(mySession.checked_out_at).getTime() : tick;
    return formatDuration(finishedAt - startedAt);
  }, [mySession?.checked_at, mySession?.checked_out_at, tick]);

  const focusTitle = role === 'intern' ? 'Мой фокус: онбординг' : 'Мой фокус на сегодня';
  const currentDay = internOverview?.current_day || null;
  const onboardingProgress = Number(internOverview?.progress_percent || 0);

  const unreadNews = useMemo(
    () => news.filter((item) => !readNewsIds.includes(item.id)).slice(0, 4),
    [news, readNewsIds]
  );

  const todayIsoValue = useMemo(() => todayISO(), []);
  const todayWeekStart = useMemo(() => isoDate(mondayOf(new Date())), []);
  const todayShift = useMemo(
    () =>
      resolveTodayShift({
        todayIsoValue,
        todayWeekStart,
        weeklyPlans,
        mySchedule,
        workSchedules,
      }),
    [todayIsoValue, todayWeekStart, weeklyPlans, mySchedule, workSchedules]
  );

  const shiftModeLabel = useMemo(() => {
    if (todayShift.mode === 'office') return 'Офис';
    if (todayShift.mode === 'online') return 'Онлайн';
    return 'Выходной';
  }, [todayShift.mode]);

  const shiftSourceLabel = useMemo(() => {
    if (todayShift.source === 'weekly_plan') return 'По недельному плану';
    if (todayShift.source === 'template') return 'По назначенному графику';
    return 'График не назначен';
  }, [todayShift.source]);

  const shiftWindowLabel =
    todayShift.startTime && todayShift.endTime
      ? `${todayShift.startTime} - ${todayShift.endTime}`
      : 'Без рабочего окна';

  const onlineSummary = useMemo(() => {
    const initial = {
      employees: 0,
      managers: 0,
      heads: 0,
      admins: 0,
      late: 0,
      office: 0,
      online: 0,
    };
    return onlineRows.reduce((acc, row) => {
      const rowRole = normalizeRole(row.role);
      if (['employee', 'intern'].includes(rowRole)) acc.employees += 1;
      else if (['teamlead', 'projectmanager'].includes(rowRole)) acc.managers += 1;
      else if (['department_head', 'admin'].includes(rowRole)) acc.heads += 1;
      else if (['administrator', 'systemadmin', 'superadmin'].includes(rowRole)) acc.admins += 1;
      if (Number(row.late_minutes || 0) > 0) acc.late += 1;
      if (row.shift_mode === 'office') acc.office += 1;
      if (row.shift_mode === 'online') acc.online += 1;
      return acc;
    }, initial);
  }, [onlineRows]);

  const handleShiftAction = async () => {
    setSessionBusy(true);
    setSessionError('');
    try {
      if (isShiftActive) {
        await attendanceAPI.officeCheckOut();
      } else {
        await attendanceAPI.officeCheckIn({});
      }
      await Promise.all([loadSession(), loadOnline()]);
    } catch (err) {
      setSessionError(err?.response?.data?.detail || 'Не удалось обновить смену.');
    } finally {
      setSessionBusy(false);
    }
  };

  const markNewsRead = (id) => {
    setReadNewsIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const sendFeedback = async () => {
    if (!fbText.trim()) return;
    try {
      await feedbackAPI.create(
        buildFeedbackCreatePayload({
          type: fbType,
          text: fbText,
          isAnonymous: fbMode === 'anonymous',
        })
      );
      setFbText('');
      setFbType(FEEDBACK_TYPE_CODES.suggestion);
      setFbMode('named');
      setFbMsg(tr('Обращение отправлено.'));
      setTimeout(() => setFbMsg(''), 2500);
    } catch (err) {
      setFbMsg(err?.response?.data?.detail || tr('Не удалось отправить обращение.'));
      setTimeout(() => setFbMsg(''), 3500);
    }
  };

  return (
    <MainLayout title={t('sidebar.home', 'Главная')}>
      <div className="announcement-banner" style={{ background: banner.bg, position: 'relative', overflow: 'hidden' }}>
        <div>
          <div className="announcement-title">{tr(banner.title)}</div>
          <div className="announcement-sub">{tr(banner.sub)}</div>
          <button className="btn" style={{ background: 'white', color: 'var(--primary)', fontWeight: 600, marginTop: 12 }} onClick={() => navigate(banner.path)}>
            {tr(banner.action)}
          </button>
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

      <div className="crm-shift-card">
        <div>
          <div className="crm-shift-card__eyebrow">Рабочая смена</div>
          <div className="crm-shift-card__title">{isShiftActive ? 'Смена уже идет' : 'Смена еще не начата'}</div>
          <div className="crm-shift-card__subtitle">
            {sessionLoading
              ? 'Проверяем текущий статус...'
              : isShiftActive
              ? `Начало: ${formatDateTime(mySession?.checked_at)}`
              : 'Нажмите, чтобы зафиксировать начало рабочего дня.'}
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
          <div className="crm-shift-card__meta">
            <span className="badge badge-blue">{ROLE_LABELS[role] || 'Сотрудник'}</span>
            <span className="badge badge-gray">{shiftModeLabel}</span>
            <span className="badge badge-gray">{shiftWindowLabel}</span>
            {!scheduleLoading ? <span className="badge badge-gray">{shiftSourceLabel}</span> : null}
          </div>
          <div className="crm-shift-card__note">
            {todayShift.mode === 'online'
              ? `Сегодня онлайн-день — геолокация и WiFi не требуются. Нажмите кнопку чтобы отметиться удалённо${shiftWindowLabel !== 'Без рабочего окна' ? ` (${shiftWindowLabel})` : ''}.`
              : `Кнопка «Начать смену» одновременно делает attendance-отметку. Сегодня по графику ${shiftModeLabel.toLowerCase()}${shiftWindowLabel !== 'Без рабочего окна' ? `, ${shiftWindowLabel}` : ''}.`
            }
          </div>
          {sessionError ? <div className="crm-shift-card__error">{sessionError}</div> : null}
        </div>

        <div className="crm-shift-card__side">
          <div className="crm-shift-timer">
            <Clock3 size={16} />
            <span>{shiftDuration}</span>
          </div>
          <button className={`btn ${isShiftActive ? 'btn-secondary' : 'btn-primary'} btn-lg`} type="button" onClick={handleShiftAction} disabled={sessionBusy || sessionLoading}>
            {isShiftActive ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
            {sessionBusy
              ? 'Сохраняем...'
              : isShiftActive
                ? 'Завершить смену'
                : todayShift.mode === 'online'
                  ? 'Начать онлайн-смену'
                  : 'Начать смену'}
          </button>
        </div>
      </div>

      <div className="crm-dashboard-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title"><CalendarCheck2 size={16} /> График на сегодня</span>
          </div>
          <div className="card-body">
            {scheduleLoading ? <div className="text-muted">Загружаем график...</div> : null}
            {!scheduleLoading ? (
              <div className="crm-schedule-summary">
                <div className="crm-schedule-summary__row">
                  <span>Статус дня</span>
                  <strong>{shiftModeLabel}</strong>
                </div>
                <div className="crm-schedule-summary__row">
                  <span>Рабочее окно</span>
                  <strong>{shiftWindowLabel}</strong>
                </div>
                <div className="crm-schedule-summary__row">
                  <span>Источник</span>
                  <strong>{shiftSourceLabel}</strong>
                </div>
                <div className="crm-schedule-summary__row">
                  <span>Назначенный график</span>
                  <strong>{mySchedule?.schedule_name || 'Пока не назначен'}</strong>
                </div>
                <div className="crm-schedule-summary__hint">
                  {todayShift.mode === 'day_off'
                    ? 'Сегодня нерабочий день по графику.'
                    : 'Начало смены синхронизировано с отметкой присутствия, отдельная отметка не нужна.'}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Target size={16} /> {focusTitle}</span>
          </div>
          <div className="card-body">
            {focusLoading ? <div className="text-muted">Загрузка фокуса...</div> : null}

            {!focusLoading && role === 'intern' ? (
              currentDay ? (
                <div className="crm-focus-block">
                  <div className="crm-focus-day">День {currentDay.day_number}</div>
                  <div className="crm-focus-title">{currentDay.title}</div>
                  <div className="crm-focus-subtitle">Прогресс программы: {onboardingProgress}%</div>
                  <div className="crm-progress">
                    <div className="crm-progress__fill" style={{ width: `${Math.max(0, Math.min(100, onboardingProgress))}%` }} />
                  </div>
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate('/onboarding')}>
                    Продолжить день
                  </button>
                </div>
              ) : (
                <div className="text-muted">Текущий этап стажировки пока не найден.</div>
              )
            ) : null}

            {!focusLoading && role !== 'intern' ? (
              focusTasks.length > 0 ? (
                <div className="crm-focus-list">
                  {focusTasks.map((task) => (
                    <div key={task.id} className="crm-focus-item">
                      <div>
                        <div className="crm-focus-item__title">{task.title}</div>
                        <div className="crm-focus-item__meta">
                          {PRIORITY_LABELS[task.priority] || task.priority}
                          {task.dueDate ? ` · до ${task.dueDate}` : ''}
                        </div>
                      </div>
                      {task.isOverdue ? <span className="badge badge-red">Просрочена</span> : <span className="badge badge-blue">{task.statusLabel || task.status || 'В работе'}</span>}
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate('/tasks')}>
                    Открыть все задачи
                  </button>
                </div>
              ) : (
                <div className="text-muted">Активных задач для фокуса пока нет.</div>
              )
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title"><Flame size={16} /> Огонек активности</span>
          </div>
          <div className="card-body">
            {streakLoading ? <div className="text-muted">Считаем streak...</div> : null}
            {!streakLoading ? (
              <div className="crm-streak">
                <div className="crm-streak__value">{Number(streak?.current_streak || 0)}</div>
                <div className="crm-streak__label">дней подряд</div>
                <div className="crm-streak__meta">
                  Лучший результат: {Number(streak?.longest_streak || 0)} · Последний отчет: {streak?.last_report_date || '—'}
                </div>
                {safeList(streak?.badges).length > 0 ? (
                  <div className="crm-badges">
                    {safeList(streak.badges).slice(0, 3).map((badge) => (
                      <span key={badge.code} className="badge badge-orange">{badge.name}</span>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted" style={{ marginTop: 10 }}>Первый бейдж появится после стабильной активности.</div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title"><Users size={16} /> Кто на связи</span>
          </div>
          <div className="card-body">
            {onlineLoading ? <div className="text-muted">Проверяем активность коллег...</div> : null}
            {!onlineLoading && onlineRows.length > 0 ? (
              <div className="crm-online-summary">
                <div className="crm-online-summary__item">
                  <span>Сотрудники</span>
                  <strong>{onlineSummary.employees}</strong>
                </div>
                <div className="crm-online-summary__item">
                  <span>PM / тимлиды</span>
                  <strong>{onlineSummary.managers}</strong>
                </div>
                <div className="crm-online-summary__item">
                  <span>Руководители</span>
                  <strong>{onlineSummary.heads}</strong>
                </div>
                <div className="crm-online-summary__item">
                  <span>Администраторы</span>
                  <strong>{onlineSummary.admins}</strong>
                </div>
              </div>
            ) : null}
            {!onlineLoading && onlineRows.length > 0 ? (
              <div className="crm-online-summary crm-online-summary--secondary">
                <div className="crm-online-summary__item">
                  <span>В офисе</span>
                  <strong>{onlineSummary.office}</strong>
                </div>
                <div className="crm-online-summary__item">
                  <span>Онлайн</span>
                  <strong>{onlineSummary.online}</strong>
                </div>
                <div className="crm-online-summary__item">
                  <span>Опоздали</span>
                  <strong>{onlineSummary.late}</strong>
                </div>
              </div>
            ) : null}
            {!onlineLoading && onlineRows.length > 0 ? (
              <div className="crm-online-list">
                {onlineRows.slice(0, 6).map((person) => (
                  <div key={person.user_id} className="crm-online-item">
                    <div className="crm-online-item__avatar">
                      {String(person.full_name || person.username).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="crm-online-item__name">{person.full_name || person.username}</div>
                      <div className="crm-online-item__meta">
                        {ROLE_LABELS[normalizeRole(person.role)] || 'Сотрудник'} · {person.shift_mode === 'online' ? 'Онлайн' : 'Офис'} · с {formatDateTime(person.checked_at)}
                        {person.shift_from ? ` · график ${person.shift_from}${person.shift_to ? `-${person.shift_to}` : ''}` : ''}
                        {Number(person.late_minutes || 0) > 0 ? ` · опоздание ${person.late_minutes} мин` : ''}
                      </div>
                    </div>
                    <span className="status-dot green" />
                  </div>
                ))}
              </div>
            ) : null}
            {!onlineLoading && !onlineRows.length ? (
              <div className="text-muted">{onlineHint || 'Сейчас никто не отмечен как активный.'}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title"><Newspaper size={16} /> Важные новости</span>
        </div>
        <div className="card-body">
          {newsLoading ? <div className="text-muted">Загрузка новостей...</div> : null}
          {!newsLoading && unreadNews.length === 0 ? <div className="text-muted">Новых объявлений сейчас нет.</div> : null}
          {!newsLoading && unreadNews.length > 0 ? (
            <div className="crm-news-list">
              {unreadNews.map((item) => (
                <div key={item.id} className="crm-news-item">
                  <div className="crm-news-item__content" onClick={() => setSelectedNews(item)}>
                    <div className="crm-news-item__meta">
                      <span className="badge badge-blue">{tr(item.category)}</span>
                      <span>{item.date}</span>
                    </div>
                    <div className="crm-news-item__title">{item.title}</div>
                    <div className="crm-news-item__text">{item.text || 'Без описания'}</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => markNewsRead(item.id)}>
                    <CheckCircle2 size={14} /> Прочитано
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {normalizeRole(user?.role) !== 'intern' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Быстрые действия</span>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate('/resources')}>
              <MapPin size={14} /> Забронировать ресурс
            </button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate('/resources?focus=bookings')}>
              <MapPin size={14} /> Мои брони
            </button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate('/schedule')}>
              <CalendarCheck2 size={14} /> Мой график
            </button>
          </div>
        </div>
      )}

      {canSendFeedback && (
        <>
          <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
            <div className="card-body">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{tr('Обратная связь')}</h3>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16, lineHeight: 1.5 }}>
                {tr('Оставьте обращение, указав тип и контакты для связи.')}
              </p>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">{tr('Тип обращения')}</label>
                <select className="form-select" value={fbType} onChange={(e) => setFbType(e.target.value)}>
                  {FEEDBACK_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {tr(option.label)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">{tr('Сообщение')}</label>
                <textarea className="form-textarea" placeholder={tr('Опишите ваше обращение...')} style={{ minHeight: 80 }} value={fbText} onChange={(e) => setFbText(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">{tr('Формат отправки')}</label>
                <select className="form-select" value={fbMode} onChange={(e) => setFbMode(e.target.value)}>
                  <option value="named">{tr('Неанонимно')}</option>
                  <option value="anonymous">{tr('Анонимно')}</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={sendFeedback}>{tr('Отправить')}</button>
              {fbMsg ? <div style={{ marginTop: 8, fontSize: 12, color: fbMsg.includes('Не удалось') ? 'var(--danger)' : 'var(--success)' }}>{fbMsg}</div> : null}
            </div>
          </div>

          {orgTeam.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Наша команда</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {orgTeam.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
                      <div className="avatar" style={{ width: 36, height: 36, background: 'var(--primary-light)', fontSize: 13 }}>
                        {p.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{tr(p.position)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {selectedNews ? (
        <div className="modal-overlay" onClick={() => setSelectedNews(null)}>
          <div style={{ background: '#2D3748', borderRadius: 16, width: 760, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            {selectedNews.img ? <img src={selectedNews.img} alt={selectedNews.title} style={{ width: '100%', height: 300, objectFit: 'cover' }} /> : null}
            <button onClick={() => setSelectedNews(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={16} />
            </button>
            <div style={{ background: 'white', padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span className="badge badge-blue">{tr(selectedNews.category)}</span>
                <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>📅 {selectedNews.date}</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>{selectedNews.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: 1.7 }}>{selectedNews.text}</p>
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
