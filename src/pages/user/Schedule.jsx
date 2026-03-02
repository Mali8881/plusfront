import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, ChevronRight, Clock, Info } from 'lucide-react';
import {
  getUserAttendanceForDate,
  isLateWithoutCheckIn,
  markLateNotified,
  setCheckIn,
  setCheckOut,
  wasLateNotifiedToday,
} from '../../utils/attendance';
import {
  createScheduleRequest,
  getAssignedScheduleForUser,
  hasPendingScheduleRequest,
} from '../../utils/scheduleApproval';
import {
  getCurrentNetworkHint,
  setCurrentNetworkHint,
  verifyOfficeNetworkByIp,
} from '../../utils/officeNetwork';

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const DAY_ROWS = [
  { id: 1, short: 'Пн', full: 'Понедельник' },
  { id: 2, short: 'Вт', full: 'Вторник' },
  { id: 3, short: 'Ср', full: 'Среда' },
  { id: 4, short: 'Чт', full: 'Четверг' },
  { id: 5, short: 'Пт', full: 'Пятница' },
  { id: 6, short: 'Сб', full: 'Суббота' },
  { id: 7, short: 'Вс', full: 'Воскресенье' },
];
const SCHEDULE_OPTIONS = [
  { id: 'std_5_2', name: 'Стандартный 5/2', workDays: 'Понедельник – Пятница', hours: '09:00 – 18:00', lunch: '13:00 – 14:00', breaks: 'По согласованию с руководителем' },
  { id: 'remote_5_2', name: 'Удалённый 5/2', workDays: 'Понедельник – Пятница', hours: '10:00 – 19:00', lunch: '14:00 – 15:00', breaks: 'По согласованию с руководителем' },
  { id: 'shift_2_2', name: 'Сменный 2/2', workDays: 'Скользящий график', hours: '08:00 – 20:00', lunch: '13:00 – 14:00', breaks: '2 перерыва по 15 минут' },
  { id: 'custom_admin', name: 'Индивидуальный по дням', workDays: 'Настраивается по дням недели', hours: 'По дням', lunch: '—', breaks: '—' },
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function makeCustomDay(dayOfWeek, isOff) {
  return {
    dayOfWeek,
    isOff,
    mode: isOff ? 'dayoff' : 'office',
    start: '09:00',
    end: '18:00',
    lunchStart: '13:00',
    lunchEnd: '14:00',
    breaks: [
      { start: '11:00', end: '11:15' },
      { start: '16:00', end: '16:15' },
    ],
  };
}

function formatDaysFromPlan(daysPlan = []) {
  const map = new Map(daysPlan.map(d => [d.dayOfWeek, d]));
  return DAY_ROWS.map(day => {
    const item = map.get(day.id);
    if (!item || item.isOff) return `${day.short}: выходной`;
    return `${day.short}: ${item.start}-${item.end}`;
  }).join(', ');
}

function getSlotByWeekday(schedule, weekdayZeroBased) {
  const dayOfWeek = weekdayZeroBased + 1;
  if (Array.isArray(schedule?.daysPlan) && schedule.daysPlan.length > 0) {
    const item = schedule.daysPlan.find(d => d.dayOfWeek === dayOfWeek);
    if (!item || item.isOff) return { isWork: false, label: 'Вых' };
    return { isWork: true, label: `${item.start?.slice(0, 2)}-${item.end?.slice(0, 2)}` };
  }
  if (dayOfWeek >= 1 && dayOfWeek <= 5) return { isWork: true, label: '09-18' };
  return { isWork: false, label: 'Вых' };
}

export default function Schedule() {
  const { user } = useAuth();
  const today = new Date();
  const todayWeekday = today.getDay() === 0 ? 7 : today.getDay();
  const todayDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedWeekday, setSelectedWeekday] = useState(todayWeekday);
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);
  const [scheduleSection, setScheduleSection] = useState('calendar');
  const [dayMark, setDayMark] = useState(() => getUserAttendanceForDate(user?.id));
  const [lateAlert, setLateAlert] = useState('');
  const [scheduleMsg, setScheduleMsg] = useState('');
  const [hasPendingSchedule, setHasPendingSchedule] = useState(false);
  const [assignedSchedule, setAssignedSchedule] = useState(SCHEDULE_OPTIONS[0]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(SCHEDULE_OPTIONS[0].id);
  const [networkHint, setNetworkHint] = useState(getCurrentNetworkHint());
  const [customSchedule, setCustomSchedule] = useState({
    name: 'Индивидуальный график',
    workDays: 'Понедельник – Пятница',
  });
  const [requestView, setRequestView] = useState('quick');
  const [customDays, setCustomDays] = useState([
    makeCustomDay(1, false),
    makeCustomDay(2, false),
    makeCustomDay(3, false),
    makeCustomDay(4, false),
    makeCustomDay(5, false),
    makeCustomDay(6, true),
    makeCustomDay(7, true),
  ]);

  const canMarkAttendance = user?.role !== 'superadmin';
  const canRequestSchedule = Boolean(user?.id);

  const fmtTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const workStatus = useMemo(() => {
    if (!dayMark?.checkIn) return 'Не отмечен приход';
    if (dayMark?.checkIn && !dayMark?.checkOut) return 'На работе';
    return 'Рабочий день закрыт';
  }, [dayMark]);

  const currentDayMode = useMemo(() => {
    const dayPlan = (assignedSchedule?.daysPlan || []).find((d) => Number(d.dayOfWeek) === Number(todayWeekday));
    if (!dayPlan) return todayWeekday >= 1 && todayWeekday <= 5 ? 'office' : 'dayoff';
    if (dayPlan.isOff) return 'dayoff';
    return dayPlan.mode || 'office';
  }, [assignedSchedule?.daysPlan, todayWeekday]);

  useEffect(() => {
    setDayMark(getUserAttendanceForDate(user?.id));
    if (!user?.id) return;
    const assigned = getAssignedScheduleForUser(user.id);
    if (assigned?.schedule?.id) {
      setAssignedSchedule(assigned.schedule);
      setSelectedScheduleId(assigned.schedule.id);
    } else {
      setAssignedSchedule(SCHEDULE_OPTIONS[0]);
      setSelectedScheduleId('custom_admin');
    }
    setHasPendingSchedule(hasPendingScheduleRequest(user.id));
    if (user?.role !== 'superadmin') {
      setSelectedScheduleId('custom_admin');
    }
  }, [user?.id]);

  useEffect(() => {
    if (!canMarkAttendance || !user?.id) return;
    const tick = () => {
      if (isLateWithoutCheckIn(user.id, '09:00', 20) && !wasLateNotifiedToday(user.id)) {
        markLateNotified(user.id);
        setDayMark(getUserAttendanceForDate(user.id));
        const msg = 'Вы не отметили приход в течение 20 минут после начала рабочего дня.';
        setLateAlert(msg);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Напоминание о посещаемости', { body: msg });
        }
      }
    };
    tick();
    const i = setInterval(tick, 60000);
    return () => clearInterval(i);
  }, [canMarkAttendance, user?.id]);

  useEffect(() => {
    setCurrentNetworkHint(networkHint);
  }, [networkHint]);

  const handleCheckIn = () => {
    if (!user?.id) return;
    let checkMeta = {
      mode: currentDayMode,
      networkInput: networkHint,
      networkVerified: currentDayMode !== 'office',
    };

    if (currentDayMode === 'office') {
      const verify = verifyOfficeNetworkByIp(networkHint);
      if (!verify.ok) {
        setLateAlert('Отметка в режиме "Офис" доступна только из разрешённой офисной сети (Whitelist).');
        return;
      }
      checkMeta = {
        ...checkMeta,
        networkVerified: true,
        networkName: verify.network?.name || '',
        networkCidr: verify.network?.cidr || '',
      };
    }

    const rec = setCheckIn(user.id, new Date().toISOString(), checkMeta);
    setDayMark(rec);
    setLateAlert('');
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  const handleCheckOut = () => {
    if (!user?.id) return;
    let checkMeta = {
      mode: currentDayMode,
      networkInput: networkHint,
      networkVerified: currentDayMode !== 'office',
    };

    if (currentDayMode === 'office') {
      const verify = verifyOfficeNetworkByIp(networkHint);
      if (!verify.ok) {
        setLateAlert('Уход в режиме "Офис" подтверждается только из разрешённой офисной сети (Whitelist).');
        return;
      }
      checkMeta = {
        ...checkMeta,
        networkVerified: true,
        networkName: verify.network?.name || '',
        networkCidr: verify.network?.cidr || '',
      };
    }

    const rec = setCheckOut(user.id, new Date().toISOString(), checkMeta);
    setDayMark(rec);
    setLateAlert('');
  };

  const updateCustomDay = (dayId, patch) => {
    setCustomDays(prev => prev.map(x => (
      x.dayOfWeek === dayId ? { ...x, ...patch } : x
    )));
  };

  const updateCustomBreak = (dayId, breakIndex, patch) => {
    setCustomDays(prev => prev.map(x => {
      if (x.dayOfWeek !== dayId) return x;
      const nextBreaks = (x.breaks || []).map((b, idx) => (
        idx === breakIndex ? { ...b, ...patch } : b
      ));
      return { ...x, breaks: nextBreaks };
    }));
  };

  const addCustomBreak = (dayId) => {
    setCustomDays(prev => prev.map(x => {
      if (x.dayOfWeek !== dayId) return x;
      const breaks = x.breaks || [];
      const last = breaks[breaks.length - 1];
      const start = last?.end || '15:00';
      const [h, m] = start.split(':').map(Number);
      const endMins = h * 60 + m + 15;
      const end = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
      return { ...x, breaks: [...breaks, { start, end }] };
    }));
  };

  const removeCustomBreak = (dayId, breakIndex) => {
    setCustomDays(prev => prev.map(x => {
      if (x.dayOfWeek !== dayId) return x;
      return { ...x, breaks: (x.breaks || []).filter((_, idx) => idx !== breakIndex) };
    }));
  };

  const submitScheduleRequest = () => {
    if (!user?.id || !canRequestSchedule) return;
    if (hasPendingSchedule) {
      setScheduleMsg('У вас уже есть заявка на график на рассмотрении.');
      return;
    }
    let selected = SCHEDULE_OPTIONS.find(s => s.id === selectedScheduleId) || SCHEDULE_OPTIONS[0];
    if (selectedScheduleId === 'custom_admin') {
      const daysPlan = customDays.map(day => ({
        dayOfWeek: day.dayOfWeek,
        isOff: day.isOff,
        mode: day.mode || (day.isOff ? 'dayoff' : 'office'),
        start: day.start,
        end: day.end,
        lunchStart: day.lunchStart,
        lunchEnd: day.lunchEnd,
        breaks: day.breaks || [],
      }));
      const firstWorkDay = daysPlan.find(d => !d.isOff);
      const lunchLabel = firstWorkDay?.lunchStart && firstWorkDay?.lunchEnd
        ? `${firstWorkDay.lunchStart} – ${firstWorkDay.lunchEnd}`
        : '—';
      const breaksLabel = firstWorkDay?.breaks?.length
        ? firstWorkDay.breaks.map(b => `${b.start}-${b.end}`).join(', ')
        : '—';
      selected = {
        id: 'custom_admin',
        name: customSchedule.name || 'Индивидуальный график',
        workDays: formatDaysFromPlan(daysPlan),
        hours: firstWorkDay ? `${firstWorkDay.start || '--:--'} – ${firstWorkDay.end || '--:--'}` : '—',
        lunch: lunchLabel,
        breaks: breaksLabel,
        daysPlan,
      };
    }
    createScheduleRequest({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      schedule: selected,
    });
    setHasPendingSchedule(true);
    setScheduleMsg('Заявка на график отправлена администратору/суперадминистратору.');
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevDays = getDaysInMonth(year, month - 1);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, current: false });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, current: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - firstDay + 1, current: false });

  const isToday = (cell, idx) => cell.current && cell.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <MainLayout title="Мой график">
      <div className="page-header schedule-header">
        <div>
          <div className="page-title">График работы</div>
          <div className="page-subtitle">Производственный календарь и ваше расписание</div>
        </div>
      </div>

      <div className="schedule-tabs">
        <button
          type="button"
          className={`schedule-tab ${scheduleSection === 'calendar' ? 'active' : ''}`}
          onClick={() => setScheduleSection('calendar')}
        >
          Календарь
        </button>
        <button
          type="button"
          className={`schedule-tab ${scheduleSection === 'edit' ? 'active' : ''}`}
          onClick={() => setScheduleSection('edit')}
        >
          Редактирование графика
        </button>
      </div>

      {scheduleSection === 'calendar' && (
      <div className="schedule-layout">
        {/* Calendar */}
        <div className="card schedule-main-card">
          <div className="card-body">
            <div className="schedule-calendar-head">
              <h3 className="schedule-month-title">{MONTHS[month]} {year}</h3>
              <div className="schedule-month-nav">
                <button className="btn btn-icon" onClick={prevMonth}><ChevronLeft size={16} /></button>
                <button className="btn btn-icon" onClick={nextMonth}><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="cal-grid">
              {DAYS.map(d => <div key={d} className="cal-day-label" style={{ color: d === 'Сб' || d === 'Вс' ? 'var(--danger)' : undefined }}>{d}</div>)}
              {cells.map((cell, idx) => {
                const slot = getSlotByWeekday(assignedSchedule, idx % 7);
                const weekend = !slot.isWork;
                const todayCell = isToday(cell, idx);
                const weekdayId = (idx % 7) + 1;
                const cellDateKey = cell.current
                  ? `${year}-${String(month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
                  : '';
                const selectedDateCell = cell.current && cellDateKey === selectedDateKey;
                return (
                  <div
                    key={idx}
                    className={`cal-cell ${!cell.current ? 'other-month' : ''} ${todayCell ? 'today' : ''}`}
                    onClick={() => {
                      if (!cell.current) return;
                      setSelectedDateKey(cellDateKey);
                      setSelectedWeekday(weekdayId);
                    }}
                    style={{
                      cursor: cell.current ? 'pointer' : 'default',
                      boxShadow: selectedDateCell ? 'inset 0 0 0 2px var(--primary)' : undefined,
                    }}
                  >
                    <div className={`cal-date ${weekend && cell.current ? 'cal-cell weekend' : ''}`}
                      style={{ color: !cell.current ? 'var(--gray-300)' : undefined }}>
                      {todayCell
                        ? <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{cell.day}</div>
                        : <span style={{ color: weekend && cell.current ? 'var(--danger)' : !cell.current ? 'var(--gray-300)' : 'var(--gray-700)', fontWeight: 500 }}>{cell.day}</span>
                      }
                    </div>
                    {cell.current && slot.isWork && (
                      <div className="work-cell">{slot.label}</div>
                    )}
                    {cell.current && !slot.isWork && (
                      <div className="work-cell off">Вых</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Schedule info */}
        <div className="schedule-side-stack">
          {canMarkAttendance && (
            <div className="card schedule-side-card">
              <div className="card-body">
                <div className="schedule-side-title-row">
                  <span className="schedule-side-title">Отметка рабочего дня</span>
                  <span className="badge badge-blue">{workStatus}</span>
                </div>
                <div className="schedule-side-meta">
                  Приход: <b>{fmtTime(dayMark?.checkIn)}</b> · Уход: <b>{fmtTime(dayMark?.checkOut)}</b>
                </div>
                <div className="schedule-side-meta">
                  Режим дня: <b>{currentDayMode === 'office' ? 'Офис' : currentDayMode === 'online' ? 'Онлайн' : 'Выходной'}</b>
                </div>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">IP сети для проверки (демо)</label>
                  <input
                    className="form-input"
                    placeholder="192.168.1.10"
                    value={networkHint}
                    onChange={(e) => setNetworkHint(e.target.value)}
                  />
                </div>
                {dayMark?.checkMeta?.networkVerified && dayMark?.checkMeta?.networkName && (
                  <div style={{ fontSize: 12, color: '#065F46', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                    Сеть подтверждена: {dayMark.checkMeta.networkName} ({dayMark.checkMeta.networkCidr})
                  </div>
                )}
                {lateAlert && (
                  <div style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                    {lateAlert}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" disabled={Boolean(dayMark?.checkIn)} onClick={handleCheckIn}>
                    Отметить приход
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={!dayMark?.checkIn || Boolean(dayMark?.checkOut)} onClick={handleCheckOut}>
                    Отметить уход
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card schedule-side-card">
            <div className="card-body">
              <div className="schedule-side-title-row" style={{ justifyContent: 'flex-start' }}>
                <Clock size={16} color="var(--primary)" />
                <span className="schedule-side-title">Мой текущий график</span>
              </div>
              <p className="schedule-side-text">
                Здесь отображается твой согласованный с руководителем график работы. Если график изменится, он автоматически обновится в этом блоке.
              </p>
                {[
                  { label: 'Название графика', value: assignedSchedule.name },
                  { label: 'Рабочие дни', value: assignedSchedule.workDays || 'По дням недели' },
                  { label: 'Время работы', value: assignedSchedule.hours },
                  { label: 'Обеденный перерыв', value: assignedSchedule.lunch },
                  { label: 'Короткие перерывы', value: assignedSchedule.breaks },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-900)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card schedule-side-card">
            <div className="card-body">
              <div className="schedule-side-title-row" style={{ justifyContent: 'flex-start' }}>
                <Info size={16} color="var(--gray-500)" />
                <span className="schedule-side-title">Обозначения</span>
              </div>
              {[
                { color: '#D1FAE5', border: '#6EE7B7', label: 'Рабочий день' },
                { color: '#FEE2E2', border: '#FCA5A5', label: 'Выходной / Праздник' },
                { color: 'var(--primary)', border: 'var(--primary)', label: 'Текущий день', text: 'white' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: item.color, border: `1px solid ${item.border}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {scheduleSection === 'edit' && canRequestSchedule && (
        <div className="card">
          <div className="card-body">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Редактирование графика работы</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                className={`btn btn-sm ${requestView === 'quick' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setRequestView('quick')}
              >
                Быстро
              </button>
              <button
                type="button"
                className={`btn btn-sm ${requestView === 'planner' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setRequestView('planner')}
              >
                Конструктор
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 10 }}>
              Индивидуальный график доступен всем сотрудникам: настройте расписание по дням и отправьте на одобрение.
            </div>
            {selectedScheduleId === 'custom_admin' && (
              <>
                <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 10 }}>
                  Соберите свой индивидуальный график по дням и отправьте его администратору/суперадминистратору на одобрение.
                </div>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Название графика</label>
                  <input
                    className="form-input"
                    value={customSchedule.name}
                    onChange={e => setCustomSchedule(s => ({ ...s, name: e.target.value }))}
                    disabled={hasPendingSchedule}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Описание графика</label>
                  <input
                    className="form-input"
                    value={customSchedule.workDays}
                    onChange={e => setCustomSchedule(s => ({ ...s, workDays: e.target.value }))}
                    disabled={hasPendingSchedule}
                    placeholder="Например: Пн-Сб"
                  />
                </div>
                {requestView === 'quick' && (
                  <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--gray-600)' }}>
                    Быстрый режим: заполни название/описание и отправь. Для детальной настройки по каждому дню открой вкладку «Конструктор».
                  </div>
                )}
                {requestView === 'planner' && (
                  <div style={{ marginBottom: 10 }}>
                    <div className="form-label" style={{ marginBottom: 8 }}>Мой недельный план</div>
                    <div className="schedule-editor-days">
                      {DAY_ROWS.map((day) => {
                        const dayRow = customDays.find((d) => d.dayOfWeek === day.id);
                        const isWork = dayRow && !dayRow.isOff;
                        return (
                          <button
                            key={day.id}
                            type="button"
                            className={`schedule-editor-day-btn ${selectedWeekday === day.id ? 'active' : ''}`}
                            onClick={() => setSelectedWeekday(day.id)}
                          >
                            <span>{day.short}</span>
                            <span style={{ fontSize: 10, opacity: 0.75 }}>{isWork ? 'Рабочий' : 'Выходной'}</span>
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const activeDay = DAY_ROWS.find((d) => d.id === selectedWeekday) || DAY_ROWS[0];
                      const row = customDays.find((d) => d.dayOfWeek === activeDay.id) || customDays[0];
                      if (!row) return null;
                      return (
                        <div className="schedule-editor-card">
                          <div className="schedule-editor-card-head">
                            <div style={{ fontWeight: 800, fontSize: 18 }}>{activeDay.full}</div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                              <input
                                type="checkbox"
                                checked={!row.isOff}
                                disabled={hasPendingSchedule}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  updateCustomDay(activeDay.id, {
                                    isOff: !checked,
                                    mode: checked ? 'office' : 'dayoff',
                                  });
                                }}
                              />
                              Рабочий день
                            </label>
                          </div>

                          <div className="schedule-editor-grid">
                            <div>
                              <label className="form-label" style={{ fontSize: 11 }}>Начало</label>
                              <input
                                className="form-input"
                                type="time"
                                value={row.start}
                                disabled={hasPendingSchedule || row.isOff}
                                onChange={e => updateCustomDay(activeDay.id, { start: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: 11 }}>Конец</label>
                              <input
                                className="form-input"
                                type="time"
                                value={row.end}
                                disabled={hasPendingSchedule || row.isOff}
                                onChange={e => updateCustomDay(activeDay.id, { end: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Формат</label>
                            <select
                              className="form-select"
                              value={row.mode || (row.isOff ? 'dayoff' : 'office')}
                              disabled={hasPendingSchedule}
                              onChange={e => {
                                const mode = e.target.value;
                                updateCustomDay(activeDay.id, { mode, isOff: mode === 'dayoff' });
                              }}
                            >
                              <option value="office">Офис</option>
                              <option value="online">Онлайн</option>
                              <option value="dayoff">Выходной</option>
                            </select>
                          </div>

                          <div className="schedule-editor-grid">
                            <div>
                              <label className="form-label" style={{ fontSize: 11 }}>Обед с</label>
                              <input
                                className="form-input"
                                type="time"
                                value={row.lunchStart || ''}
                                disabled={hasPendingSchedule || row.isOff}
                                onChange={e => updateCustomDay(activeDay.id, { lunchStart: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: 11 }}>Обед до</label>
                              <input
                                className="form-input"
                                type="time"
                                value={row.lunchEnd || ''}
                                disabled={hasPendingSchedule || row.isOff}
                                onChange={e => updateCustomDay(activeDay.id, { lunchEnd: e.target.value })}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>Короткие перерывы</div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={hasPendingSchedule || row.isOff}
                              onClick={() => addCustomBreak(activeDay.id)}
                            >
                              + 15 мин
                            </button>
                          </div>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {(row.breaks || []).map((br, idx) => (
                              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
                                <input
                                  className="form-input"
                                  type="time"
                                  value={br.start}
                                  disabled={hasPendingSchedule || row.isOff}
                                  onChange={e => updateCustomBreak(activeDay.id, idx, { start: e.target.value })}
                                />
                                <input
                                  className="form-input"
                                  type="time"
                                  value={br.end}
                                  disabled={hasPendingSchedule || row.isOff}
                                  onChange={e => updateCustomBreak(activeDay.id, idx, { end: e.target.value })}
                                />
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled={hasPendingSchedule || row.isOff}
                                  onClick={() => removeCustomBreak(activeDay.id, idx)}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {(!row.breaks || row.breaks.length === 0) && (
                              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Нет коротких перерывов</div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>
                  Обед и короткие перерывы будут автоматически вычитаться из рабочего времени при расчете.
                </div>
              </>
            )}
            {hasPendingSchedule && (
              <div style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                Заявка уже отправлена и ожидает решения администратора/суперадмина.
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={submitScheduleRequest} disabled={hasPendingSchedule}>
              Отправить запрос
            </button>
            {scheduleMsg && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray-500)' }}>{scheduleMsg}</div>}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
