import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Eye, FileText, ListChecks, Paperclip, PlusCircle, Save, X } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { onboardingAPI, tasksAPI } from '../../api/content';

const DAY_STATUS = {
  DONE: ['Завершен', 'badge-green'],
  IN_PROGRESS: ['В работе', 'badge-blue'],
  NOT_STARTED: ['Не начат', 'badge-gray'],
  LOCKED: ['Заблокирован', 'badge-gray'],
};

const REPORT_STATUS = {
  DRAFT: ['Черновик', 'badge-gray'],
  SENT: ['Отправлен', 'badge-blue'],
  ACCEPTED: ['Принят', 'badge-green'],
  REVISION: ['На доработке', 'badge-yellow'],
  REJECTED: ['Отклонен', 'badge-red'],
};

const EMPTY_DAY_FORM = { day_number: '', title: '', task_templates: [] };
const EMPTY_TEMPLATE = { title: '', description: '' };

const normalizeRole = (value) => String(value || '').trim().toLowerCase();
const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
const isTaskDone = (task) => ['готов', 'заверш', 'done', 'closed'].some((token) => String(task?.column || task?.column_name || '').toLowerCase().includes(token));
const reportBadge = (status) => REPORT_STATUS[String(status || '').toUpperCase()] || REPORT_STATUS.DRAFT;
const dayBadge = (status) => DAY_STATUS[String(status || '').toUpperCase()] || DAY_STATUS.NOT_STARTED;
const sortTasks = (tasks) => [...tasks].sort((a, b) => Number(a.onboarding_day_number || 999) - Number(b.onboarding_day_number || 999) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
const sortReports = (reports) => [...reports].sort((a, b) => Number(a.day_number || 0) - Number(b.day_number || 0) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
const matchesSubdivision = (template, subdivisionId) => {
  const ids = Array.isArray(template?.subdivision_ids) ? template.subdivision_ids.map(Number) : [];
  if (!subdivisionId) return ids.length === 0;
  return ids.includes(Number(subdivisionId));
};
const tasksForDay = (tasks, dayId) => tasks.filter((item) => String(item.onboarding_day_id || '') === String(dayId || ''));

export default function AdminInterns() {
  const [interns, setInterns] = useState([]);
  const [days, setDays] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [selectedInternId, setSelectedInternId] = useState('');
  const [activeTab, setActiveTab] = useState('progress');
  const [selectedDayId, setSelectedDayId] = useState('');
  const [selectedReportId, setSelectedReportId] = useState('');
  const [reports, setReports] = useState([]);
  const [dayForm, setDayForm] = useState(EMPTY_DAY_FORM);
  const [attachmentsMap, setAttachmentsMap] = useState({});
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [savingDay, setSavingDay] = useState(false);
  const [creatingDay, setCreatingDay] = useState(false);
  const [uploadingTaskId, setUploadingTaskId] = useState('');
  const [deletingAttachmentId, setDeletingAttachmentId] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const flash = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  };

  const refreshInternProgress = async (internId) => {
    const res = await onboardingAPI.getInternProgress(internId);
    setProgressMap((prev) => ({ ...prev, [String(internId)]: res.data || null }));
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [daysRes, assigneesRes] = await Promise.all([onboardingAPI.listDays(), tasksAPI.assignees()]);
      const loadedDays = Array.isArray(daysRes.data) ? daysRes.data : [];
      const assignees = Array.isArray(assigneesRes.data) ? assigneesRes.data : [];
      const loadedInterns = assignees
        .filter((item) => normalizeRole(item.role).includes('intern'))
        .map((item) => ({ id: String(item.id), name: item.full_name || item.username || `ID ${item.id}`, username: item.username || '' }));
      const progressEntries = await Promise.all(loadedInterns.map(async (intern) => {
        try {
          const res = await onboardingAPI.getInternProgress(intern.id);
          return [intern.id, res.data || null];
        } catch {
          return [intern.id, null];
        }
      }));
      setDays(loadedDays);
      setInterns(loadedInterns);
      setProgressMap(Object.fromEntries(progressEntries));
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось загрузить стажеров.');
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async (internId) => {
    setReportsLoading(true);
    try {
      const res = await onboardingAPI.getReports({ user_id: internId });
      const nextReports = sortReports(Array.isArray(res.data) ? res.data : []);
      setReports(nextReports);
      setSelectedReportId(nextReports[0] ? String(nextReports[0].id) : '');
    } catch (e) {
      setReports([]);
      setSelectedReportId('');
      setError(e.response?.data?.detail || 'Не удалось загрузить отчеты.');
    } finally {
      setReportsLoading(false);
    }
  };

  const loadTaskAttachments = async (taskIds) => {
    if (!taskIds.length) {
      setAttachmentsMap({});
      return;
    }
    try {
      const results = await Promise.all(taskIds.map(async (taskId) => {
        const res = await tasksAPI.attachments(taskId);
        return [String(taskId), Array.isArray(res.data) ? res.data : []];
      }));
      setAttachmentsMap(Object.fromEntries(results));
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось загрузить вложения задач.');
    }
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => interns.map((intern) => {
    const progress = progressMap[intern.id];
    const user = progress?.user || {};
    const tasks = sortTasks(Array.isArray(progress?.tasks) ? progress.tasks : []);
    const reportsSummary = Array.isArray(progress?.reports) ? progress.reports : [];
    const completedDays = Number(progress?.overview?.completed_days || 0);
    const totalDays = Number(progress?.overview?.total_days || days.length || 0);
    const percent = totalDays ? Math.round((completedDays / totalDays) * 100) : 0;
    const currentDayProgress = (progress?.day_progress || []).find((item) => String(item.status || '').toUpperCase() !== 'DONE');
    return {
      ...intern,
      progress,
      user,
      tasks,
      reports: reportsSummary,
      percent,
      completedDays,
      totalDays,
      currentDay: progress?.overview?.current_day_number || '—',
      currentDayId: currentDayProgress?.day_id || days[0]?.id || '',
      directionName: user.subdivision || 'Не выбрано',
      departmentName: user.department || '—',
      managerName: user.manager || '—',
      hasDirection: Boolean(String(user.subdivision || '').trim()),
      completedTaskCount: tasks.filter(isTaskDone).length,
    };
  }).sort((a, b) => Number(b.hasDirection) - Number(a.hasDirection) || a.name.localeCompare(b.name, 'ru')), [days, interns, progressMap]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (directionFilter === 'chosen' && !row.hasDirection) return false;
    if (directionFilter === 'pending' && row.hasDirection) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [row.name, row.username, row.directionName, row.departmentName, row.managerName].some((value) => String(value || '').toLowerCase().includes(q));
  }), [directionFilter, rows, search]);

  const selectedIntern = useMemo(() => rows.find((item) => String(item.id) === String(selectedInternId)) || null, [rows, selectedInternId]);
  const selectedTasks = useMemo(() => selectedIntern?.tasks || [], [selectedIntern]);
  const selectedSubdivisionId = Number(selectedIntern?.user?.subdivision_id || 0);
  const selectedDay = useMemo(() => days.find((item) => String(item.id) === String(selectedDayId)) || null, [days, selectedDayId]);
  const selectedDayTasks = useMemo(() => tasksForDay(selectedTasks, selectedDayId), [selectedDayId, selectedTasks]);
  const selectedReport = useMemo(() => reports.find((item) => String(item.id) === String(selectedReportId)) || null, [reports, selectedReportId]);
  const reportMap = useMemo(() => new Map((selectedIntern?.reports || []).map((item) => [Number(item.day_number), item])), [selectedIntern]);
  const taskMap = useMemo(() => selectedTasks.reduce((acc, task) => {
    const key = String(task.onboarding_day_id || '');
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(task);
    return acc;
  }, new Map()), [selectedTasks]);

  useEffect(() => {
    if (activeTab === 'reports' && selectedIntern?.id) loadReports(selectedIntern.id);
  }, [activeTab, selectedIntern?.id]);

  useEffect(() => {
    if (activeTab !== 'tasks') return;
    if (!days.length) {
      setSelectedDayId('');
      return;
    }
    if (!selectedDayId || !days.some((day) => String(day.id) === String(selectedDayId))) {
      setSelectedDayId(String(days[0].id));
    }
  }, [activeTab, days, selectedDayId]);

  useEffect(() => {
    if (activeTab !== 'tasks' || !selectedDay) return;
    const templates = (selectedDay.task_templates || [])
      .filter((item) => matchesSubdivision(item, selectedSubdivisionId))
      .map((item) => ({
        title: item.title || '',
        description: item.description || '',
      }));
    const fallbackTasks = tasksForDay(selectedTasks, selectedDay.id).map((item) => ({
      title: item.title || '',
      description: item.description || '',
    }));
    setDayForm({
      day_number: String(selectedDay.day_number || ''),
      title: selectedDay.title || '',
      task_templates: templates.length > 0 ? templates : fallbackTasks,
    });
  }, [activeTab, selectedDay, selectedSubdivisionId, selectedTasks]);

  useEffect(() => {
    if (activeTab !== 'tasks') return;
    const taskIds = selectedDayTasks.map((item) => item.id);
    loadTaskAttachments(taskIds);
  }, [activeTab, selectedDayTasks]);

  const openIntern = (intern) => {
    setSelectedInternId(String(intern.id));
    setActiveTab('progress');
    setSelectedDayId('');
    setSelectedReportId('');
    setReports([]);
    setDayForm(EMPTY_DAY_FORM);
    setError('');
  };

  const closeIntern = () => {
    setSelectedInternId('');
    setSelectedDayId('');
    setSelectedReportId('');
    setReports([]);
  };

  const addTemplateRow = () => {
    setDayForm((prev) => ({ ...prev, task_templates: [...prev.task_templates, { ...EMPTY_TEMPLATE }] }));
  };

  const updateTemplateRow = (index, key, value) => {
    setDayForm((prev) => ({
      ...prev,
      task_templates: prev.task_templates.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      )),
    }));
  };

  const removeTemplateRow = (index) => {
    setDayForm((prev) => ({
      ...prev,
      task_templates: prev.task_templates.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const saveDay = async () => {
    if (!selectedDay || !selectedIntern) return;
    if (!selectedSubdivisionId) return setError('Сначала у стажера должен быть выбран подотдел.');
    if (!String(dayForm.day_number || '').trim()) return setError('Укажите номер дня.');
    if (!String(dayForm.title || '').trim()) return setError('Укажите название дня.');
    if (dayForm.task_templates.some((item) => !String(item.title || '').trim())) {
      return setError('У каждой задачи дня должно быть название.');
    }

    const otherTemplates = (selectedDay.task_templates || []).filter(
      (item) => !matchesSubdivision(item, selectedSubdivisionId)
    );
    const currentTemplates = dayForm.task_templates
      .filter((item) => String(item.title || '').trim())
      .map((item) => ({
        title: item.title.trim(),
        description: String(item.description || '').trim(),
        subdivision_ids: [selectedSubdivisionId],
      }));

    setSavingDay(true);
    setError('');
    try {
      const res = await onboardingAPI.adminUpdateDay(selectedDay.id, {
        day_number: Number(dayForm.day_number),
        title: dayForm.title.trim(),
        goals: selectedDay.goals || '',
        description: selectedDay.description || '',
        instructions: selectedDay.instructions || '',
        deadline_time: selectedDay.deadline_time || null,
        is_active: true,
        position: Number(dayForm.day_number),
        task_templates: [...otherTemplates, ...currentTemplates],
      });
      await Promise.all([load(), refreshInternProgress(selectedIntern.id)]);
      setSelectedDayId(String(res.data?.id || selectedDay.id));
      flash('День и задачи обновлены.');
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось сохранить день.');
    } finally {
      setSavingDay(false);
    }
  };

  const createDay = async () => {
    const nextDayNumber = days.reduce((maxValue, item) => Math.max(maxValue, Number(item.day_number || 0)), 0) + 1;
    setCreatingDay(true);
    setError('');
    try {
      const res = await onboardingAPI.adminCreateDay({
        day_number: nextDayNumber,
        title: `День ${nextDayNumber}`,
        goals: '',
        description: '',
        instructions: '',
        deadline_time: null,
        is_active: true,
        position: nextDayNumber,
        task_templates: [],
      });
      await load();
      setActiveTab('tasks');
      setSelectedDayId(String(res.data?.id || ''));
      flash(`Добавлен день ${nextDayNumber}.`);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось добавить новый день.');
    } finally {
      setCreatingDay(false);
    }
  };

  const uploadAttachment = async (taskId, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !taskId) return;
    setUploadingTaskId(String(taskId));
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      await tasksAPI.uploadAttachment(taskId, form);
      await loadTaskAttachments(selectedDayTasks.map((item) => item.id));
      flash('Файл прикреплен к задаче.');
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось прикрепить файл.');
    } finally {
      setUploadingTaskId('');
    }
  };

  const deleteAttachment = async (taskId, attachmentId) => {
    if (!window.confirm('Удалить вложение?')) return;
    setDeletingAttachmentId(String(attachmentId));
    setError('');
    try {
      await tasksAPI.deleteAttachment(attachmentId);
      await loadTaskAttachments(selectedDayTasks.map((item) => item.id));
      flash('Вложение удалено.');
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось удалить вложение.');
    } finally {
      setDeletingAttachmentId('');
    }
  };

  return (
    <MainLayout title="Управление · Стажеры">
      <div className="page-header">
        <div>
          <div className="page-title">Стажеры</div>
          <div className="page-subtitle">Прогресс, отчеты и задачи стажеров для PM и выше</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Поиск</label>
              <input className="form-input" placeholder="Имя, логин, направление, отдел" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Направление</label>
              <select className="form-select" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)}>
                <option value="all">Все стажеры</option>
                <option value="chosen">Направление выбрано</option>
                <option value="pending">Направление не выбрано</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: '#b91c1c' }}>{error}</div></div> : null}

      {loading ? <div className="card"><div className="card-body">Загрузка...</div></div> : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>СТАЖЕР</th><th>НАПРАВЛЕНИЕ</th><th>ДЕНЬ</th><th>ПРОГРЕСС</th><th>ЗАДАЧИ</th><th>ДЕЙСТВИЯ</th></tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td><div style={{ fontWeight: 700 }}>{row.name}</div><div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.username || '—'} • PM: {row.managerName}</div></td>
                    <td><div style={{ marginBottom: 6 }}><span className={`badge ${row.hasDirection ? 'badge-green' : 'badge-gray'}`}>{row.directionName}</span></div><div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.departmentName}</div></td>
                    <td><div style={{ fontWeight: 600 }}>День {row.currentDay}</div></td>
                    <td><div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{row.completedDays}/{row.totalDays} дней • {row.percent}%</div><div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Отчетов: {row.reports.length} • Завершено задач: {row.completedTaskCount}/{row.tasks.length}</div></td>
                    <td><div style={{ fontWeight: 600 }}>{row.tasks.filter((task) => task.onboarding_day_id).length}</div><div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.hasDirection ? 'можно назначать' : 'ждет направление'}</div></td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => openIntern(row)}><Eye size={14} /> Открыть</button></td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? <tr><td colSpan={6}>Стажеры в вашей зоне ответственности не найдены.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedIntern ? (
        <div className="modal-overlay" onClick={closeIntern}>
          <div className="modal" style={{ width: 1160, maxWidth: 'calc(100vw - 24px)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{selectedIntern.name} • {selectedIntern.directionName}</div>
              <button className="btn-icon" onClick={closeIntern}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
              <div className="grid-2">
                <div className="card" style={{ marginBottom: 0 }}><div className="card-body">Прогресс: {selectedIntern.completedDays}/{selectedIntern.totalDays} дней • {selectedIntern.percent}%</div></div>
                <div className="card" style={{ marginBottom: 0 }}><div className="card-body">Отдел: {selectedIntern.departmentName} • PM: {selectedIntern.managerName}</div></div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className={activeTab === 'progress' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setActiveTab('progress')}><CalendarDays size={14} /> Прогресс</button>
                <button className={activeTab === 'reports' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setActiveTab('reports')}><FileText size={14} /> Отчеты</button>
                <button className={activeTab === 'tasks' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setActiveTab('tasks')}><ListChecks size={14} /> Дни и задачи</button>
              </div>

              {activeTab === 'progress' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {!selectedIntern.hasDirection ? <div style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 10 }}>Сначала стажер должен выбрать направление.</div> : null}
                  {days.map((day) => {
                    const progress = (selectedIntern.progress?.day_progress || []).find((item) => String(item.day_id) === String(day.id));
                    const [dayLabel, dayCls] = dayBadge(progress?.status || 'NOT_STARTED');
                    const report = reportMap.get(Number(day.day_number));
                    const reportMeta = report ? reportBadge(report.status) : null;
                    const dayTasks = taskMap.get(String(day.id)) || [];
                    return (
                      <div key={day.id} className="card" style={{ marginBottom: 0 }}>
                        <div className="card-body">
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                            <div><div style={{ fontWeight: 700 }}>День {day.day_number} • {day.title}</div><div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Задач: {dayTasks.length}</div></div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><span className={`badge ${dayCls}`}>{dayLabel}</span>{reportMeta ? <span className={`badge ${reportMeta[1]}`}>Отчет: {reportMeta[0]}</span> : null}</div>
                          </div>
                          {dayTasks.length ? dayTasks.map((task) => <div key={task.id} style={{ fontSize: 13, marginTop: 6 }}>{task.title} • {task.column || 'Без статуса'}</div>) : <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>На этот день задач пока нет.</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {activeTab === 'reports' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 14 }}>
                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-body" style={{ maxHeight: 520, overflowY: 'auto' }}>
                      {reportsLoading ? <div>Загрузка отчетов...</div> : reports.length === 0 ? <div style={{ color: 'var(--gray-500)' }}>У стажера пока нет отчетов.</div> : reports.map((report) => {
                        const [label, cls] = reportBadge(report.status);
                        return (
                          <button key={report.id} type="button" onClick={() => setSelectedReportId(String(report.id))} style={{ width: '100%', textAlign: 'left', border: '1px solid var(--gray-100)', background: String(report.id) === String(selectedReportId) ? '#eff6ff' : '#fff', borderRadius: 8, padding: 10, marginBottom: 8, cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}><div style={{ fontWeight: 600 }}>{report.report_title || `Отчет по дню ${report.day_number}`}</div><span className={`badge ${cls}`}>{label}</span></div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>День {report.day_number} • {formatDateTime(report.updated_at)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-body">
                      {!selectedReport ? <div style={{ color: 'var(--gray-500)' }}>Выберите отчет слева.</div> : (
                        <div style={{ display: 'grid', gap: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><div style={{ fontSize: 20, fontWeight: 700 }}>{selectedReport.report_title || `Отчет по дню ${selectedReport.day_number}`}</div><div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Обновлен {formatDateTime(selectedReport.updated_at)}</div></div><span className={`badge ${reportBadge(selectedReport.status)[1]}`}>{reportBadge(selectedReport.status)[0]}</span></div>
                          <div><div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>Что сделал</div><div style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.did || '—'}</div></div>
                          <div><div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>Что будет делать</div><div style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.will_do || '—'}</div></div>
                          <div><div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>Описание работы</div><div style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.report_description || '—'}</div></div>
                          <div><div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>Проблемы</div><div style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.problems || '—'}</div></div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{selectedReport.github_url ? <a className="btn btn-outline btn-sm" href={selectedReport.github_url} target="_blank" rel="noreferrer">Открыть GitHub</a> : null}{selectedReport.attachment ? <a className="btn btn-outline btn-sm" href={selectedReport.attachment} target="_blank" rel="noreferrer">Открыть файл</a> : null}</div>
                          <div><div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>Комментарий проверяющего</div><div style={{ whiteSpace: 'pre-wrap' }}>{selectedReport.reviewer_comment || 'Комментария пока нет.'}</div></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'tasks' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 14 }}>
                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-body" style={{ maxHeight: 560, overflowY: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                        <div style={{ fontWeight: 700 }}>Дни стажировки</div>
                        <button className="btn btn-outline btn-sm" onClick={createDay} disabled={creatingDay}>
                          <PlusCircle size={14} /> {creatingDay ? 'Добавляем...' : 'Добавить день'}
                        </button>
                      </div>
                      {days.map((day) => (
                        <button key={day.id} type="button" onClick={() => setSelectedDayId(String(day.id))} style={{ width: '100%', textAlign: 'left', border: '1px solid var(--gray-100)', background: String(day.id) === String(selectedDayId) ? '#eff6ff' : '#fff', borderRadius: 8, padding: 10, marginBottom: 8, cursor: 'pointer' }}>
                          <div style={{ fontWeight: 600 }}>День {day.day_number} • {day.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                            Шаблонных задач: {(day.task_templates || []).filter((item) => matchesSubdivision(item, selectedSubdivisionId)).length} •
                            {' '}Текущих задач: {tasksForDay(selectedTasks, day.id).length}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                      {!selectedIntern.hasDirection ? (
                        <div style={{ color: 'var(--gray-500)' }}>Редактирование задач по дням доступно после выбора подотдела стажером.</div>
                      ) : !selectedDay ? (
                        <div style={{ color: 'var(--gray-500)' }}>Выберите день слева.</div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 20, fontWeight: 700 }}>День {selectedDay.day_number}</div>
                              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Подотдел: {selectedIntern.directionName}</div>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={saveDay} disabled={savingDay}>
                              <Save size={14} /> {savingDay ? 'Сохраняем...' : 'Сохранить день'}
                            </button>
                          </div>

                          <div className="grid-2">
                            <div className="form-group">
                              <label className="form-label">Номер дня</label>
                              <input className="form-input" type="number" min="1" value={dayForm.day_number} onChange={(e) => setDayForm((prev) => ({ ...prev, day_number: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Название дня</label>
                              <input className="form-input" value={dayForm.title} onChange={(e) => setDayForm((prev) => ({ ...prev, title: e.target.value }))} />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <div style={{ fontWeight: 700 }}>Задачи дня для подотдела</div>
                            <button className="btn btn-outline btn-sm" onClick={addTemplateRow}>
                              <PlusCircle size={14} /> Добавить задачу
                            </button>
                          </div>

                          <div style={{ border: '1px solid var(--gray-100)', borderRadius: 8, padding: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Текущие задачи стажера на этот день</div>
                            {selectedDayTasks.length === 0 ? (
                              <div style={{ color: 'var(--gray-500)' }}>Сейчас у стажера на этот день задач нет.</div>
                            ) : (
                              selectedDayTasks.map((task) => (
                                <div key={task.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                                  <div style={{ fontWeight: 600 }}>{task.title}</div>
                                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{task.column || 'Без статуса'}</div>
                                  {task.description ? <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{task.description}</div> : null}
                                  <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                                        <Paperclip size={14} /> Вложения
                                      </div>
                                      <label className="btn btn-outline btn-sm" style={{ cursor: String(uploadingTaskId) === String(task.id) ? 'not-allowed' : 'pointer' }}>
                                        {String(uploadingTaskId) === String(task.id) ? 'Загружаем...' : 'Добавить файл'}
                                        <input type="file" style={{ display: 'none' }} onChange={(e) => uploadAttachment(task.id, e)} disabled={String(uploadingTaskId) === String(task.id)} />
                                      </label>
                                    </div>
                                    {(attachmentsMap[String(task.id)] || []).length === 0 ? (
                                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Файлов пока нет.</div>
                                    ) : (
                                      (attachmentsMap[String(task.id)] || []).map((attachment) => (
                                        <div key={attachment.id} style={{ border: '1px solid var(--gray-100)', borderRadius: 8, padding: 8 }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                            <div>
                                              <div style={{ fontWeight: 600, fontSize: 13 }}>{String(attachment.file || '').split('/').pop() || `Файл #${attachment.id}`}</div>
                                              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                                                {attachment.uploaded_by_full_name || attachment.uploaded_by_username || '—'} • {formatDateTime(attachment.uploaded_at)}
                                              </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                              <a className="btn btn-outline btn-sm" href={attachment.file} target="_blank" rel="noreferrer">Открыть</a>
                                              <button className="btn btn-outline btn-sm" onClick={() => deleteAttachment(task.id, attachment.id)} disabled={String(deletingAttachmentId) === String(attachment.id)}>
                                                {String(deletingAttachmentId) === String(attachment.id) ? 'Удаляем...' : 'Удалить'}
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {dayForm.task_templates.length === 0 ? <div style={{ color: 'var(--gray-500)' }}>Для этого дня задач пока нет.</div> : null}
                          {dayForm.task_templates.map((item, index) => (
                            <div key={`${selectedDayId}-${index}`} style={{ border: '1px solid var(--gray-100)', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                <div style={{ fontWeight: 600 }}>Задача {index + 1}</div>
                                <button className="btn btn-outline btn-sm" onClick={() => removeTemplateRow(index)}>Удалить</button>
                              </div>
                              <div className="form-group">
                                <label className="form-label">Название задачи</label>
                                <input className="form-input" value={item.title} onChange={(e) => updateTemplateRow(index, 'title', e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Описание</label>
                                <textarea className="form-textarea" style={{ minHeight: 100 }} value={item.description} onChange={(e) => updateTemplateRow(index, 'description', e.target.value)} />
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast toast-success"><div><div className="toast-title">Готово</div><div className="toast-msg">{toast}</div></div></div> : null}
    </MainLayout>
  );
}
