import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { usersAPI } from '../../api/auth';
import {
  createScheduleRequest,
  decideScheduleRequest,
  getScheduleRequests,
  setAssignedSchedule,
} from '../../utils/scheduleApproval';

const DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_NAMES_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_ID_TO_KEY = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 7: 'sun' };
const DAY_ID_TO_SHORT = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 7: 'Вс' };

const WEEKLY_FALLBACK = [
  {
    id: 'w1',
    weekStart: '09 марта 2026 г.',
    user: 'employee_test_22',
    officeHours: 56,
    onlineHours: 0,
    status: 'Утвержден',
    reviewedBy: 'Айсу',
    updatedAt: '25 февраля 2026 г. 06:23',
  },
  {
    id: 'w2',
    weekStart: '02 марта 2026 г.',
    user: 'employee_test_22',
    officeHours: 56,
    onlineHours: 0,
    status: 'Утвержден',
    reviewedBy: 'Айсу',
    updatedAt: '25 февраля 2026 г. 06:23',
  },
  {
    id: 'w3',
    weekStart: '23 февраля 2026 г.',
    user: 'emp_alina',
    officeHours: 26,
    onlineHours: 16,
    status: 'Утвержден',
    reviewedBy: 'Айсу',
    updatedAt: '25 февраля 2026 г. 06:34',
  },
];

const defaultEditorDay = (mode = 'office') => ({
  from: mode === 'dayoff' ? '' : '09:00',
  to: mode === 'dayoff' ? '' : '17:00',
  mode,
  comment: '',
  breaks: [],
});

const defaultEditorPlan = {
  mon: defaultEditorDay('office'),
  tue: defaultEditorDay('office'),
  wed: defaultEditorDay('office'),
  thu: defaultEditorDay('office'),
  fri: defaultEditorDay('office'),
  sat: defaultEditorDay('dayoff'),
  sun: defaultEditorDay('dayoff'),
};

function toHours(from, to) {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const minutes = th * 60 + tm - (fh * 60 + fm);
  return Math.max(0, Math.round((minutes / 60) * 100) / 100);
}

function addMinutes(time, minutes) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function weekStartMonday(base = new Date()) {
  const d = new Date(base);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateLong(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function dateInputValue(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function getPlanHoursByMode(daysPlan = []) {
  return daysPlan.reduce(
    (acc, d) => {
      if (d.isOff) return acc;
      const hours = toHours(d.start, d.end);
      if ((d.mode || 'office') === 'online') acc.online += hours;
      else acc.office += hours;
      return acc;
    },
    { office: 0, online: 0 }
  );
}

function getWorkingDaysLabel(daysPlan = []) {
  const labels = daysPlan
    .filter((d) => !d.isOff)
    .map((d) => DAY_ID_TO_SHORT[d.dayOfWeek] || `Д${d.dayOfWeek}`);
  return labels.length ? labels.join(', ') : '—';
}

function mapDaysPlanToEditor(daysPlan = []) {
  if (!Array.isArray(daysPlan) || daysPlan.length === 0) return defaultEditorPlan;
  const next = { ...defaultEditorPlan };
  daysPlan.forEach((day) => {
    const key = DAY_ID_TO_KEY[day.dayOfWeek];
    if (!key) return;
    const isOff = Boolean(day.isOff);
    next[key] = {
      from: isOff ? '' : day.start || '09:00',
      to: isOff ? '' : day.end || '17:00',
      mode: isOff ? 'dayoff' : day.mode || 'office',
      comment: day.comment || '',
      breaks: Array.isArray(day.breaks)
        ? day.breaks.map((br) => {
            if (typeof br === 'string') {
              const [start = '', end = ''] = br.split('-');
              return { start, end };
            }
            return { start: br?.start || '', end: br?.end || '' };
          })
        : [],
    };
  });
  return next;
}

function mapEditorToDaysPlan(plan) {
  return DAY_KEYS.map((key, idx) => {
    const day = plan[key];
    const isOff = day.mode === 'dayoff';
    return {
      dayOfWeek: idx + 1,
      isOff,
      start: isOff ? '' : day.from,
      end: isOff ? '' : day.to,
      mode: isOff ? 'dayoff' : day.mode,
      comment: day.comment || '',
      breaks: Array.isArray(day.breaks) ? day.breaks : [],
    };
  });
}

function getActiveUsers(mockUsers = []) {
  return mockUsers.filter((u) => u.role !== 'superadmin');
}

function getDefaultSlot(dayOfWeek) {
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    return { isOff: false, start: '09:00', end: '18:00', mode: 'office' };
  }
  return { isOff: true, start: '', end: '', mode: 'dayoff' };
}

function getUserDaySlot(daysPlan = [], dayOfWeek) {
  const fromPlan = daysPlan.find((d) => Number(d.dayOfWeek) === Number(dayOfWeek));
  return fromPlan || getDefaultSlot(dayOfWeek);
}

export default function AdminSchedules() {
  const { user } = useAuth();
  const canReview = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'administrator' || user?.role === 'department_head';
  const isAdminOrSuper = canReview;

  const [tab, setTab] = useState('apps');
  const [refreshToken, setRefreshToken] = useState(0);
  const [apiUsers, setApiUsers] = useState([]);

  const [searchWeekly, setSearchWeekly] = useState('');
  const [searchUsers, setSearchUsers] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [boardWeekStart, setBoardWeekStart] = useState(weekStartMonday());
  const [editorWeekStart, setEditorWeekStart] = useState(dateInputValue(weekStartMonday()));
  const [editorUserId, setEditorUserId] = useState('');
  const [editorPlan, setEditorPlan] = useState(defaultEditorPlan);
  const [editorMessage, setEditorMessage] = useState('');

  useEffect(() => {
    usersAPI.list().then((res) => {
      const list = Array.isArray(res?.data) ? res.data : [];
      setApiUsers(list.map((u) => ({
        id: u.id,
        name: u.full_name || u.username || String(u.id),
        role: u.role || 'employee',
      })));
    }).catch(() => {});
  }, []);

  const forceRefresh = () => setRefreshToken((v) => v + 1);

  const requests = useMemo(() => getScheduleRequests(), [refreshToken]);
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');

  const allUsers = useMemo(() => getActiveUsers(apiUsers), [apiUsers]);

  const latestApprovedByUserId = useMemo(() => {
    const map = new Map();
    approvedRequests.forEach((r) => {
      const key = String(r.userId);
      if (!map.has(key)) map.set(key, r);
    });
    return map;
  }, [approvedRequests]);

  const weeklyRows = useMemo(() => {
    const dynamicRows = approvedRequests.map((r) => {
      const userName = r.userName || allUsers.find((u) => String(u.id) === String(r.userId))?.name || '—';
      const hours = getPlanHoursByMode(r.schedule?.daysPlan || []);
      return {
        id: `approved-${r.id}`,
        weekStart: r.createdAt || '—',
        user: userName,
        officeHours: hours.office,
        onlineHours: hours.online,
        status: 'Утвержден',
        reviewedBy: r.reviewerName || '—',
        updatedAt: r.reviewedAt || r.createdAt || '—',
      };
    });
    return [...WEEKLY_FALLBACK, ...dynamicRows];
  }, [approvedRequests, allUsers]);

  const weeklyFiltered = useMemo(() => {
    const q = searchWeekly.trim().toLowerCase();
    if (!q) return weeklyRows;
    return weeklyRows.filter((row) =>
      [row.weekStart, row.user, row.reviewedBy, row.status].join(' ').toLowerCase().includes(q)
    );
  }, [weeklyRows, searchWeekly]);

  const userRows = useMemo(() => {
    return allUsers.map((u) => {
      const latestApproved = latestApprovedByUserId.get(String(u.id)) || null;
      const daysPlan = latestApproved?.schedule?.daysPlan || [];
      return {
        id: u.id,
        user: u.name,
        workDays: getWorkingDaysLabel(daysPlan) || 'Пн, Вт, Ср, Чт, Пт',
        onlineDays: daysPlan.filter((d) => !d.isOff && (d.mode || 'office') === 'online').map((d) => DAY_ID_TO_SHORT[d.dayOfWeek]).join(', ') || '—',
        approved: Boolean(latestApproved),
        approvedAt: latestApproved?.reviewedAt || '—',
        scheduleName: latestApproved?.schedule?.name || 'Личный график',
        requestedAt: latestApproved?.createdAt || '—',
        daysPlan,
      };
    });
  }, [allUsers, latestApprovedByUserId]);

  const userFiltered = useMemo(() => {
    const q = searchUsers.trim().toLowerCase();
    if (!q) return userRows;
    return userRows.filter((row) => row.user.toLowerCase().includes(q));
  }, [userRows, searchUsers]);

  const selectedRow = useMemo(() => {
    if (selectedUserId == null) return userFiltered[0] || null;
    return userRows.find((r) => String(r.id) === String(selectedUserId)) || null;
  }, [selectedUserId, userFiltered, userRows]);

  const boardColumns = useMemo(() => {
    return DAY_NAMES_SHORT.map((name, idx) => {
      const dayDate = addDays(boardWeekStart, idx);
      const dayOfWeek = idx + 1;
      const entries = userRows
        .map((u) => {
          const slot = getUserDaySlot(u.daysPlan, dayOfWeek);
          if (slot.isOff) return null;
          return {
            id: `${u.id}-${idx}`,
            user: u.user,
            from: slot.start || '09:00',
            to: slot.end || '18:00',
            mode: slot.mode || 'office',
          };
        })
        .filter(Boolean);

      return {
        name,
        date: formatDate(dayDate),
        entries,
      };
    });
  }, [boardWeekStart, userRows]);

  const editorTotals = useMemo(() => {
    return DAY_KEYS.reduce(
      (acc, key) => {
        const d = editorPlan[key];
        if (d.mode === 'dayoff') return acc;
        const h = toHours(d.from, d.to);
        if (d.mode === 'online') acc.online += h;
        else acc.offline += h;
        return acc;
      },
      { offline: 0, online: 0 }
    );
  }, [editorPlan]);

  const goPrevBoardWeek = () => setBoardWeekStart((d) => addDays(d, -7));
  const goNextBoardWeek = () => setBoardWeekStart((d) => addDays(d, 7));

  const openDetails = (rowId) => {
    setSelectedUserId(rowId);
    setTab('detail');
  };

  const approveRequest = (id) => {
    const req = pendingRequests.find((r) => String(r.id) === String(id));
    if (!req) return;
    setAssignedSchedule({
      userId: req.userId,
      schedule: req.schedule,
      approvedBy: user?.name || 'Администратор',
    });
    decideScheduleRequest(id, 'approved', user?.name || 'Администратор');
    forceRefresh();
  };

  const rejectRequest = (id) => {
    decideScheduleRequest(id, 'rejected', user?.name || 'Администратор');
    forceRefresh();
  };

  const loadUserPlanToEditor = (userId) => {
    const row = userRows.find((u) => String(u.id) === String(userId));
    if (!row) return;
    setEditorUserId(String(userId));
    setEditorPlan(mapDaysPlanToEditor(row.daysPlan));
    setEditorMessage('');
  };

  const changeEditorDay = (key, patch) => {
    setEditorPlan((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const addBreak = (key) => {
    const day = editorPlan[key];
    const last = day.breaks[day.breaks.length - 1];
    const start = last ? addMinutes(last.start, 15) : day.from || '13:00';
    const end = addMinutes(start, 15);
    setEditorPlan((prev) => ({
      ...prev,
      [key]: { ...prev[key], breaks: [...prev[key].breaks, { start, end }] },
    }));
  };

  const updateBreak = (key, index, field, value) => {
    setEditorPlan((prev) => {
      const nextBreaks = [...prev[key].breaks];
      nextBreaks[index] = { ...nextBreaks[index], [field]: value };
      return { ...prev, [key]: { ...prev[key], breaks: nextBreaks } };
    });
  };

  const removeBreak = (key, index) => {
    setEditorPlan((prev) => {
      const nextBreaks = prev[key].breaks.filter((_, i) => i !== index);
      return { ...prev, [key]: { ...prev[key], breaks: nextBreaks } };
    });
  };

  const clearBreaks = (key) => {
    setEditorPlan((prev) => ({
      ...prev,
      [key]: { ...prev[key], breaks: [] },
    }));
  };

  const submitEditorAsRequest = () => {
    if (!editorUserId) {
      setEditorMessage('Выберите сотрудника для создания плана.');
      return;
    }

    const targetUser = allUsers.find((u) => String(u.id) === String(editorUserId));
    if (!targetUser) {
      setEditorMessage('Сотрудник не найден.');
      return;
    }

    const daysPlan = mapEditorToDaysPlan(editorPlan);
    createScheduleRequest({
      userId: targetUser.id,
      userName: targetUser.name,
      userRole: targetUser.role,
      schedule: {
        id: `admin_weekly_${Date.now()}`,
        name: `Личный график (${editorWeekStart})`,
        workDays: getWorkingDaysLabel(daysPlan),
        hours: 'По дням',
        lunch: 'По дням',
        breaks: 'Короткие перерывы по дням',
        daysPlan,
      },
    });

    setEditorMessage('Заявка на недельный план создана (pending). Утвердите ее во вкладке пользователей.');
    forceRefresh();
  };

  return (
    <MainLayout title="Админ-панель · Графики работы">
      <div className="page-header">
        <div>
          <div className="page-title">Администрирование приложения «Графики работы»</div>
          <div className="page-subtitle">Недельные планы, графики пользователей, недельная доска и редактор плана</div>
        </div>
      </div>

      {tab !== 'apps' && (
        <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setTab('apps')}>← Назад</button>
          <span>Графики работы</span>
          <span style={{ color: 'var(--gray-400)' }}>›</span>
          <span style={{ color: 'var(--gray-800)', fontWeight: 600 }}>
            {tab === 'weekly' && 'Недельные планы работы'}
            {tab === 'users' && 'График работы сотрудников'}
            {tab === 'detail' && 'Детали сотрудника'}
            {tab === 'board' && 'Графики работы: неделя'}
            {tab === 'builder' && 'Календарь недельного плана'}
          </span>
        </div>
      )}

      {tab === 'apps' && (
        <div className="card">
          <div className="card-body" style={{ paddingTop: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Графики работы</div>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  <tr>
                    <td style={{ cursor: 'pointer' }} onClick={() => setTab('weekly')}>Недельные планы работы</td>
                  </tr>
                  <tr>
                    <td style={{ cursor: 'pointer' }} onClick={() => setTab('users')}>График работы сотрудников</td>
                  </tr>
                  <tr>
                    <td style={{ cursor: 'pointer' }} onClick={() => setTab('board')}>Графики работы: неделя</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'weekly' && (
        <div className="card">
          <div className="card-header" style={{ gap: 10 }}>
            <input
              className="form-input"
              placeholder="Введите для поиска"
              style={{ maxWidth: 360 }}
              value={searchWeekly}
              onChange={(e) => setSearchWeekly(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" onClick={() => setTab('builder')}>
              <Plus size={14} /> Создать
            </button>
            <button className="btn btn-secondary btn-sm">Фильтры</button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th>Начало недели</th>
                  <th>Сотрудник</th>
                  <th>Часы в офисе</th>
                  <th>Часы онлайн</th>
                  <th>Статус</th>
                  <th>Кем проверено</th>
                  <th>Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {weeklyFiltered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ color: 'var(--gray-500)' }}>Ничего не найдено</td>
                  </tr>
                )}
                {weeklyFiltered.map((row) => (
                  <tr key={row.id}>
                    <td><input type="checkbox" /></td>
                    <td>{row.weekStart}</td>
                    <td>{row.user}</td>
                    <td>{row.officeHours}</td>
                    <td>{row.onlineHours}</td>
                    <td>{row.status}</td>
                    <td>{row.reviewedBy}</td>
                    <td>{row.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header" style={{ gap: 10 }}>
              <input
                className="form-input"
              placeholder="Введите для поиска"
                style={{ maxWidth: 360 }}
                value={searchUsers}
                onChange={(e) => setSearchUsers(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={() => setTab('builder')}>
                <Plus size={14} /> Создать
              </button>
              <button className="btn btn-secondary btn-sm">Фильтры</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }} />
                    <th>Юзер</th>
                    <th>Подробности</th>
                    <th>Рабочие дни</th>
                    <th>Онлайн дни</th>
                    <th>Утвержденный недельный план</th>
                    <th>Время утверждения недельного плана</th>
                  </tr>
                </thead>
                <tbody>
                  {userFiltered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ color: 'var(--gray-500)' }}>Пользователи не найдены</td>
                    </tr>
                  )}
                  {userFiltered.map((row) => (
                    <tr key={row.id}>
                      <td><input type="checkbox" /></td>
                      <td>{row.user}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openDetails(row.id)}>
                          Подробности
                        </button>
                      </td>
                      <td>{row.workDays}</td>
                      <td>{row.onlineDays}</td>
                      <td>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            display: 'inline-block',
                            background: row.approved ? '#16A34A' : '#DC2626',
                          }}
                        />
                      </td>
                      <td>{row.approvedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {canReview && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Заявки на утверждение графика</span>
              </div>
              <div className="card-body">
                {pendingRequests.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Нет заявок на одобрение.</div>
                )}
                {pendingRequests.map((req) => {
                  const planHours = getPlanHoursByMode(req.schedule?.daysPlan || []);
                  return (
                    <div
                      key={req.id}
                      style={{
                        border: '1px solid var(--gray-200)',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{req.userName}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                        График: {req.schedule?.name || 'Личный график'} · Запрос: {req.createdAt}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                        Офис: {planHours.office}ч · Онлайн: {planHours.online}ч
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => approveRequest(req.id)}>
                          Одобрить
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => rejectRequest(req.id)}>
                          Отклонить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'weekly' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                <div>
                  <label className="form-label">Неделя (понедельник)</label>
                  <input className="form-input" type="date" value={weekFilter} onChange={(e) => setWeekFilter(normalizeWeekFilter(e.target.value))} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => setWeekFilter((prev) => shiftWeekFilter(prev, -1))}
                  >
                    Предыдущая неделя
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => setWeekFilter((prev) => shiftWeekFilter(prev, 1))}
                  >
                    Следующая неделя
                  </button>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Комментарий администратора</label>
                  <input className="form-input" value={decisionComment} onChange={(e) => setDecisionComment(e.target.value)} placeholder="Комментарий для доработки/отклонения" />
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>ID</th><th>Сотрудник</th><th>Неделя</th><th>Офис</th><th>Онлайн</th><th>Статус</th><th>Обновлен</th><th>Действия</th></tr>
                  </thead>
                  <tbody>
                    {plansForWeek.map((p) => (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td>{p.username || usersMap.get(Number(p.user))?.full_name || `#${p.user}`}</td>
                        <td>{p.week_start}</td>
                        <td>{p.office_hours} ч</td>
                        <td>{p.online_hours} ч</td>
                        <td>{STATUS_LABELS[p.status] || p.status}</td>
                        <td>{formatDateTime(p.updated_at)}</td>
                        <td>
                          {p.status !== 'approved' && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => decideWeeklyPlan(p.id, 'approve')}>Утвердить</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => decideWeeklyPlan(p.id, 'request_clarification')}>На доработку</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => decideWeeklyPlan(p.id, 'reject')}>Отклонить</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {plansForWeek.length === 0 && <tr><td colSpan={8}>На выбранную неделю планов нет.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'board' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                <div>
                  <label className="form-label">Неделя (понедельник)</label>
                  <input className="form-input" type="date" value={weekFilter} onChange={(e) => setWeekFilter(normalizeWeekFilter(e.target.value))} />
                </div>
                <div style={{ color: 'var(--gray-500)', fontSize: 13, marginLeft: 'auto' }}>
                  Показываются только утвержденные реальные смены сотрудников
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={loadTeamAttendanceByWeek}
                  >
                    Обновить
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => setWeekFilter((prev) => shiftWeekFilter(prev, -1))}
                  >
                    Предыдущая неделя
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => setWeekFilter((prev) => shiftWeekFilter(prev, 1))}
                  >
                    Следующая неделя
                  </button>
                </div>
              </div>
              <div style={{ padding: '8px 20px 0', fontSize: 12, color: 'var(--gray-600)' }}>


              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(170px, 1fr))', borderTop: '1px solid var(--gray-200)', overflowX: 'auto' }}>
                {boardColumns.map((col, idx) => (
                  <div key={col.label} style={{ minHeight: 360, borderRight: idx < 6 ? '1px solid var(--gray-200)' : 'none' }}>
                    <div style={{ background: '#0B1C46', color: 'white', padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700 }}>{col.label}</div>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>{formatDate(new Date(new Date(weekFilter).getTime() + idx * 86400000))}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'detail' && selectedRow && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">График работы сотрудников › {selectedRow.user}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setTab('users')}>
              Назад
            </button>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 16 }}>
            <div style={{ border: '1px solid var(--gray-200)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Основное</div>
              <div style={{ display: 'grid', gap: 10, maxWidth: 620 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Сотрудник</div>
                  <div style={{ fontWeight: 600 }}>{selectedRow.user}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>График</div>
                  <div style={{ fontWeight: 600 }}>{selectedRow.scheduleName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Утвержден</div>
                  <div style={{ fontWeight: 600 }}>{selectedRow.approved ? 'Да' : 'Нет'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Время запроса</div>
                  <div style={{ fontWeight: 600 }}>{selectedRow.requestedAt}</div>
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--gray-200)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Недельный план сотрудника</div>
              <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 8 }}>
                Текущая неделя: {formatDateLong(weekStartMonday())}
              </div>
              <div style={{
                background: 'var(--gray-50)',
                border: '1px solid var(--gray-200)',
                borderRadius: 8,
                padding: 10,
                fontSize: 13,
                lineHeight: 1.6,
              }}>
                {(selectedRow.daysPlan || []).length === 0 && (
                  <div>Пн-Пт 09:00 - 18:00 (office), Сб-Вс выходной</div>
                )}
                {(selectedRow.daysPlan || []).map((d, idx) => {
                  const label = DAY_NAMES_FULL[(d.dayOfWeek || 1) - 1] || `День ${d.dayOfWeek}`;
                  if (d.isOff) return <div key={idx}>{label}: выходной</div>;
                  return (
                    <div key={idx}>
                      {label}: {d.start} - {d.end} ({d.mode === 'online' ? 'онлайн' : 'офис'})
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'board' && (
        <div className="card">
          <div className="card-header" style={{ alignItems: 'center' }}>
            <span className="card-title">Графики работы: неделя {formatDateLong(boardWeekStart)}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={goPrevBoardWeek}>
                <ChevronLeft size={14} /> Предыдущая неделя
              </button>
              <button className="btn btn-secondary btn-sm" onClick={goNextBoardWeek}>
                Следующая неделя <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(170px, 1fr))',
              borderTop: '1px solid var(--gray-200)',
              overflowX: 'auto',
            }}
          >
            {boardColumns.map((col, idx) => (
              <div
                key={col.name}
                style={{
                  minHeight: 420,
                  borderRight: idx < 6 ? '1px solid var(--gray-200)' : 'none',
                }}
              >
                <div style={{ background: '#0B1C46', color: 'white', padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700 }}>{DAY_NAMES_FULL[idx]}</div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>{col.date}</div>
                </div>
                <div style={{ padding: 8, display: 'grid', gap: 8 }}>
                  {col.entries.length === 0 && (
                    <div style={{ color: 'var(--gray-400)', fontSize: 12 }}>Нет смен</div>
                  )}
                  {col.entries.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        border: '1px solid #BBF7D0',
                        borderRadius: 8,
                        background: '#F0FDF4',
                        padding: '8px 10px',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{entry.user}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                        Время: {entry.from} - {entry.to}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                        Формат: {entry.mode === 'online' ? 'онлайн' : 'офис'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'builder' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Календарь недельного плана</span>
            <button className="btn btn-primary btn-sm" onClick={submitEditorAsRequest}>
              <Plus size={14} /> Создать заявку
            </button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '250px 1fr', marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Начало недели (понедельник)</label>
                <input
                  className="form-input"
                  type="date"
                  value={editorWeekStart}
                  onChange={(e) => setEditorWeekStart(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Сотрудник</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="form-select"
                    value={editorUserId}
                    onChange={(e) => setEditorUserId(e.target.value)}
                  >
                    <option value="">Выберите сотрудника</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!editorUserId}
                    onClick={() => loadUserPlanToEditor(editorUserId)}
                  >
                    Загрузить текущий
                  </button>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 14 }}>
              Всего офис: {editorTotals.offline}ч · Всего онлайн: {editorTotals.online}ч
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
              {DAY_KEYS.slice(0, 5).map((key, idx) => {
                const day = editorPlan[key];
                return (
                  <div key={key} style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{DAY_NAMES_SHORT[idx]} · {DAY_NAMES_FULL[idx]}</div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label className="form-label">Начало</label>
                      <input
                        className="form-input"
                        type="time"
                        value={day.from}
                        disabled={day.mode === 'dayoff'}
                        onChange={(e) => changeEditorDay(key, { from: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label className="form-label">Конец</label>
                      <input
                        className="form-input"
                        type="time"
                        value={day.to}
                        disabled={day.mode === 'dayoff'}
                        onChange={(e) => changeEditorDay(key, { to: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label className="form-label">Формат</label>
                      <select
                        className="form-select"
                        value={day.mode}
                        onChange={(e) => {
                          const mode = e.target.value;
                          if (mode === 'dayoff') {
                            changeEditorDay(key, { mode, from: '', to: '' });
                          } else {
                            changeEditorDay(key, { mode, from: day.from || '09:00', to: day.to || '17:00' });
                          }
                        }}
                      >
                        <option value="office">Офис</option>
                        <option value="online">Онлайн</option>
                        <option value="dayoff">Выходной</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label className="form-label">Комментарий к смене</label>
                      <input
                        className="form-input"
                        value={day.comment}
                        onChange={(e) => changeEditorDay(key, { comment: e.target.value })}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => addBreak(key)}>
                        + Короткий перерыв 15 минут
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => clearBreaks(key)}>
                        Очистить перерывы
                      </button>
                    </div>
                    {day.breaks.map((br, brIdx) => (
                      <div key={`${key}-b-${brIdx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginBottom: 6 }}>
                        <input
                          className="form-input"
                          type="time"
                          value={br.start || ''}
                          onChange={(e) => updateBreak(key, brIdx, 'start', e.target.value)}
                        />
                        <input
                          className="form-input"
                          type="time"
                          value={br.end || ''}
                          onChange={(e) => updateBreak(key, brIdx, 'end', e.target.value)}
                        />
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeBreak(key, brIdx)}>
                          Удалить
                        </button>
                      </div>
                    ))}
                    {!day.breaks.length && (
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Короткие перерывы не добавлены</div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>
                      Часы: {toHours(day.from, day.to)}ч
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 10 }}>
              {DAY_KEYS.slice(5).map((key, i) => {
                const day = editorPlan[key];
                const idx = i + 5;
                return (
                  <div key={key} style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{DAY_NAMES_SHORT[idx]} · {DAY_NAMES_FULL[idx]}</div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label className="form-label">Начало</label>
                      <input
                        className="form-input"
                        type="time"
                        value={day.from}
                        disabled={day.mode === 'dayoff'}
                        onChange={(e) => changeEditorDay(key, { from: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label className="form-label">Конец</label>
                      <input
                        className="form-input"
                        type="time"
                        value={day.to}
                        disabled={day.mode === 'dayoff'}
                        onChange={(e) => changeEditorDay(key, { to: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label className="form-label">Формат</label>
                      <select
                        className="form-select"
                        value={day.mode}
                        onChange={(e) => {
                          const mode = e.target.value;
                          if (mode === 'dayoff') {
                            changeEditorDay(key, { mode, from: '', to: '' });
                          } else {
                            changeEditorDay(key, { mode, from: day.from || '09:00', to: day.to || '17:00' });
                          }
                        }}
                      >
                        <option value="office">Офис</option>
                        <option value="online">Онлайн</option>
                        <option value="dayoff">Выходной</option>
                      </select>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>
                      Часы: {toHours(day.from, day.to)}ч
                    </div>
                  </div>
                );
              })}
            </div>

            {editorMessage && (
              <div
                style={{
                  marginTop: 14,
                  fontSize: 13,
                  border: '1px solid var(--gray-200)',
                  borderRadius: 8,
                  background: 'var(--gray-50)',
                  padding: '10px 12px',
                }}
              >
                {editorMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {!isAdminOrSuper && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-600)' }}>
            <Calendar size={16} />
            Раздел доступен для админа/суперадмина.
          </div>
        </div>
      )}
    </MainLayout>
  );
}
