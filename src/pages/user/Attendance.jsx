import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { attendanceAPI } from '../../api/content';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';

function monthOptions(locale, count = 18) {
  const now = new Date();
  const opts = [];
  const localeCode = locale === 'en' ? 'en-US' : locale === 'kg' ? 'ky-KG' : 'ru-RU';
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(localeCode, { month: 'long', year: 'numeric' }),
    });
  }
  return opts;
}

function normalizeDateKey(raw) {
  if (!raw) return '';
  const value = String(raw).slice(0, 10);
  const m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return value;
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}

function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(isoDate, locale) {
  if (!isoDate) return '—';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  const localeCode = locale === 'en' ? 'en-US' : locale === 'kg' ? 'ky-KG' : 'ru-RU';
  return d.toLocaleDateString(localeCode, { day: '2-digit', month: 'long', year: 'numeric', weekday: 'short' });
}

function formatTime(value, locale) {
  if (!value) return '—';
  const s = String(value);
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  const localeCode = locale === 'en' ? 'en-US' : locale === 'kg' ? 'ky-KG' : 'ru-RU';
  return d.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' });
}

function statusView(mark) {
  if (!mark) return { key: 'unmarked', cls: 'badge-gray' };

  const status = String(mark.status || '').toLowerCase();
  if (status === 'present') return { key: 'present', cls: 'badge-green' };
  if (status === 'remote') return { key: 'remote', cls: 'badge-blue' };
  if (status === 'vacation') return { key: 'vacation', cls: 'badge-purple' };
  if (status === 'sick') return { key: 'sick', cls: 'badge-yellow' };
  if (status === 'business_trip') return { key: 'business_trip', cls: 'badge-blue' };
  if (status === 'absent') return { key: 'absent', cls: 'badge-red' };
  return { key: status || 'marked', cls: 'badge-gray' };
}

function getMarkForDate(row, selectedDate) {
  if (!row || !selectedDate) return null;
  const key = normalizeDateKey(selectedDate);

  const marksObject = row.marks || row.attendance || row.status_by_date;
  if (marksObject && !Array.isArray(marksObject) && typeof marksObject === 'object') {
    if (marksObject[key]) return marksObject[key];
    const altKey = Object.keys(marksObject).find((k) => normalizeDateKey(k) === key);
    if (altKey) return marksObject[altKey];
  }

  const marksList = Array.isArray(row.marks)
    ? row.marks
    : Array.isArray(row.attendance)
      ? row.attendance
      : Array.isArray(row.records)
        ? row.records
        : [];

  if (marksList.length) {
    const found = marksList.find((it) => normalizeDateKey(it?.date || it?.day || it?.created_at) === key);
    if (found) return found;
  }

  return null;
}

function normalizePayloadToRows(payload) {
  if (payload && !Array.isArray(payload)) {
    const days = Array.isArray(payload.days) ? payload.days : [];
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    if (rows.length || days.length) {
      const normalizedRows = rows.map((row) => ({
        ...row,
        user_id: row.user_id ?? row.user ?? row.id,
        full_name: row.full_name || row.name || row.username || '',
        position: row.position || row.position_name || row.job_title || '',
        department: row.department || row.department_name || '',
      }));
      return {
        days: days.map((d) => normalizeDateKey(d)).filter(Boolean),
        rows: normalizedRows,
      };
    }
  }

  const records = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.records)
      ? payload.records
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  if (!records.length) return { days: [], rows: [] };

  const daysSet = new Set();
  const users = new Map();
  records.forEach((rec) => {
    const userId = rec?.user_id ?? rec?.user ?? rec?.employee_id;
    if (userId == null) return;

    const d = normalizeDateKey(rec?.date || rec?.day || rec?.created_at);
    if (d) daysSet.add(d);

    if (!users.has(userId)) {
      users.set(userId, {
        user_id: userId,
        username: rec?.username || '',
        full_name: rec?.full_name || rec?.employee_name || rec?.name || '',
        position: rec?.position || rec?.job_title || '',
        department: rec?.department || rec?.department_name || '',
        marks: {},
      });
    }

    if (d) {
      users.get(userId).marks[d] = {
        status: rec?.status,
        comment: rec?.comment || rec?.note || '',
        check_in: rec?.check_in || rec?.start_time || rec?.arrived_at || null,
        check_out: rec?.check_out || rec?.end_time || rec?.left_at || null,
      };
    }
  });

  const days = Array.from(daysSet).sort();
  const rows = Array.from(users.values());
  return { days, rows };
}

export default function Attendance() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const options = useMemo(() => monthOptions(locale, 18), [locale]);

  const [period, setPeriod] = useState({ year: options[0].year, month: options[0].month });
  const [days, setDays] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('name_asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const noticeTimerRef = useRef(null);

  const statusLabel = useCallback(
    (key) => {
      const map = {
        all: t('attendance.status.all', 'Все статусы'),
        unmarked: t('attendance.status.unmarked', 'Не отмечен'),
        present: t('attendance.status.present', 'В офисе'),
        remote: t('attendance.status.remote', 'Онлайн'),
        business_trip: t('attendance.status.business_trip', 'Командировка'),
        vacation: t('attendance.status.vacation', 'Отпуск'),
        sick: t('attendance.status.sick', 'Больничный'),
        absent: t('attendance.status.absent', 'Отсутствует'),
        marked: t('attendance.status.marked', 'Отмечен'),
      };
      return map[key] || key;
    },
    [t]
  );

  const showNotice = useCallback((type, text) => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    setNotice({ type, text });
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
    }, 2800);
  }, []);

  const load = useCallback(async (trigger = 'auto') => {
    setLoading(true);
    setError('');

    try {
      const params = { year: period.year, month: period.month };
      const res = await attendanceAPI.overview(params);
      const payload = res?.data;

      const normalized = normalizePayloadToRows(payload || {});
      const nextDays = normalized.days;
      const nextRows = normalized.rows;

      setDays(nextDays);
      setRows(nextRows);

      const today = localDateKey();
      setSelectedDate((prev) => {
        if (prev && nextDays.includes(prev)) return prev;
        if (nextDays.includes(today)) return today;
        return nextDays[0] || '';
      });

      if (trigger === 'manual') {
        showNotice('success', t('attendance.notice.updated', 'Посещаемость обновлена'));
      }
    } catch (err) {
      setDays([]);
      setRows([]);
      const message = err?.response?.data?.detail || t('attendance.error.load', 'Не удалось загрузить посещаемость');
      setError(message);
      showNotice('error', message);
    } finally {
      setLoading(false);
    }
  }, [period.year, period.month, showNotice, t, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
  }, []);

  const preparedRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = rows
      .map((row) => {
        const mark = getMarkForDate(row, selectedDate);
        const view = statusView(mark);
        return { row, mark, view };
      })
      .filter(({ row, view }) => {
        const matchesQuery =
          !q ||
          String(row.full_name || row.username || '').toLowerCase().includes(q) ||
          String(row.position || '').toLowerCase().includes(q) ||
          String(row.department || '').toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'all' || view.key === statusFilter;
        return matchesQuery && matchesStatus;
      });

    list.sort((a, b) => {
      if (sort === 'name_desc') {
        return String(b.row.full_name || b.row.username || '').localeCompare(String(a.row.full_name || a.row.username || ''), locale === 'en' ? 'en' : 'ru');
      }
      if (sort === 'marked_first') {
        const am = a.mark ? 1 : 0;
        const bm = b.mark ? 1 : 0;
        return bm - am;
      }
      return String(a.row.full_name || a.row.username || '').localeCompare(String(b.row.full_name || b.row.username || ''), locale === 'en' ? 'en' : 'ru');
    });

    return list;
  }, [rows, selectedDate, query, statusFilter, sort, locale]);

  const summary = useMemo(() => {
    let marked = 0;
    let unmarked = 0;

    rows.forEach((row) => {
      const mark = getMarkForDate(row, selectedDate);
      if (mark) marked += 1;
      else unmarked += 1;
    });

    const total = rows.length;
    const markedRate = total ? Math.round((marked / total) * 100) : 0;
    return { marked, unmarked, total, markedRate };
  }, [rows, selectedDate]);

  return (
    <MainLayout title={t('attendance.title', 'Посещаемость')}>
      <div className="page-header">
        <div>
          <div className="page-title">{t('attendance.title', 'Посещаемость')}</div>
          <div className="page-subtitle">{t('attendance.subtitle', 'Кто отметил рабочий день, а кто нет')}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: 12 }}>
        <select
          className="form-select"
          value={`${period.year}-${String(period.month).padStart(2, '0')}`}
          onChange={(e) => {
            const [year, month] = e.target.value.split('-').map(Number);
            setPeriod({ year, month });
          }}
        >
          {options.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>

        <select className="form-select" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} disabled={!days.length}>
          {days.map((d) => (
            <option key={d} value={d}>
              {formatDateLabel(d, locale)}
            </option>
          ))}
        </select>

        <input
          className="form-input"
          placeholder={t('attendance.search.placeholder', 'Поиск: сотрудник, должность, отдел')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{statusLabel('all')}</option>
          <option value="unmarked">{statusLabel('unmarked')}</option>
          <option value="present">{statusLabel('present')}</option>
          <option value="remote">{statusLabel('remote')}</option>
          <option value="business_trip">{statusLabel('business_trip')}</option>
          <option value="vacation">{statusLabel('vacation')}</option>
          <option value="sick">{statusLabel('sick')}</option>
          <option value="absent">{statusLabel('absent')}</option>
        </select>

        <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="name_asc">{t('attendance.sort.name_asc', 'Сортировка: ФИО А-Я')}</option>
          <option value="name_desc">{t('attendance.sort.name_desc', 'Сортировка: ФИО Я-А')}</option>
          <option value="marked_first">{t('attendance.sort.marked_first', 'Сортировка: отмеченные сверху')}</option>
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => load('manual')}
          disabled={loading}
        >
          {loading ? t('attendance.btn.refreshing', 'Обновление...') : t('attendance.btn.refresh', 'Обновить')}
        </button>
      </div>

      {notice && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            color: notice.type === 'error' ? '#991B1B' : '#166534',
            background: notice.type === 'error' ? '#FEE2E2' : '#DCFCE7',
            border: `1px solid ${notice.type === 'error' ? '#FCA5A5' : '#86EFAC'}`,
          }}
        >
          {notice.text}
        </div>
      )}

      {error && !notice && <div style={{ marginBottom: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div className="card"><div className="card-body"><div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('attendance.metrics.total', 'Всего')}</div><div style={{ fontSize: 26, fontWeight: 800 }}>{summary.total}</div></div></div>
        <div className="card"><div className="card-body"><div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('attendance.metrics.marked', 'Отметились')}</div><div style={{ fontSize: 26, fontWeight: 800, color: '#16A34A' }}>{summary.marked}</div></div></div>
        <div className="card"><div className="card-body"><div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('attendance.metrics.unmarked', 'Не отметились')}</div><div style={{ fontSize: 26, fontWeight: 800, color: '#DC2626' }}>{summary.unmarked}</div></div></div>
        <div className="card"><div className="card-body"><div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('attendance.metrics.discipline', 'Дисциплина')}</div><div style={{ fontSize: 26, fontWeight: 800 }}>{summary.markedRate}%</div></div></div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span className="card-title">{t('attendance.table.title_on_date', 'Статус на дату')} {selectedDate ? formatDateLabel(selectedDate, locale) : '—'}</span>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('attendance.table.shown', 'Показано')}: {preparedRows.length}</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('attendance.table.employee', 'Сотрудник')}</th>
                <th>{t('attendance.table.department', 'Отдел')}</th>
                <th>{t('attendance.table.position', 'Должность')}</th>
                <th>{t('attendance.table.status', 'Статус')}</th>
                <th>{t('attendance.table.check_in', 'Приход')}</th>
                <th>{t('attendance.table.check_out', 'Уход')}</th>
                <th>{t('attendance.table.comment', 'Комментарий')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--gray-500)' }}>
                    {t('common.loading', 'Загрузка...')}
                  </td>
                </tr>
              )}

              {!loading && preparedRows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--gray-500)' }}>
                    {t('attendance.table.empty_filtered', 'По выбранным фильтрам данных нет')}
                  </td>
                </tr>
              )}

              {!loading && preparedRows.map(({ row, mark, view }) => (
                <tr key={`att-row-${row.user_id}`}>
                  <td>{row.full_name || row.username || `#${row.user_id}`}</td>
                  <td>{row.department || '—'}</td>
                  <td>{row.position || '—'}</td>
                  <td><span className={`badge ${view.cls}`}>{statusLabel(view.key)}</span></td>
                  <td>{formatTime(mark?.check_in || mark?.checkin || mark?.arrived_at, locale)}</td>
                  <td>{formatTime(mark?.check_out || mark?.checkout || mark?.left_at, locale)}</td>
                  <td>{mark?.comment || mark?.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
