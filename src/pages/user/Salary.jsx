import { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { payrollAPI } from '../../api/payroll';
import { normalizeRole } from '../../utils/roles';

const MY_ALLOWED_ROLES = new Set(['superadmin', 'administrator', 'admin', 'employee']);
const ADMIN_ALLOWED_ROLES = new Set(['superadmin', 'administrator', 'admin']);
const PAYOUT_STATUSES = ['CALCULATED', 'PAID', 'DELAYED'];
const PAY_MODEL_OPTIONS = [
  { value: 'fixed_salary', label: 'Оклад' },
  { value: 'hourly', label: 'Почасовая' },
  { value: 'minute', label: 'Поминутная' },
];

const STATUS_UI = {
  CALCULATED: { label: 'Рассчитано', badge: 'badge-yellow', color: '#D97706' },
  PAID: { label: 'Выплачено', badge: 'badge-green', color: '#16A34A' },
  DELAYED: { label: 'Задержка', badge: 'badge-red', color: '#EF4444' },
};

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function fmtMoney(value) {
  return `${Number(value || 0).toLocaleString('ru-RU')} KGS`;
}

function monthOptions(count = 12) {
  const now = new Date();
  const opts = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    });
  }
  return opts;
}

function normalizeStatus(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID') return 'PAID';
  if (s === 'DELAYED') return 'DELAYED';
  return 'CALCULATED';
}

function pickFirst(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function pickNumber(...values) {
  const v = pickFirst(...values);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMyPayroll(raw = {}) {
  const userObj = raw.user && typeof raw.user === 'object' ? raw.user : null;
  return {
    id: pickFirst(raw.id, raw.record_id),
    user: pickFirst(raw.user, raw.user_id, userObj?.id),
    username: pickFirst(raw.username, raw.full_name, raw.user_name, userObj?.username, userObj?.full_name, ''),
    month: pickFirst(raw.month, raw.period, raw.salary_month, ''),
    totalHours: pickNumber(raw.total_hours, raw.hours, raw.worked_hours, raw.norm_hours),
    totalSalary: pickNumber(raw.total_salary, raw.salary, raw.accrued, raw.amount, raw.payroll_amount),
    bonus: pickNumber(raw.bonus, raw.premium, raw.premia),
    status: normalizeStatus(pickFirst(raw.status, raw.payout_status, raw.payment_status)),
    calculatedAt: pickFirst(raw.calculated_at, raw.updated_at, raw.created_at),
    paidAt: pickFirst(raw.paid_at, raw.payment_date),
  };
}

function normalizeAdminRecord(raw = {}) {
  const userObj = raw.user && typeof raw.user === 'object' ? raw.user : null;
  const userId = pickFirst(raw.user_id, raw.employee_id, raw.user, userObj?.id, raw.id);
  const username = pickFirst(
    raw.username,
    raw.full_name,
    raw.user_name,
    raw.employee_name,
    userObj?.username,
    userObj?.full_name,
    `Пользователь #${userId || '?'}`
  );
  return {
    recordId: pickFirst(raw.id, raw.record_id, raw.payroll_id, `${userId}-${pickFirst(raw.month, raw.period, '')}`),
    userId,
    username,
    totalHours: pickNumber(raw.total_hours, raw.hours, raw.worked_hours, raw.norm_hours),
    totalSalary: pickNumber(raw.total_salary, raw.salary, raw.accrued, raw.amount, raw.payroll_amount),
    bonus: pickNumber(raw.bonus, raw.premium, raw.premia),
    payType: String(raw.pay_type || '').toLowerCase().replace('fixed', 'fixed_salary'),
    hourlyRate: pickNumber(raw.hourly_rate),
    minuteRate: pickNumber(raw.minute_rate),
    fixedSalary: pickNumber(raw.fixed_salary),
    status: normalizeStatus(pickFirst(raw.status, raw.payout_status, raw.payment_status)),
    month: pickFirst(raw.month, raw.period, raw.salary_month),
    calculatedAt: pickFirst(raw.calculated_at, raw.updated_at, raw.created_at),
    paidAt: pickFirst(raw.paid_at, raw.payment_date),
  };
}

function normalizeCompRow(raw = {}) {
  const payTypeRaw = String(raw.pay_type || raw.pay_model || raw.model || 'hourly').toLowerCase();
  const payType = payTypeRaw === 'fixed' ? 'fixed_salary' : payTypeRaw;
  return {
    userId: raw.user || raw.user_id || raw.id,
    username: raw.username || raw.full_name || raw.user_name || raw.name || `Пользователь #${raw.user || raw.id}`,
    payModel: payType,
    hourlyRate: Number(raw.hourly_rate || 0),
    minuteRate: Number(raw.minute_rate || 0),
    fixedSalary: Number(raw.fixed_salary || 0),
  };
}

function payModelLabel(payModel) {
  const key = String(payModel || '').toLowerCase();
  const option = PAY_MODEL_OPTIONS.find((o) => o.value === key);
  return option ? option.label : key || '—';
}

function statusLabel(status) {
  return (STATUS_UI[normalizeStatus(status)] || STATUS_UI.CALCULATED).label;
}

function compensationValueLabel(row) {
  const model = String(row?.payModel || '').toLowerCase();
  if (model === 'fixed_salary') return `${Number(row?.fixedSalary || 0).toLocaleString('ru-RU')} KGS (оклад)`;
  if (model === 'hourly') return `${Number(row?.hourlyRate || 0).toLocaleString('ru-RU')} KGS/час`;
  if (model === 'minute') return `${Number(row?.minuteRate || 0).toLocaleString('ru-RU')} KGS/минута`;
  return '—';
}

function almostEq(a, b) {
  const x = Number(a || 0);
  const y = Number(b || 0);
  return Math.abs(x - y) < 0.0001;
}

function formatApiError(err, fallback) {
  const data = err?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const parts = Object.entries(data).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join(', ')}`;
      return `${k}: ${String(v)}`;
    });
    if (parts.length > 0) return parts.join(' | ');
  }
  return fallback;
}

function findMyRecord(payload) {
  const list = safeList(payload);
  if (list.length > 0) return normalizeMyPayroll(list[0]);
  return normalizeMyPayroll(payload || {});
}

function getSummaryFund(summary) {
  if (!summary) return 0;
  return pickNumber(
    summary.payroll_fund,
    summary.total_fund,
    summary.total,
    summary.total_salary,
    summary.accrued_total,
    summary.fund,
    summary?.data?.payroll_fund,
    summary?.data?.total_fund,
    summary?.results?.payroll_fund
  );
}

function toYyyyMm(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtPayrollMonth(value) {
  if (!value) return '—';
  const raw = String(value);
  const withYearSuffix = (text) => {
    const normalized = String(text || '').trim();
    if (!normalized) return '—';
    return /г\.?$/iu.test(normalized) ? normalized : `${normalized} г.`;
  };
  const match = raw.match(/^(\d{4})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const d = new Date(year, month - 1, 1);
    if (!Number.isNaN(d.getTime())) {
      const formatted = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      return withYearSuffix(`${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`);
    }
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const formatted = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    return withYearSuffix(`${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`);
  }
  return withYearSuffix(raw);
}

function payoutStatusText(data) {
  if (data.paidAt) return 'Выплачено';
  if (normalizeStatus(data.status) === 'DELAYED') return 'Задержка';
  return 'Ожидает выплату';
}

function MetricCard({ title, value, hint, accent = '#2563EB' }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="card-body">
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15 }}>{value}</div>
        {hint ? <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray-500)' }}>{hint}</div> : null}
      </div>
    </div>
  );
}

function MySalaryBlock({ data, loading }) {
  const statusUi = STATUS_UI[data.status] || STATUS_UI.CALCULATED;
  const isZeroPayroll = Number(data.totalSalary || 0) === 0 && Number(data.totalHours || 0) === 0;
  const payoutTotal = Number(data.totalSalary || 0) + Number(data.bonus || 0);
  const payoutText = payoutStatusText(data);
  const statusColor = payoutText === 'Выплачено' ? '#16A34A' : payoutText === 'Задержка' ? '#EF4444' : '#D97706';

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(190px,1fr))', gap: 12, marginBottom: 20 }}>
        <MetricCard
          title="К выплате"
          value={loading ? '...' : fmtMoney(payoutTotal)}
          hint={`Период: ${fmtPayrollMonth(data.month)}`}
          accent="#16A34A"
        />
        <MetricCard
          title="Начисление"
          value={loading ? '...' : fmtMoney(data.totalSalary)}
          hint="Базовая сумма без премии"
          accent="#2563EB"
        />
        <MetricCard
          title="Премия"
          value={loading ? '...' : fmtMoney(data.bonus)}
          hint="Дополнительные начисления"
          accent="#F59E0B"
        />
        <MetricCard
          title="Норма / Отработано"
          value={loading ? '...' : `${Number(data.totalHours || 0)} ч`}
          hint="Часы за выбранный месяц"
          accent="#7C3AED"
        />
      </div>

      {!loading && isZeroPayroll && (
        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            border: '1px solid var(--gray-200)',
            background: 'var(--gray-50)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--gray-600)',
          }}
        >
          За выбранный период данных для начисления пока нет.
        </div>
      )}

      <div className="card">
        <div className="card-header"><span className="card-title">Информация о расчете</span></div>
        <div className="card-body" style={{ display: 'grid', gap: 10, fontSize: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 8 }}>
            <div>Сотрудник: <b>{data.username || '—'}</b></div>
            <div>Период: <b>{fmtPayrollMonth(data.month)}</b></div>
            <div>Начисление: <b>{fmtMoney(data.totalSalary)}</b></div>
            <div>Премия: <b>{fmtMoney(data.bonus)}</b></div>
            <div>К выплате: <b>{fmtMoney(payoutTotal)}</b></div>
            <div>Отработано часов: <b>{Number(data.totalHours || 0)} ч</b></div>
            <div>Статус записи: <b>{statusUi.label}</b></div>
          </div>
          <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 10, display: 'grid', gap: 6 }}>
            <div>Расчет выполнен: <b>{fmtDateTime(data.calculatedAt)}</b></div>
            <div>Статус выплаты: <b style={{ color: statusColor }}>{payoutText}</b></div>
            {data.paidAt && <div>Дата выплаты: <b>{fmtDateTime(data.paidAt)}</b></div>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Salary() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const currentUserId = String(user?.id || '');

  const canViewMySalary = MY_ALLOWED_ROLES.has(role);
  const canManagePayroll = ADMIN_ALLOWED_ROLES.has(role);

  const periodOptions = useMemo(() => monthOptions(12), []);
  const [period, setPeriod] = useState(() => ({ year: periodOptions[0].year, month: periodOptions[0].month }));
  const [view, setView] = useState('my');

  const [myData, setMyData] = useState({
    id: null,
    user: null,
    username: '',
    month: '',
    totalHours: 0,
    totalSalary: 0,
    bonus: 0,
    status: 'CALCULATED',
    calculatedAt: null,
    paidAt: null,
  });
  const [myLoading, setMyLoading] = useState(true);

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [compensationRows, setCompensationRows] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [popup, setPopup] = useState('');
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState(false);
  const [modalMode, setModalMode] = useState('edit');
  const [selectedComp, setSelectedComp] = useState(null);
  const [form, setForm] = useState({ userId: '', payModel: 'hourly', hourlyRate: '', minuteRate: '', fixedSalary: '' });
  const [newlyAddedCompUserIds, setNewlyAddedCompUserIds] = useState([]);
  const [rowDrafts, setRowDrafts] = useState({});

  const orderCompRows = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    if (newlyAddedCompUserIds.length === 0) return rows;

    const pinned = new Set(newlyAddedCompUserIds.map((id) => String(id)));
    const regular = [];
    const added = [];
    rows.forEach((row) => {
      if (pinned.has(String(row.userId))) added.push(row);
      else regular.push(row);
    });
    return [...regular, ...added];
  };

  const reloadTeamData = async ({ includeComp = true } = {}) => {
    const requests = [
      payrollAPI.adminList(period.year, period.month),
      payrollAPI.adminSummary(period.year, period.month),
    ];
    if (includeComp) requests.push(payrollAPI.compensationList());

    const [listRes, summaryRes, compRes] = await Promise.all(requests);
    setRecords(safeList(listRes.data).map(normalizeAdminRecord));
    setSummary(summaryRes.data || null);
    if (includeComp && compRes) {
      const mapped = safeList(compRes.data).map(normalizeCompRow);
      setCompensationRows(orderCompRows(mapped));
    }
  };

  useEffect(() => {
    if (!canViewMySalary) {
      setMyLoading(false);
      return;
    }

    let mounted = true;

    const loadMy = async () => {
      setMyLoading(true);
      setError('');
      setSuccess('');
      try {
        const res = await payrollAPI.my(period.year, period.month);
        if (!mounted) return;
        setMyData(findMyRecord(res.data));
      } catch (err) {
        if (!mounted) return;
        setMyData(findMyRecord({}));
        setError(err?.response?.data?.detail || 'Не удалось загрузить мою зарплату');
      } finally {
        if (mounted) setMyLoading(false);
      }
    };

    loadMy();
    return () => {
      mounted = false;
    };
  }, [canViewMySalary, period.year, period.month]);

  useEffect(() => {
    if (!canManagePayroll || view !== 'team') return;

    let mounted = true;

    const loadTeam = async () => {
      setTeamLoading(true);
      setError('');
      setSuccess('');
      try {
        if (!mounted) return;
        await reloadTeamData({ includeComp: true });
      } catch (err) {
        if (!mounted) return;
        setRecords([]);
        setSummary(null);
        setCompensationRows([]);
        setError(err?.response?.data?.detail || 'Не удалось загрузить админ-данные по зарплате');
      } finally {
        if (mounted) setTeamLoading(false);
      }
    };

    loadTeam();
    return () => {
      mounted = false;
    };
  }, [canManagePayroll, view, period.year, period.month]);

  const recalculate = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await payrollAPI.recalculate(period.year, period.month);
      await reloadTeamData({ includeComp: false });
      setSuccess('Пересчет успешно выполнен');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось выполнить пересчет');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (recordId, status) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await payrollAPI.setRecordStatus(recordId, status);
      setRecords((prev) => prev.map((r) => (r.recordId === recordId ? { ...r, status } : r)));
      setSuccess(`Статус выплаты обновлен: ${statusLabel(status)}`);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось изменить статус');
    } finally {
      setSaving(false);
    }
  };

  const openCompEdit = (row) => {
    setModalMode('edit');
    setSelectedComp(row);
    setForm({
      userId: String(row.userId || ''),
      payModel: row.payModel || 'hourly',
      hourlyRate: String(row.hourlyRate || 0),
      minuteRate: String(row.minuteRate || 0),
      fixedSalary: String(row.fixedSalary || 0),
    });
    setModal(true);
  };

  const openCompCreate = () => {
    setError('');
    setSuccess('');
    if (creatableUsers.length === 0) {
      setPopup('Новых сотрудников для добавления ставки нет. Для текущих используйте редактирование в строке.');
      return;
    }
    const firstUserId = String(creatableUsers[0]?.userId || '');
    setModalMode('create');
    setSelectedComp(null);
    setForm({
      userId: firstUserId,
      payModel: 'hourly',
      hourlyRate: '0',
      minuteRate: '0',
      fixedSalary: '0',
    });
    setModal(true);
  };

  useEffect(() => {
    if (!popup) return undefined;
    const timer = setTimeout(() => setPopup(''), 2600);
    return () => clearTimeout(timer);
  }, [popup]);

  const saveCompensation = async () => {
    const targetUserId = modalMode === 'create' ? form.userId : selectedComp?.userId;
    if (!targetUserId) {
      setError('Выберите сотрудника');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (String(targetUserId) === currentUserId) {
        setError('Нельзя добавлять или менять ставку самому себе.');
        setSaving(false);
        return;
      }

      if (modalMode === 'create') {
        const alreadyExists = compensationRows.some((row) => String(row.userId) === String(targetUserId));
        if (alreadyExists) {
          setError('Для этого сотрудника ставка уже существует. Используйте редактирование.');
          setSaving(false);
          return;
        }
      }

      const payload = {
        user_id: Number(targetUserId),
        pay_type: form.payModel === 'fixed_salary' ? 'fixed' : form.payModel,
      };
      if (form.payModel === 'hourly') {
        payload.hourly_rate = Number(form.hourlyRate) || 0;
      } else if (form.payModel === 'minute') {
        payload.minute_rate = Number(form.minuteRate) || 0;
      } else if (form.payModel === 'fixed_salary') {
        payload.fixed_salary = Number(form.fixedSalary) || 0;
      }

      await payrollAPI.compensationUpdate(payload);
      await payrollAPI.recalculate(period.year, period.month);
      if (modalMode === 'create') {
        setNewlyAddedCompUserIds((prev) => [...prev.filter((id) => String(id) !== String(targetUserId)), String(targetUserId)]);
      }
      await reloadTeamData({ includeComp: true });
      setModal(false);
      setSelectedComp(null);
      setSuccess(modalMode === 'create' ? 'Ставка добавлена, пересчет выполнен' : 'Ставка обновлена, пересчет выполнен');
    } catch (err) {
      setError(formatApiError(err, 'Не удалось сохранить ставку'));
    } finally {
      setSaving(false);
    }
  };

  const handlePayModelChange = (value) => {
    setForm((prev) => {
      const next = { ...prev, payModel: value };
      if (value === 'fixed_salary') {
        next.hourlyRate = '0';
        next.minuteRate = '0';
        if (!next.fixedSalary) next.fixedSalary = '0';
      } else if (value === 'hourly') {
        next.minuteRate = '0';
        next.fixedSalary = '0';
      } else if (value === 'minute') {
        next.hourlyRate = '0';
        next.fixedSalary = '0';
      }
      return next;
    });
  };

  const availableUsers = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      if (!r.userId) return;
      map.set(String(r.userId), { userId: String(r.userId), username: r.username });
    });
    compensationRows.forEach((r) => {
      if (!r.userId) return;
      if (!map.has(String(r.userId))) map.set(String(r.userId), { userId: String(r.userId), username: r.username });
    });
    return Array.from(map.values());
  }, [records, compensationRows]);

  const creatableUsers = useMemo(() => {
    const existing = new Set(compensationRows.map((row) => String(row.userId)));
    return availableUsers.filter((u) => !existing.has(String(u.userId)) && String(u.userId) !== currentUserId);
  }, [availableUsers, compensationRows, currentUserId]);
  const mergedRows = useMemo(() => {
    const byUserId = new Map();

    records.forEach((r) => {
      const key = String(r.userId || r.recordId || r.username);
      byUserId.set(key, { key, userId: r.userId, username: r.username, payroll: r, compensation: null });
    });

    compensationRows.forEach((c) => {
      const key = String(c.userId || c.username);
      const existing = byUserId.get(key);
      if (existing) {
        existing.compensation = c;
      } else {
        byUserId.set(key, { key, userId: c.userId, username: c.username, payroll: null, compensation: c });
      }
    });

    return Array.from(byUserId.values());
  }, [records, compensationRows]);
  const teamSummary = useMemo(() => {
    const total = records.length;
    const paid = records.filter((r) => normalizeStatus(r.status) === 'PAID').length;
    const delayed = records.filter((r) => normalizeStatus(r.status) === 'DELAYED').length;
    const calculated = records.filter((r) => normalizeStatus(r.status) === 'CALCULATED').length;
    return { total, paid, delayed, calculated };
  }, [records]);

  useEffect(() => {
    const nextDrafts = {};
    mergedRows.forEach((row) => {
      const comp = row.compensation || {};
      const payroll = row.payroll || {};
      const payModel = comp.payModel || 'hourly';
      nextDrafts[row.key] = {
        payModel,
        hourlyRate: String(comp.hourlyRate ?? 0),
        minuteRate: String(comp.minuteRate ?? 0),
        fixedSalary: String(comp.fixedSalary ?? 0),
        bonus: String(payroll.bonus ?? 0),
      };
    });
    setRowDrafts(nextDrafts);
  }, [mergedRows]);

  const patchRowDraft = (rowKey, patch) => {
    setRowDrafts((prev) => ({ ...prev, [rowKey]: { ...(prev[rowKey] || {}), ...patch } }));
  };

  const setRowModel = (rowKey, model) => {
    setRowDrafts((prev) => {
      const current = prev[rowKey] || { payModel: 'hourly', hourlyRate: '0', minuteRate: '0', fixedSalary: '0' };
      const next = { ...current, payModel: model };
      if (model === 'fixed_salary') {
        next.hourlyRate = '0';
        next.minuteRate = '0';
      } else if (model === 'hourly') {
        next.minuteRate = '0';
        next.fixedSalary = '0';
      } else if (model === 'minute') {
        next.hourlyRate = '0';
        next.fixedSalary = '0';
      }
      return { ...prev, [rowKey]: next };
    });
  };

  const saveRowChanges = async (row) => {
    const draft = rowDrafts[row.key];
    if (!row.userId) {
      setError('Невозможно сохранить изменения: нет user_id');
      return;
    }
    if (!draft) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        user_id: Number(row.userId),
        pay_type: draft.payModel === 'fixed_salary' ? 'fixed' : draft.payModel,
      };
      if (draft.payModel === 'hourly') payload.hourly_rate = Number(draft.hourlyRate) || 0;
      if (draft.payModel === 'minute') payload.minute_rate = Number(draft.minuteRate) || 0;
      if (draft.payModel === 'fixed_salary') payload.fixed_salary = Number(draft.fixedSalary) || 0;

      await payrollAPI.compensationUpdate(payload);
      await payrollAPI.recalculate(period.year, period.month);

      const recordId = row?.payroll?.recordId;
      if (recordId) {
        await payrollAPI.setRecordStatus(recordId, {
          status: normalizeStatus(row?.payroll?.status),
          bonus: Number(draft.bonus) || 0,
        });
      }

      await reloadTeamData({ includeComp: true });
      setSuccess(`Изменения сохранены: ${row.username}`);
    } catch (err) {
      setError(formatApiError(err, 'Не удалось сохранить изменения'));
    } finally {
      setSaving(false);
    }
  };

  if (!canViewMySalary) {
    return (
      <MainLayout title="Зарплата">
        <div className="page-header">
          <div className="page-title">Зарплата</div>
          <div className="page-subtitle">Нет доступа к зарплате для вашей роли.</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Зарплата">
      {popup && (
        <div
          style={{
            position: 'fixed',
            top: 78,
            right: 20,
            zIndex: 1500,
            maxWidth: 460,
            padding: '12px 14px',
            borderRadius: 10,
            background: '#FEF3C7',
            border: '1px solid #FCD34D',
            color: '#92400E',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          }}
        >
          {popup}
        </div>
      )}
      <div className="page-header">
        <div>
          <div className="page-title">Зарплата</div>
          <div className="page-subtitle">Начисления и статус выплат за выбранный период</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <select
          className="form-select"
          style={{ maxWidth: 260 }}
          value={toYyyyMm(period.year, period.month)}
          onChange={(e) => {
            const [year, month] = e.target.value.split('-').map(Number);
            setPeriod({ year, month });
          }}
        >
          {periodOptions.map((opt) => (
            <option key={toYyyyMm(opt.year, opt.month)} value={toYyyyMm(opt.year, opt.month)}>
              {opt.label}
            </option>
          ))}
        </select>

        {canManagePayroll && (
          <>
            <button type="button" className={`btn btn-sm ${view === 'my' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('my')}>
              Моя зарплата
            </button>
            <button type="button" className={`btn btn-sm ${view === 'team' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('team')}>
              Зарплаты сотрудников
            </button>
          </>
        )}
      </div>

      {error && <div style={{ marginBottom: 10, color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
      {success && <div style={{ marginBottom: 10, color: 'var(--success)', fontSize: 12 }}>{success}</div>}

      {view === 'my' || !canManagePayroll ? (
        <MySalaryBlock data={myData} loading={myLoading} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(170px,1fr))', gap: 12, marginBottom: 14 }}>
            <MetricCard
              title="Фонд оплаты"
              value={summary ? fmtMoney(getSummaryFund(summary)) : '—'}
              hint={`Период: ${fmtPayrollMonth(toYyyyMm(period.year, period.month))}`}
              accent="#16A34A"
            />
            <MetricCard title="Записей" value={String(teamSummary.total)} hint="Сотрудников в расчете" accent="#2563EB" />
            <MetricCard title="Выплачено" value={String(teamSummary.paid)} hint="Статус PAID" accent="#10B981" />
            <MetricCard title="Задержка" value={String(teamSummary.delayed)} hint="Статус DELAYED" accent="#EF4444" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div className="card">
              <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Управление периодом</div>
                  <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>{fmtPayrollMonth(toYyyyMm(period.year, period.month))}</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-blue">Всего: {teamSummary.total}</span>
                    <span className="badge badge-yellow">Рассчитано: {teamSummary.calculated}</span>
                    <span className="badge badge-green">Выплачено: {teamSummary.paid}</span>
                    <span className="badge badge-red">Задержка: {teamSummary.delayed}</span>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={recalculate} disabled={saving}>
                  <RotateCcw size={14} /> Пересчитать месяц
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Единая таблица зарплат и ставок</span>
              <button className="btn btn-primary btn-sm" onClick={openCompCreate} disabled={saving} title={creatableUsers.length === 0 ? 'Нет сотрудников для добавления ставки' : 'Добавить ставку'}>
                <Plus size={14} /> Добавить ставку
              </button>
            </div>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 1380 }}>
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Месяц</th>
                    <th>Часы</th>
                    <th>Начисление</th>
                    <th>Премия</th>
                    <th>Статус</th>
                    <th>Модель</th>
                    <th>Ставка</th>
                    <th>Управление</th>
                  </tr>
                </thead>
                <tbody>
                  {teamLoading && (
                    <tr><td colSpan={9} style={{ color: 'var(--gray-500)' }}>Загрузка...</td></tr>
                  )}
                  {!teamLoading && mergedRows.length === 0 && (
                    <tr><td colSpan={9} style={{ color: 'var(--gray-500)' }}>Данных нет</td></tr>
                  )}
                  {!teamLoading && mergedRows.map((row) => {
                    const payroll = row.payroll || {};
                    const st = STATUS_UI[normalizeStatus(payroll.status)] || STATUS_UI.CALCULATED;
                    const draft = rowDrafts[row.key] || { payModel: 'hourly', hourlyRate: '0', minuteRate: '0', fixedSalary: '0' };
                    const payrollPayType = String(payroll.payType || '').toLowerCase();
                    const compPayType = String(row.compensation?.payModel || '').toLowerCase();
                    const typeMismatch = payrollPayType && compPayType && payrollPayType !== compPayType;
                    const rateMismatch =
                      payrollPayType && row.compensation
                        ? (
                            (payrollPayType === 'hourly' && !almostEq(payroll.hourlyRate, row.compensation.hourlyRate)) ||
                            (payrollPayType === 'minute' && !almostEq(payroll.minuteRate, row.compensation.minuteRate)) ||
                            (payrollPayType === 'fixed_salary' && !almostEq(payroll.fixedSalary, row.compensation.fixedSalary))
                          )
                        : false;
                    const hasSyncMismatch = typeMismatch || rateMismatch;
                    const rateInputLabel =
                      draft.payModel === 'minute' ? 'KGS/минута' : draft.payModel === 'fixed_salary' ? 'KGS (оклад)' : 'KGS/час';
                    const rateInputValue =
                      draft.payModel === 'minute' ? draft.minuteRate : draft.payModel === 'fixed_salary' ? draft.fixedSalary : draft.hourlyRate;

                    return (
                      <tr key={row.key}>
                        <td style={{ minWidth: 140 }}>{row.username}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtPayrollMonth(payroll.month)}</td>
                        <td>{Number(payroll.totalHours || 0)} ч</td>
                        <td>{fmtMoney(payroll.totalSalary)}</td>
                        <td style={{ minWidth: 170 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft.bonus ?? '0'}
                              disabled={saving || !payroll.recordId}
                              onChange={(e) => patchRowDraft(row.key, { bonus: e.target.value })}
                              style={{ width: 110, minWidth: 110 }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>KGS</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${st.badge}`}>{st.label}</span>
                          {hasSyncMismatch && (
                            <div style={{ marginTop: 6 }}>
                              <span className="badge badge-red">Рассинхрон ставки</span>
                            </div>
                          )}
                        </td>
                        <td style={{ minWidth: 190 }}>
                          <select
                            className="form-select"
                            style={{ width: 200 }}
                            value={draft.payModel}
                            disabled={saving || !row.userId}
                            onChange={(e) => setRowModel(row.key, e.target.value)}
                          >
                            {PAY_MODEL_OPTIONS.map((model) => (
                              <option key={model.value} value={model.value}>
                                {model.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ minWidth: 220 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={rateInputValue}
                              disabled={saving || !row.userId}
                              onChange={(e) => {
                                if (draft.payModel === 'minute') patchRowDraft(row.key, { minuteRate: e.target.value });
                                else if (draft.payModel === 'fixed_salary') patchRowDraft(row.key, { fixedSalary: e.target.value });
                                else patchRowDraft(row.key, { hourlyRate: e.target.value });
                              }}
                              style={{ width: 100, minWidth: 100 }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{rateInputLabel}</span>
                          </div>
                        </td>
                        <td style={{ minWidth: 230 }}>
                          <div style={{ display: 'grid', gap: 8, minWidth: 210 }}>
                            <select
                              className="form-select"
                              style={{ width: 200 }}
                              value={normalizeStatus(payroll.status)}
                              disabled={saving || !payroll.recordId}
                              onChange={(e) => {
                                const next = e.target.value;
                                if (next !== normalizeStatus(payroll.status) && payroll.recordId) {
                                  updateStatus(payroll.recordId, next);
                                }
                              }}
                            >
                              {PAYOUT_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {STATUS_UI[status].label}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ width: 200, justifyContent: 'center' }}
                              disabled={saving || !row.userId}
                              onClick={() => saveRowChanges(row)}
                            >
                              Сохранить изменения
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => !saving && setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">{modalMode === 'create' ? 'Добавление ставки' : 'Редактирование ставки'}</div>
              <button className="btn-icon" onClick={() => !saving && setModal(false)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {modalMode === 'create' && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Сотрудник</label>
                  <select className="form-select" value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} disabled={saving}>
                    <option value="">{creatableUsers.length === 0 ? 'Нет сотрудников для добавления' : 'Выберите сотрудника'}</option>
                    {creatableUsers.map((u) => (
                      <option key={u.userId} value={u.userId}>{u.username}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Модель оплаты</label>
                <select className="form-select" value={form.payModel} onChange={(e) => handlePayModelChange(e.target.value)} disabled={saving}>
                  {PAY_MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gray-500)' }}>
                  Выберите модель, затем заполните только одно поле ставки.
                </div>
              </div>
              {form.payModel === 'hourly' && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Ставка за час</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.hourlyRate}
                    onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                    disabled={saving}
                  />
                </div>
              )}
              {form.payModel === 'minute' && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Ставка за минуту</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minuteRate}
                    onChange={(e) => setForm((f) => ({ ...f, minuteRate: e.target.value }))}
                    disabled={saving}
                  />
                </div>
              )}
              {form.payModel === 'fixed_salary' && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Оклад</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.fixedSalary}
                    onChange={(e) => setForm((f) => ({ ...f, fixedSalary: e.target.value }))}
                    disabled={saving}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)} disabled={saving}>Отмена</button>
              <button className="btn btn-primary" onClick={saveCompensation} disabled={saving}>
                <Check size={14} /> {saving ? 'Сохранение...' : (modalMode === 'create' ? 'Добавить' : 'Сохранить')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
