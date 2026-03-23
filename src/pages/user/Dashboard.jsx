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
        </div>
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
    </MainLayout>
  );
}
