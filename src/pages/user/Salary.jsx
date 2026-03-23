import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Download, Plus, RefreshCw, ShieldCheck, Wallet, X } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { payrollAPI } from '../../api/payroll';
import { useAuth } from '../../context/AuthContext';

const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

const STATUS_META = {
  calculated: { label: 'Рассчитано', className: 'badge-yellow' },
  delayed: { label: 'Отложено', className: 'badge-red' },
  paid: { label: 'Выплачено', className: 'badge-green' },
};

const EXPENSE_CATEGORY_LABELS = {
  utilities: 'Коммунальные',
  salary: 'Зарплаты',
  office: 'Офис',
  other: 'Другое',
};

const ROLE_INTRO = {
  intern: {
    title: 'Личный расчет без лишних деталей',
    text: 'Стажер видит только свою выплату за выбранный период и может скачать расчетный лист.',
  },
  employee: {
    title: 'Полный разбор личной зарплаты',
    text: 'Здесь видны базовая сумма, бонусы, штрафы и итог к выплате только по вашему аккаунту.',
  },
  department_head: {
    title: 'Личная зарплата и агрегаты по подразделению',
    text: 'Детальные зарплаты сотрудников скрыты. Доступна только общая картина по отделу.',
  },
  administrator: {
    title: 'Полный payroll-доступ',
    text: 'Можно пересчитывать период, управлять бонусами и штрафами, смотреть расходы и PDF-листы.',
  },
  superadmin: {
    title: 'Полный payroll-доступ',
    text: 'Можно пересчитывать период, управлять бонусами и штрафами, смотреть расходы и PDF-листы.',
  },
};

const amountFmt = (value) => `${Number(value || 0).toLocaleString('ru-RU')} KGS`;

function monthLabel(year, month, withYearWord = false) {
  const name = MONTHS_RU[Math.max(1, Math.min(12, Number(month))) - 1] || '';
  return withYearWord ? `${name} ${year} г.` : `${name} ${year}`;
}

function monthSelectOptions(count = 18) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    };
  });
}

function statusBadge(status) {
  const meta = STATUS_META[String(status || '').toLowerCase()] || { label: status || '-', className: 'badge-gray' };
  return <span className={`badge ${meta.className}`}>{meta.label}</span>;
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function MetricCard({ title, value, hint, borderColor, tone = 'default' }) {
  return (
    <div className={`card payroll-metric-card payroll-metric-card--${tone}`} style={{ borderTop: `3px solid ${borderColor}` }}>
      <div className="card-body">
        <div className="payroll-metric-label">{title}</div>
        <div className="payroll-metric-value">{value}</div>
        {hint ? <div className="payroll-metric-hint">{hint}</div> : null}
      </div>
    </div>
  );
}

function SectionIntro({ title, text, note }) {
  return (
    <div className="payroll-hero">
      <div className="payroll-hero__title">{title}</div>
      <div className="payroll-hero__text">{text}</div>
      {note ? <div className="payroll-hero__note"><ShieldCheck size={14} /> {note}</div> : null}
    </div>
  );
}

function LoadingCard({ text }) {
  return <div className="card"><div className="card-body">{text}</div></div>;
}

function ErrorCard({ text }) {
  return <div className="card"><div className="card-body" style={{ color: 'var(--danger)' }}>{text}</div></div>;
}

function EmptyCard({ text }) {
  return (
    <div className="card">
      <div className="card-body payroll-empty-state">
        <AlertCircle size={18} color="var(--gray-400)" />
        <span>{text}</span>
      </div>
    </div>
  );
}

function AdjustmentModal({ opened, type, record, period, onClose, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!opened) return;
    setAmount('');
    setReason('');
  }, [opened, type, record?.id]);

  if (!opened || !record) return null;

  const title = type === 'bonus' ? 'Добавить бонус' : 'Добавить штраф';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="btn-icon" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Сотрудник</label>
            <input className="form-input" value={record.employee_name || record.username || ''} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Сумма</label>
            <input className="form-input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Причина</label>
            <textarea className="form-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>Отмена</button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!amount || Number(amount) < 0 || !reason.trim()}
            onClick={() => onSubmit({
              user_id: record.user,
              amount,
              reason,
              period: `${period.year}-${String(period.month).padStart(2, '0')}-01`,
            })}
          >
            <Check size={14} /> Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpenseModal({ opened, onClose, onSubmit, defaultDate }) {
  const [form, setForm] = useState({ title: '', category: 'other', amount: '', date: defaultDate });

  useEffect(() => {
    if (!opened) return;
    setForm({ title: '', category: 'other', amount: '', date: defaultDate });
  }, [opened, defaultDate]);

  if (!opened) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Новый расход</div>
          <button className="btn-icon" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Название</label>
            <input className="form-input" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Категория</label>
              <select className="form-select" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}>
                <option value="utilities">Коммунальные</option>
                <option value="salary">Зарплаты</option>
                <option value="office">Офис</option>
                <option value="other">Другое</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Сумма</label>
              <input className="form-input" type="number" min="0" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Дата</label>
            <input className="form-input" type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>Отмена</button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!form.title.trim() || !form.amount || !form.date}
            onClick={() => onSubmit(form)}
          >
            <Check size={14} /> Добавить
          </button>
        </div>
      </div>
    </div>
  );
}

function OwnPayrollSection({ data, loading, error, period, limited, onDownload }) {
  if (loading) return <LoadingCard text="Загрузка зарплаты..." />;
  if (error) return <ErrorCard text={error} />;

  const record = data?.record;
  if (!record) {
    return <EmptyCard text="За выбранный период пока нет данных по зарплате." />;
  }

  return (
    <div className="payroll-stack">
      <div className="payroll-section-head">
        <div>
          <div className="page-title" style={{ fontSize: 18 }}>Моя зарплата</div>
          <div className="page-subtitle">Период: {monthLabel(period.year, period.month, true)}</div>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => onDownload(record.id)}>
          <Download size={14} /> Скачать PDF
        </button>
      </div>

      {limited ? (
        <div className="alert alert-info">
          <ShieldCheck size={16} />
          <span>Для стажера детали бонусов и штрафов скрыты. Доступен только итоговый расчет.</span>
        </div>
      ) : null}

      <div className="stats-grid">
        <MetricCard title="К выплате" value={amountFmt(record.net_amount)} hint={record.status_label || record.status} borderColor="#16A34A" tone="success" />
        <MetricCard title="Базовая сумма" value={amountFmt(record.base_salary)} hint={`Период: ${monthLabel(period.year, period.month, true)}`} borderColor="#2563EB" />
        {!limited ? <MetricCard title="Бонусы" value={amountFmt(record.bonus_total)} hint="Все начисленные бонусы" borderColor="#D97706" tone="warm" /> : null}
        {!limited ? <MetricCard title="Штрафы" value={amountFmt(record.penalty_total)} hint="Все удержания" borderColor="#DC2626" tone="danger" /> : null}
      </div>

      <div className="payroll-split">
        <div className="task-detail-panel">
          <div className="task-detail-panel-title">Сводка по расчету</div>
          <div className="payroll-breakdown-list">
            <div className="payroll-breakdown-row"><span>Сотрудник</span><strong>{record.employee_name || record.username}</strong></div>
            <div className="payroll-breakdown-row"><span>Статус</span><strong>{statusBadge(record.status)}</strong></div>
            <div className="payroll-breakdown-row"><span>Модель оплаты</span><strong>{record.pay_type || '-'}</strong></div>
            <div className="payroll-breakdown-row"><span>Начислено</span><strong>{amountFmt(record.total_salary)}</strong></div>
            <div className="payroll-breakdown-row"><span>Итог</span><strong>{amountFmt(record.net_amount)}</strong></div>
            <div className="payroll-breakdown-row"><span>Часы</span><strong>{Number(record.total_hours || 0).toLocaleString('ru-RU')} ч</strong></div>
          </div>
        </div>

        {!limited ? (
          <div className="task-detail-panel">
            <div className="task-detail-panel-title">Детализация изменений</div>
            <div className="payroll-adjustments-grid">
              <div>
                <div className="payroll-list-title">Бонусы</div>
                <div className="payroll-adjustments-list">
                  {data?.bonuses?.length ? data.bonuses.map((item) => (
                    <div key={item.id} className="payroll-adjustment-item">
                      <strong>{amountFmt(item.amount)}</strong>
                      <span>{item.reason || 'Без комментария'}</span>
                    </div>
                  )) : <div className="task-detail-empty">Бонусов за этот период нет.</div>}
                </div>
              </div>
              <div>
                <div className="payroll-list-title">Штрафы</div>
                <div className="payroll-adjustments-list">
                  {data?.penalties?.length ? data.penalties.map((item) => (
                    <div key={item.id} className="payroll-adjustment-item">
                      <strong>{amountFmt(item.amount)}</strong>
                      <span>{item.reason || 'Без комментария'}</span>
                    </div>
                  )) : <div className="task-detail-empty">Штрафов за этот период нет.</div>}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DepartmentSummarySection({ summary, loading, error, period }) {
  if (loading) return <LoadingCard text="Загрузка агрегатов по отделу..." />;
  if (error) return <ErrorCard text={error} />;
  if (!summary) return null;

  return (
    <div className="payroll-stack">
      <div className="payroll-section-head">
        <div>
          <div className="page-title" style={{ fontSize: 18 }}>Сводка по подразделению</div>
          <div className="page-subtitle">Без детализации зарплат сотрудников за {monthLabel(period.year, period.month, true)}</div>
        </div>
      </div>
      <div className="stats-grid">
        <MetricCard title="Фонд выплат" value={amountFmt(summary.payroll_fund)} hint={`Сотрудников: ${summary.total_employees || 0}`} borderColor="#16A34A" tone="success" />
        <MetricCard title="Бонусы отдела" value={amountFmt(summary.total_bonus)} hint="Сумма бонусов за период" borderColor="#D97706" tone="warm" />
        <MetricCard title="Штрафы отдела" value={amountFmt(summary.total_penalty)} hint="Сумма удержаний за период" borderColor="#DC2626" tone="danger" />
        <MetricCard title="Средняя выплата" value={amountFmt(summary.average_net_amount)} hint="Средний net amount" borderColor="#2563EB" />
      </div>
    </div>
  );
}

function PayrollAdminSection({ records, loading, error, period, onRecalculate, onDownload, onOpenAdjustment }) {
  const summary = useMemo(() => {
    return records.reduce((acc, record) => {
      acc.base += Number(record.base_salary || 0);
      acc.bonus += Number(record.bonus_total || 0);
      acc.penalty += Number(record.penalty_total || 0);
      acc.net += Number(record.net_amount || 0);
      return acc;
    }, { base: 0, bonus: 0, penalty: 0, net: 0 });
  }, [records]);

  return (
    <div className="payroll-stack">
      <div className="payroll-section-head">
        <div>
          <div className="page-title" style={{ fontSize: 18 }}>Payroll сотрудников</div>
          <div className="page-subtitle">Полный доступ к зарплатам за {monthLabel(period.year, period.month, true)}</div>
        </div>
        <button className="btn btn-primary" type="button" onClick={onRecalculate}>
          <RefreshCw size={14} /> Пересчитать месяц
        </button>
      </div>

      {error ? <ErrorCard text={error} /> : null}

      <div className="stats-grid">
        <MetricCard title="Записей" value={String(records.length)} hint="Сотрудников за период" borderColor="#2563EB" />
        <MetricCard title="База" value={amountFmt(summary.base)} hint="Сумма базовых начислений" borderColor="#16A34A" tone="success" />
        <MetricCard title="Бонусы" value={amountFmt(summary.bonus)} hint="Все бонусы периода" borderColor="#D97706" tone="warm" />
        <MetricCard title="К выплате" value={amountFmt(summary.net)} hint={`Штрафы: ${amountFmt(summary.penalty)}`} borderColor="#0F766E" tone="success" />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table payroll-table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>База</th>
                <th>Бонусы</th>
                <th>Штрафы</th>
                <th>К выплате</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7}>Загрузка...</td></tr> : null}
              {!loading && !records.length ? <tr><td colSpan={7}>Нет payroll-записей за выбранный период.</td></tr> : null}
              {!loading && records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{record.employee_name || record.username}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{record.username}</div>
                  </td>
                  <td>{amountFmt(record.base_salary)}</td>
                  <td>{amountFmt(record.bonus_total)}</td>
                  <td>{amountFmt(record.penalty_total)}</td>
                  <td style={{ fontWeight: 700 }}>{amountFmt(record.net_amount)}</td>
                  <td>{statusBadge(record.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpenAdjustment('bonus', record)}>
                        <Plus size={13} /> Бонус
                      </button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpenAdjustment('penalty', record)}>
                        <Plus size={13} /> Штраф
                      </button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onDownload(record.id)}>
                        <Download size={13} /> PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExpensesSection({ data, loading, error, onOpenCreate }) {
  const items = data?.results || [];
  const summary = data?.summary || {};
  const total = Number(summary.total_expenses || 0);
  const categories = Object.entries(summary.categories || {}).map(([key, value]) => ({
    key,
    label: EXPENSE_CATEGORY_LABELS[key] || key,
    amount: Number(value || 0),
    share: total > 0 ? Math.round((Number(value || 0) / total) * 100) : 0,
  })).sort((a, b) => b.amount - a.amount);

  return (
    <div className="payroll-stack">
      <div className="payroll-section-head">
        <div>
          <div className="page-title" style={{ fontSize: 18 }}>Расходы компании</div>
          <div className="page-subtitle">Категории расходов и доля зарплат в общих затратах</div>
        </div>
        <button className="btn btn-primary" type="button" onClick={onOpenCreate}>
          <Plus size={14} /> Добавить расход
        </button>
      </div>

      {error ? <ErrorCard text={error} /> : null}

      <div className="stats-grid">
        <MetricCard title="Всего расходов" value={amountFmt(summary.total_expenses)} hint="По выбранному периоду" borderColor="#2563EB" />
        <MetricCard title="Зарплатные расходы" value={amountFmt(summary.salary_expenses)} hint="Категория salary" borderColor="#16A34A" tone="success" />
        <MetricCard title="Доля зарплат" value={`${Number(summary.salary_share_percent || 0).toLocaleString('ru-RU')}%`} hint="В общих расходах" borderColor="#D97706" tone="warm" />
      </div>

      <div className="payroll-split">
        <div className="task-detail-panel">
          <div className="task-detail-panel-title">Структура расходов</div>
          {loading ? <div className="task-detail-empty">Загрузка...</div> : null}
          {!loading && !categories.length ? <div className="task-detail-empty">Нет расходов за выбранный период.</div> : null}
          {!loading && categories.length ? (
            <div className="expense-bars">
              {categories.map((item) => (
                <div key={item.key} className="expense-bar-row">
                  <div className="expense-bar-meta">
                    <span>{item.label}</span>
                    <strong>{amountFmt(item.amount)}</strong>
                  </div>
                  <div className="expense-bar-track">
                    <div className="expense-bar-fill" style={{ width: `${item.share}%` }} />
                  </div>
                  <div className="expense-bar-percent">{item.share}%</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="task-detail-panel">
          <div className="task-detail-panel-title">Последние расходы</div>
          <div className="task-detail-scroll is-tall">
            {loading ? <div className="task-detail-empty">Загрузка...</div> : null}
            {!loading && !items.length ? <div className="task-detail-empty">Расходов за выбранный период нет.</div> : null}
            {!loading && items.map((item) => (
              <div key={item.id} className="task-detail-entry">
                <div className="task-detail-entry-title">{item.title}</div>
                <div className="task-detail-entry-meta">
                  {item.date} · {EXPENSE_CATEGORY_LABELS[item.category] || item.category}
                </div>
                <div className="task-detail-entry-body">{amountFmt(item.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Salary() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const isIntern = role === 'intern';
  const isTeamlead = role === 'teamlead' || role === 'projectmanager';
  const isDepartmentHead = role === 'admin' || role === 'department_head';
  const isPayrollAdmin = ['administrator', 'superadmin', 'systemadmin'].includes(role);

  const [selected, setSelected] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [tab, setTab] = useState('my');
  const [myData, setMyData] = useState(null);
  const [myLoading, setMyLoading] = useState(true);
  const [myError, setMyError] = useState('');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');
  const [expenses, setExpenses] = useState(null);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesError, setExpensesError] = useState('');
  const [adjustmentModal, setAdjustmentModal] = useState({ opened: false, type: 'bonus', record: null });
  const [expenseModalOpened, setExpenseModalOpened] = useState(false);

  const monthOptions = useMemo(() => monthSelectOptions(), []);
  const monthStartIso = `${selected.year}-${String(selected.month).padStart(2, '0')}-01`;
  const monthRoleIntro = ROLE_INTRO[role] || ROLE_INTRO.employee;

  const loadMy = async () => {
    setMyLoading(true);
    setMyError('');
    try {
      const response = await payrollAPI.mySummary(selected);
      setMyData(response.data || null);
    } catch (error) {
      setMyError(error?.response?.data?.detail || 'Не удалось загрузить зарплату.');
    } finally {
      setMyLoading(false);
    }
  };

  const loadSummary = async () => {
    if (!isDepartmentHead) return;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const response = await payrollAPI.departmentSummary(selected);
      setSummary(response.data || null);
    } catch (error) {
      setSummaryError(error?.response?.data?.detail || 'Не удалось загрузить сводку по подразделению.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadRecords = async () => {
    if (!isPayrollAdmin) return;
    setRecordsLoading(true);
    setRecordsError('');
    try {
      const response = await payrollAPI.all(selected);
      setRecords(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setRecordsError(error?.response?.data?.detail || 'Не удалось загрузить payroll сотрудников.');
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadExpenses = async () => {
    if (!isPayrollAdmin) return;
    setExpensesLoading(true);
    setExpensesError('');
    try {
      const response = await payrollAPI.expenses({ date_from: monthStartIso, date_to: `${monthStartIso.slice(0, 8)}31` });
      setExpenses(response.data || null);
    } catch (error) {
      setExpensesError(error?.response?.data?.detail || 'Не удалось загрузить расходы компании.');
    } finally {
      setExpensesLoading(false);
    }
  };

  useEffect(() => {
    if (isTeamlead) return;
    loadMy();
    loadSummary();
    loadRecords();
    loadExpenses();
  }, [selected.year, selected.month, role]);

  const handleDownloadPayslip = async (recordId) => {
    const response = await payrollAPI.downloadPayslip(recordId);
    const blob = new Blob([response.data], { type: 'application/pdf' });
    downloadBlob(blob, `payslip-${recordId}.pdf`);
  };

  const handleRecalculate = async () => {
    setRecordsError('');
    try {
      await payrollAPI.recalculate(selected);
      await Promise.all([loadMy(), loadRecords()]);
    } catch (error) {
      setRecordsError(error?.response?.data?.detail || 'Не удалось пересчитать период.');
    }
  };

  const handleAdjustmentSubmit = async (payload) => {
    try {
      if (adjustmentModal.type === 'bonus') {
        await payrollAPI.createBonus(payload);
      } else {
        await payrollAPI.createPenalty(payload);
      }
      setAdjustmentModal({ opened: false, type: 'bonus', record: null });
      await Promise.all([loadMy(), loadRecords()]);
    } catch (error) {
      setRecordsError(error?.response?.data?.detail || 'Не удалось сохранить изменение payroll.');
    }
  };

  const handleExpenseCreate = async (payload) => {
    try {
      await payrollAPI.createExpense(payload);
      setExpenseModalOpened(false);
      await loadExpenses();
    } catch (error) {
      setExpensesError(error?.response?.data?.detail || 'Не удалось добавить расход.');
    }
  };

  if (isTeamlead) {
    return (
      <MainLayout title="Зарплата">
        <SectionIntro
          title="Модуль зарплат недоступен для тимлида"
          text="По текущей ролевой модели тимлид и менеджер проекта не видят зарплатные данные сотрудников."
          note="Проверьте доступ под ролью Department Head, Administrator или Superadmin."
        />
      </MainLayout>
    );
  }

  const showTabs = isPayrollAdmin;

  return (
    <MainLayout title="Зарплата">
      <div className="page-header">
        <div>
          <div className="page-title">Зарплата</div>
          <div className="page-subtitle">Приватные данные по зарплате и выплаты за выбранный период</div>
        </div>
      </div>

      <SectionIntro
        title={monthRoleIntro.title}
        text={monthRoleIntro.text}
        note={showTabs ? 'Доступ к данным ограничен на уровне backend и queryset-проверок.' : 'Показываются только данные, разрешенные вашей ролью.'}
      />

      <div className="payroll-toolbar">
        <div className="payroll-toolbar__controls">
          <select
            className="form-select"
            style={{ width: 220 }}
            value={`${selected.year}-${String(selected.month).padStart(2, '0')}`}
            onChange={(e) => {
              const [year, month] = e.target.value.split('-').map(Number);
              setSelected({ year, month });
            }}
          >
            {monthOptions.map((option) => <option key={option.key} value={option.key}>{monthLabel(option.year, option.month, true)}</option>)}
          </select>
          <div className="payroll-toolbar__period">Период: {monthLabel(selected.year, selected.month, true)}</div>
        </div>

        {showTabs ? (
          <div className="payroll-tabs">
            <button className={`btn btn-sm ${tab === 'my' ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => setTab('my')}>
              <Wallet size={14} /> Моя зарплата
            </button>
            <button className={`btn btn-sm ${tab === 'payroll' ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => setTab('payroll')}>
              Payroll
            </button>
            <button className={`btn btn-sm ${tab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => setTab('expenses')}>
              Расходы
            </button>
          </div>
        ) : null}
      </div>

      {(!showTabs || tab === 'my') ? (
        <div className="payroll-stack">
          <OwnPayrollSection
            data={myData}
            loading={myLoading}
            error={myError}
            period={selected}
            limited={isIntern}
            onDownload={handleDownloadPayslip}
          />
          {isDepartmentHead ? (
            <DepartmentSummarySection summary={summary} loading={summaryLoading} error={summaryError} period={selected} />
          ) : null}
        </div>
      ) : null}

      {showTabs && tab === 'payroll' ? (
        <PayrollAdminSection
          records={records}
          loading={recordsLoading}
          error={recordsError}
          period={selected}
          onRecalculate={handleRecalculate}
          onDownload={handleDownloadPayslip}
          onOpenAdjustment={(type, record) => setAdjustmentModal({ opened: true, type, record })}
        />
      ) : null}

      {showTabs && tab === 'expenses' ? (
        <ExpensesSection data={expenses} loading={expensesLoading} error={expensesError} onOpenCreate={() => setExpenseModalOpened(true)} />
      ) : null}

      <AdjustmentModal
        opened={adjustmentModal.opened}
        type={adjustmentModal.type}
        record={adjustmentModal.record}
        period={selected}
        onClose={() => setAdjustmentModal({ opened: false, type: 'bonus', record: null })}
        onSubmit={handleAdjustmentSubmit}
      />

      <ExpenseModal
        opened={expenseModalOpened}
        onClose={() => setExpenseModalOpened(false)}
        onSubmit={handleExpenseCreate}
        defaultDate={monthStartIso}
      />
    </MainLayout>
  );
}
