import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Eye, ListFilter, MessageSquareText, Plus, UserRound, X } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { onboardingAPI, tasksAPI } from '../../api/content';

const PRIORITY_LABELS = {
  critical: 'Критический',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const DEFAULT_COLUMN_ORDERS = [1, 2, 3, 4];
const DEFAULT_COLUMN_NAMES = {
  1: 'Новые',
  2: 'В работе',
  3: 'На проверке',
  4: 'Завершенные',
};

const TASK_TYPE_LABELS = {
  all: 'Все',
  regular: 'Обычные',
  system: 'Системные',
};

const DAILY_REPORT_STATUS_META = {
  SENT: { label: 'На проверке', badgeClass: 'badge-yellow' },
  ACCEPTED: { label: 'Принят', badgeClass: 'badge-green' },
  REVISION_REQUIRED: { label: 'Нужны правки', badgeClass: 'badge-red' },
};

function getDefaultTaskType(section) {
  return section === 'team' ? 'regular' : 'all';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return 'Без срока';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function reportStatusBadge(status, statusLabel) {
  const meta = DAILY_REPORT_STATUS_META[status] || { label: statusLabel || status || 'На проверке', badgeClass: 'badge-gray' };
  return <span className={`badge ${meta.badgeClass}`}>{statusLabel || meta.label}</span>;
}

function detectTaskType(raw) {
  const title = String(raw?.title || '').toLowerCase();
  const description = String(raw?.description || '').toLowerCase();
  const combined = `${title} ${description}`;
  const isSystem =
    combined.includes('график работы') ||
    combined.includes('недельн') ||
    combined.includes('weekly plan');

  return {
    taskType: isSystem ? 'system' : 'regular',
    taskTypeLabel: isSystem ? 'План недели' : 'Обычная задача',
    systemBadge: isSystem ? 'Системная' : '',
    isSystem,
  };
}

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function normalizeTask(raw) {
  const taskTypeMeta = detectTaskType(raw);
  return {
    id: raw.id,
    title: raw.title || '',
    description: raw.description || '',
    assigneeId: raw.assignee || null,
    assigneeName: raw.assignee_username || (raw.assignee ? `ID ${raw.assignee}` : 'Без исполнителя'),
    reporterName: raw.reporter_username || '',
    dueDate: raw.due_date || null,
    priority: raw.priority || 'medium',
    status: raw.status || 'new',
    statusLabel: raw.status_label || '',
    isOverdue: Boolean(raw.is_overdue),
    canCompleteParent: Boolean(raw.can_complete_parent),
    isReadOnly: Boolean(raw.is_read_only),
    columnId: raw.column,
    columnOrder: Number(raw.column_order || 0),
    columnName: raw.column_name || '',
    boardColumns: Array.isArray(raw.board_columns) ? raw.board_columns : [],
    subtasks: Array.isArray(raw.subtasks) ? raw.subtasks : [],
    checklistItems: Array.isArray(raw.checklist_items) ? raw.checklist_items : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    ...taskTypeMeta,
    updatedAt: raw.updated_at,
  };
}

function normalizeTemplate(raw) {
  return {
    id: raw.id,
    title: raw.title || '',
    description: raw.description || '',
    defaultPriority: raw.default_priority || 'medium',
    isActive: raw.is_active !== false,
    subtasks: Array.isArray(raw.subtasks) ? raw.subtasks : [],
    checklistItems: Array.isArray(raw.checklist_items) ? raw.checklist_items : [],
    createdBy: raw.created_by_username || '',
  };
}

function normalizeReport(raw) {
  return {
    id: raw.id,
    username: raw.user_full_name || raw.username || '-',
    date: raw.report_date,
    started: raw.started_tasks || '',
    taken: raw.taken_tasks || '',
    completed: raw.completed_tasks || '',
    blockers: raw.blockers || '',
    summary: raw.summary || '',
    status: raw.status || 'SENT',
    statusLabel: raw.status_label || '',
    reviewComment: raw.review_comment || '',
    reviewedAt: raw.reviewed_at || null,
    reviewedByUsername: raw.reviewed_by_username || '',
    aiSummary: raw.ai_summary || '',
    aiAnalyzedAt: raw.ai_analyzed_at || null,
  };
}

export default function Tasks() {
  const { user } = useAuth();
  const role = user?.role;
  const canSeeTeamTasksSection = ['teamlead', 'department_head', 'admin', 'administrator', 'superadmin', 'projectmanager'].includes(role);
  const canSeeOwnTasksSection = role !== 'superadmin';
  const canSwitchTaskSections = canSeeTeamTasksSection;
  const [taskSection, setTaskSection] = useState(role === 'superadmin' ? 'team' : 'my');
  const canSubmitDaily = ['employee', 'teamlead'].includes(user?.role);
  const canViewDaily = ['teamlead', 'department_head', 'admin', 'administrator', 'superadmin', 'projectmanager'].includes(user?.role);
  const canReviewDaily = ['teamlead', 'department_head', 'admin', 'administrator', 'superadmin', 'systemadmin'].includes(user?.role);
  const canViewTeamList = ['teamlead', 'projectmanager', 'department_head', 'admin', 'administrator', 'superadmin'].includes(user?.role);

  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskComments, setTaskComments] = useState([]);
  const [taskHistory, setTaskHistory] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState(null);
  const [analyzingReportId, setAnalyzingReportId] = useState(null);
  const [dragTaskId, setDragTaskId] = useState(null);
  const [reportDate, setReportDate] = useState(todayISO());
  const [progressUser, setProgressUser] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assignee_id: '',
  });
  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    default_priority: 'medium',
    subtasks: [''],
    checklist_items: [''],
  });
  const [editingTemplateId, setEditingTemplateId] = useState(null);

  const [dailyForm, setDailyForm] = useState({
    started_tasks: '',
    taken_tasks: '',
    completed_tasks: '',
    blockers: '',
  });
  const [filters, setFilters] = useState({
    assignee: '',
    status: '',
    priority: '',
    taskType: getDefaultTaskType(role === 'superadmin' ? 'team' : 'my'),
    overdue: '',
    due_date_from: '',
    due_date_to: '',
  });

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const taskParams = Object.fromEntries(
        Object.entries(filters).filter(
          ([key, value]) => key !== 'taskType' && value !== '' && value !== null && value !== undefined
        )
      );
      const [myRes, teamRes, reportsRes, templatesRes] = await Promise.all([
        canSeeOwnTasksSection ? tasksAPI.my(taskParams).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        canSeeTeamTasksSection ? tasksAPI.team(taskParams).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        tasksAPI.dailyReports({ date: reportDate }).catch(() => ({ data: [] })),
        tasksAPI.templates().catch(() => ({ data: [] })),
      ]);

      const myTasks = Array.isArray(myRes.data) ? myRes.data : [];
      const teamTasks = Array.isArray(teamRes.data) ? teamRes.data : [];
      const selectedTasks = taskSection === 'team' ? teamTasks : myTasks;
      const byId = new Map();
      selectedTasks.forEach((t) => byId.set(t.id, normalizeTask(t)));
      setTasks(
        Array.from(byId.values()).sort((a, b) => {
          const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        })
      );

      const reportRows = Array.isArray(reportsRes.data) ? reportsRes.data : [];
      setReports(reportRows.map(normalizeReport));
      const templateRows = Array.isArray(templatesRes.data) ? templatesRes.data : [];
      setTemplates(templateRows.map(normalizeTemplate));
    } catch {
      setError('Не удалось загрузить задачи или отчеты.');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignees = async () => {
    try {
      const res = await tasksAPI.assignees();
      const list = Array.isArray(res.data) ? res.data : [];
      setAssigneeOptions(
        list.map((u) => ({
          id: u.id,
          name: u.full_name || u.username || `ID ${u.id}`,
          role: u.role || '',
        }))
      );
    } catch {
      const fallback = Array.from(
        new Map(
          tasks.map((task) => [task.assigneeId, { id: task.assigneeId, name: task.assigneeName, role: '' }])
        ).values()
      );
      setAssigneeOptions(fallback);
    }
  };

  useEffect(() => {
    loadAll();
    loadAssignees();
  }, []);

  useEffect(() => {
    setTaskSection(role === 'superadmin' ? 'team' : 'my');
  }, [role]);

  useEffect(() => {
    if (!showModal) return;
    setForm((prev) => ({
      ...prev,
      assignee_id: prev.assignee_id || user?.id || '',
    }));
  }, [showModal, user?.id]);

  useEffect(() => {
    loadAll();
  }, [reportDate, taskSection, filters]);

  useEffect(() => {
    setFilters((prev) => {
      const nextDefault = getDefaultTaskType(taskSection);
      if (!prev.taskType || prev.taskType === 'all' || prev.taskType === 'regular') {
        return {
          ...prev,
          taskType: nextDefault,
        };
      }
      return prev;
    });
  }, [taskSection]);

  const openTaskDetails = async (task) => {
    if (!task?.id) return;
    setSelectedTask(task);
    setCommentText('');
    setDetailLoading(true);
    try {
      const [commentsRes, historyRes, detailRes] = await Promise.all([
        tasksAPI.comments(task.id).catch(() => ({ data: [] })),
        tasksAPI.history(task.id).catch(() => ({ data: [] })),
        tasksAPI.detail(task.id).catch(() => ({ data: task })),
      ]);
      setTaskComments(Array.isArray(commentsRes.data) ? commentsRes.data : []);
      setTaskHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
      setSelectedTask(normalizeTask(detailRes.data || task));
    } catch {
      setError('Не удалось загрузить детали задачи.');
    } finally {
      setDetailLoading(false);
    }
  };

  const visibleTasks = useMemo(() => {
    if (!filters.taskType || filters.taskType === 'all') return tasks;
    return tasks.filter((task) => task.taskType === filters.taskType);
  }, [tasks, filters.taskType]);

  const hiddenSystemTasksCount = useMemo(
    () => (taskSection === 'team' && filters.taskType === 'regular' ? tasks.filter((task) => task.isSystem).length : 0),
    [taskSection, filters.taskType, tasks]
  );

  const columns = useMemo(() => {
    const map = new Map();
    DEFAULT_COLUMN_ORDERS.forEach((order) => {
      map.set(order, {
        order,
        id: null,
        name: DEFAULT_COLUMN_NAMES[order],
        items: [],
      });
    });

    visibleTasks.forEach((task) => {
      const order = task.columnOrder || 1;
      if (!map.has(order)) {
        map.set(order, {
          order,
          id: task.columnId,
          name: task.columnName || `Колонка ${order}`,
          items: [],
        });
      }
      const col = map.get(order);
      if (!col.id) col.id = task.columnId;
      if (task.columnName) col.name = task.columnName;
      col.items.push(task);
    });

    return Array.from(map.values())
      .sort((a, b) => a.order - b.order)
      .map((column) => ({
        ...column,
        items: [...column.items].sort((a, b) => {
          const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        }),
      }));
  }, [visibleTasks]);

  const taskSummary = useMemo(() => {
    const overdue = visibleTasks.filter((task) => task.isOverdue).length;
    const completed = visibleTasks.filter((task) => task.status === 'completed').length;
    const inProgress = visibleTasks.filter((task) => task.status === 'in_progress').length;
    const review = visibleTasks.filter((task) => task.status === 'review').length;
    const withAssignee = visibleTasks.filter((task) => task.assigneeId).length;
    const system = visibleTasks.filter((task) => task.isSystem).length;

    return {
      total: visibleTasks.length,
      overdue,
      completed,
      inProgress,
      review,
      withAssignee,
      system,
    };
  }, [visibleTasks]);

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => {
        if (value === '' || value === null || value === undefined) return false;
        if (key === 'taskType') return value !== getDefaultTaskType(taskSection);
        return true;
      }).length,
    [filters, taskSection]
  );

  const reportSummary = useMemo(() => {
    return reports.reduce((acc, report) => {
      acc.total += 1;
      if (report.status === 'ACCEPTED') acc.accepted += 1;
      else if (report.status === 'REVISION_REQUIRED') acc.revision += 1;
      else acc.sent += 1;
      return acc;
    }, { total: 0, sent: 0, accepted: 0, revision: 0 });
  }, [reports]);

  const resetFilters = () => {
    setFilters({
      assignee: '',
      status: '',
      priority: '',
      taskType: getDefaultTaskType(taskSection),
      overdue: '',
      due_date_from: '',
      due_date_to: '',
    });
  };

  const createTask = async () => {
    const title = form.title.trim();
    if (!title) return;
    try {
      const assigneeId = Number(form.assignee_id || user?.id);
      await tasksAPI.create({
        title,
        description: form.description.trim(),
        assignee_id: assigneeId,
        due_date: form.due_date || null,
        priority: form.priority,
      });
      setShowModal(false);
      setForm({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        assignee_id: '',
      });
      await loadAll();
    } catch {
      setError('Не удалось создать задачу.');
    }
  };

  const moveTask = async (task, targetOrder) => {
    if (!task || targetOrder === task.columnOrder) return;
    if (task.isReadOnly) {
      setError('Завершенную задачу может менять только администратор.');
      return;
    }
    const target = task.boardColumns.find((c) => Number(c.order) === Number(targetOrder));
    if (!target?.id) return;
    try {
      setMovingTaskId(task.id);
      await tasksAPI.move(task.id, target.id);
      await loadAll();
      if (selectedTask?.id === task.id) {
        await openTaskDetails({ ...task, columnOrder: targetOrder, columnId: target.id });
      }
    } catch {
      setError('Не удалось изменить статус задачи.');
    } finally {
      setMovingTaskId(null);
    }
  };

  const addComment = async () => {
    const text = commentText.trim();
    if (!selectedTask?.id || !text) return;
    try {
      await tasksAPI.addComment(selectedTask.id, { text });
      setCommentText('');
      await openTaskDetails(selectedTask);
    } catch {
      setError('Не удалось добавить комментарий.');
    }
  };

  const uploadAttachment = async (file) => {
    if (!selectedTask?.id || !file) return;
    try {
      setAttachmentUploading(true);
      await tasksAPI.uploadAttachment(selectedTask.id, file);
      await openTaskDetails(selectedTask);
    } catch {
      setError('Не удалось загрузить вложение. Проверьте размер файла и формат.');
    } finally {
      setAttachmentUploading(false);
    }
  };

  const deleteAttachment = async (attachmentId) => {
    if (!selectedTask?.id || !attachmentId) return;
    try {
      await tasksAPI.deleteAttachment(selectedTask.id, attachmentId);
      await openTaskDetails(selectedTask);
    } catch {
      setError('Не удалось удалить вложение.');
    }
  };

  const submitDailyReport = async () => {
    if (!canSubmitDaily) return;
    try {
      await tasksAPI.submitDailyReport({
        report_date: reportDate,
        ...dailyForm,
      });
      setDailyForm({ started_tasks: '', taken_tasks: '', completed_tasks: '', blockers: '' });
      await loadAll();
    } catch {
      setError('Не удалось отправить ежедневный отчет.');
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({ title: '', description: '', default_priority: 'medium', subtasks: [''], checklist_items: [''] });
    setEditingTemplateId(null);
  };

  const startEditTemplate = (template) => {
    setTemplateForm({
      title: template.title,
      description: template.description,
      default_priority: template.defaultPriority,
      subtasks: template.subtasks.map((s) => s.title).concat(['']),
      checklist_items: template.checklistItems.map((c) => c.text).concat(['']),
    });
    setEditingTemplateId(template.id);
  };

  const saveTemplate = async () => {
    const title = templateForm.title.trim();
    if (!title) return;
    const subtasks = templateForm.subtasks.map((s) => s.trim()).filter(Boolean).map((t) => ({ title: t }));
    const checklist_items = templateForm.checklist_items.map((c) => c.trim()).filter(Boolean).map((t) => ({ text: t }));
    try {
      if (editingTemplateId) {
        await tasksAPI.updateTemplate(editingTemplateId, {
          title,
          description: templateForm.description.trim(),
          default_priority: templateForm.default_priority,
          subtasks,
          checklist_items,
        });
      } else {
        await tasksAPI.createTemplate({
          title,
          description: templateForm.description.trim(),
          default_priority: templateForm.default_priority,
          subtasks,
          checklist_items,
        });
      }
      resetTemplateForm();
      await loadAll();
    } catch {
      setError('Не удалось сохранить шаблон задачи.');
    }
  };

  const deleteTemplate = async (templateId) => {
    try {
      await tasksAPI.deleteTemplate(templateId);
      await loadAll();
    } catch {
      setError('Не удалось удалить шаблон.');
    }
  };

  const applyTemplate = async (template) => {
    if (!template?.id) return;
    try {
      await tasksAPI.applyTemplate({
        template_id: template.id,
        assignee_id: Number(form.assignee_id || user?.id),
      });
      await loadAll();
    } catch {
      setError('Не удалось применить шаблон.');
    }
  };

  const handleDragStart = (task) => {
    if (task?.isReadOnly) return;
    setDragTaskId(task.id);
  };

  const handleDropToColumn = async (columnOrder) => {
    const task = tasks.find((item) => item.id === dragTaskId);
    setDragTaskId(null);
    if (!task) return;
    await moveTask(task, columnOrder);
  };

  const filterBadges = [
    filters.assignee &&
      `Исполнитель: ${filters.assignee === 'unassigned' ? 'Без исполнителя' : assigneeOptions.find((opt) => String(opt.id) === String(filters.assignee))?.name || filters.assignee}`,
    filters.status &&
      `Статус: ${
        {
          new: 'Новые',
          in_progress: 'В работе',
          review: 'На проверке',
          completed: 'Завершенные',
        }[filters.status] || filters.status
      }`,
    filters.priority && `Приоритет: ${PRIORITY_LABELS[filters.priority] || filters.priority}`,
    filters.taskType &&
      filters.taskType !== getDefaultTaskType(taskSection) &&
      `Тип: ${TASK_TYPE_LABELS[filters.taskType] || filters.taskType}`,
    filters.overdue && `Просрочка: ${filters.overdue === 'true' ? 'Только просроченные' : 'Без просроченных'}`,
    filters.due_date_from && `Срок от: ${filters.due_date_from}`,
    filters.due_date_to && `Срок до: ${filters.due_date_to}`,
  ].filter(Boolean);

  const reviewDailyReport = async (report, status) => {
    if (!canReviewDaily || !report?.id) return;
    let review_comment = '';
    if (status === 'REVISION_REQUIRED') {
      review_comment = String(window.prompt('Комментарий для сотрудника (обязательно):', report.reviewComment || '') || '').trim();
      if (!review_comment) {
        setError('Комментарий обязателен для статуса "Нужны правки".');
        return;
      }
    }

    try {
      await tasksAPI.reviewDailyReport(report.id, { status, review_comment });
      await loadAll();
    } catch {
      setError('Не удалось выполнить ревью ежедневного отчета.');
    }
  };

  const analyzeReport = async (report) => {
    if (!report?.id || analyzingReportId === report.id) return;
    setAnalyzingReportId(report.id);
    setError('');
    try {
      const res = await tasksAPI.analyzeReport(report.id);
      const updated = normalizeReport(res.data);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Не удалось выполнить AI-анализ.';
      setError(msg);
    } finally {
      setAnalyzingReportId(null);
    }
  };

  const openProgress = async (person) => {
    if (!person?.id) return;
    setProgressUser(person);
    setProgressLoading(true);
    try {
      const res = await onboardingAPI.getInternProgress(person.id);
      setProgressData(res.data || null);
    } catch {
      setProgressData(null);
      setError('Не удалось загрузить прогресс стажера.');
    } finally {
      setProgressLoading(false);
    }
  };

  const internRoleByData = String(progressData?.user?.role || '').toLowerCase();
  const internRoleByCard = String(progressUser?.role || '').toLowerCase();
  const isInternMember = internRoleByData.includes('intern') || internRoleByCard.includes('intern');
  const completedDays = Number(progressData?.overview?.completed_days || 0);
  const totalDays = Number(progressData?.overview?.total_days || 0);
  const progressPercent = totalDays > 0 ? Math.min(100, Math.round((completedDays / totalDays) * 100)) : 0;

  return (
    <MainLayout title="Задачи">
      <div className="page-header">
        <div>
          <div className="page-title">Трекер задач</div>
          <div className="page-subtitle">Понятный обзор задач, быстрые фильтры и детали без лишних переходов</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} /> Новая задача</button>
      </div>

      {canSwitchTaskSections && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {canSeeOwnTasksSection && (
            <button
              type="button"
              className={`btn btn-sm ${taskSection === 'my' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTaskSection('my')}
            >
              Мои задачи
            </button>
          )}
          {canSeeTeamTasksSection && (
            <button
              type="button"
              className={`btn btn-sm ${taskSection === 'team' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTaskSection('team')}
            >
              Задачи сотрудников
            </button>
          )}
        </div>
      )}

      {canViewTeamList && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Моя команда</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {assigneeOptions.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => openProgress(person)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Eye size={13} /> {person.name}
                </button>
              ))}
              {assigneeOptions.length === 0 && (
                <span style={{ color: 'var(--gray-500)', fontSize: 13 }}>Подчиненные пока не найдены.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {error ? <div className="card" style={{ marginBottom: 12 }}><div className="card-body" style={{ color: 'var(--danger)' }}>{error}</div></div> : null}

      <div className="tasks-summary-grid">
        <div className="task-summary-card">
          <div className="task-summary-label">Всего задач</div>
          <div className="task-summary-value">{taskSummary.total}</div>
          <div className="task-summary-note">{taskSection === 'team' ? 'по сотрудникам' : 'в личной доске'}</div>
        </div>
        <div className="task-summary-card">
          <div className="task-summary-label">В работе</div>
          <div className="task-summary-value">{taskSummary.inProgress}</div>
          <div className="task-summary-note">На проверке: {taskSummary.review}</div>
        </div>
        <div className={`task-summary-card ${taskSummary.overdue ? 'is-alert' : ''}`}>
          <div className="task-summary-label">Нужны внимание</div>
          <div className="task-summary-value">{taskSummary.overdue}</div>
          <div className="task-summary-note">Просроченные задачи</div>
        </div>
        <div className="task-summary-card">
          <div className="task-summary-label">Назначены</div>
          <div className="task-summary-value">{taskSummary.withAssignee}</div>
          <div className="task-summary-note">Системных: {taskSummary.system}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body task-filters-card">
          <div className="task-filters-header">
            <div>
              <div className="task-section-title"><ListFilter size={16} /> Фильтры задач</div>
              <div className="task-section-subtitle">
                {activeFilterCount ? `Активно фильтров: ${activeFilterCount}` : 'Показываем все доступные задачи'}
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters} disabled={!activeFilterCount}>
              Сбросить
            </button>
          </div>
          <div className="grid-2">
            {taskSection === 'team' ? (
              <div className="form-group">
                <label className="form-label">Исполнитель</label>
                <select className="form-select" value={filters.assignee} onChange={(e) => setFilters((prev) => ({ ...prev, assignee: e.target.value }))}>
                  <option value="">Все</option>
                  <option value="unassigned">Без исполнителя</option>
                  {assigneeOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>
            ) : <div />}
            <div className="form-group">
              <label className="form-label">Статус</label>
              <select className="form-select" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">Все</option>
                <option value="new">Новые</option>
                <option value="in_progress">В работе</option>
                <option value="review">На проверке</option>
                <option value="completed">Завершенные</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Приоритет</label>
              <select className="form-select" value={filters.priority} onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}>
                <option value="">Все</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Тип задачи</label>
              <select className="form-select" value={filters.taskType} onChange={(e) => setFilters((prev) => ({ ...prev, taskType: e.target.value }))}>
                <option value="all">Все</option>
                <option value="regular">Обычные</option>
                <option value="system">Системные</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Просрочка</label>
              <select className="form-select" value={filters.overdue} onChange={(e) => setFilters((prev) => ({ ...prev, overdue: e.target.value }))}>
                <option value="">Все</option>
                <option value="true">Только просроченные</option>
                <option value="false">Без просроченных</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Срок от</label>
              <input className="form-input" type="date" value={filters.due_date_from} onChange={(e) => setFilters((prev) => ({ ...prev, due_date_from: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Срок до</label>
              <input className="form-input" type="date" value={filters.due_date_to} onChange={(e) => setFilters((prev) => ({ ...prev, due_date_to: e.target.value }))} />
            </div>
          </div>
          {filterBadges.length > 0 ? (
            <div className="task-filter-badges">
              {filterBadges.map((badge) => (
                <span key={badge} className="task-filter-badge">{badge}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="card"><div className="card-body">Загрузка...</div></div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <div style={{ fontWeight: 700 }}>Шаблоны задач</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14 }}>
                {/* Form */}
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)' }}>
                    {editingTemplateId ? 'Редактирование шаблона' : 'Новый шаблон'}
                  </div>
                  <input
                    className="form-input"
                    placeholder="Название шаблона"
                    value={templateForm.title}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, title: e.target.value }))}
                  />
                  <textarea
                    className="form-textarea"
                    placeholder="Описание шаблона"
                    rows={2}
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))}
                  />
                  <select
                    className="form-select"
                    value={templateForm.default_priority}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, default_priority: e.target.value }))}
                  >
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                    <option value="critical">Критический</option>
                  </select>

                  {/* Subtasks */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)' }}>Подзадачи</div>
                  {templateForm.subtasks.map((val, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="form-input"
                        placeholder={`Подзадача ${idx + 1}`}
                        value={val}
                        onChange={(e) => {
                          const next = [...templateForm.subtasks];
                          next[idx] = e.target.value;
                          setTemplateForm((p) => ({ ...p, subtasks: next }));
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0 8px', flexShrink: 0 }}
                        onClick={() => {
                          const next = templateForm.subtasks.filter((_, i) => i !== idx);
                          setTemplateForm((p) => ({ ...p, subtasks: next.length ? next : [''] }));
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => setTemplateForm((p) => ({ ...p, subtasks: [...p.subtasks, ''] }))}
                  >
                    + Добавить подзадачу
                  </button>

                  {/* Checklist */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)' }}>Чек-лист</div>
                  {templateForm.checklist_items.map((val, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="form-input"
                        placeholder={`Пункт ${idx + 1}`}
                        value={val}
                        onChange={(e) => {
                          const next = [...templateForm.checklist_items];
                          next[idx] = e.target.value;
                          setTemplateForm((p) => ({ ...p, checklist_items: next }));
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0 8px', flexShrink: 0 }}
                        onClick={() => {
                          const next = templateForm.checklist_items.filter((_, i) => i !== idx);
                          setTemplateForm((p) => ({ ...p, checklist_items: next.length ? next : [''] }));
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => setTemplateForm((p) => ({ ...p, checklist_items: [...p.checklist_items, ''] }))}
                  >
                    + Добавить пункт чек-листа
                  </button>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" type="button" onClick={saveTemplate}>
                      {editingTemplateId ? 'Сохранить изменения' : 'Создать шаблон'}
                    </button>
                    {editingTemplateId && (
                      <button className="btn btn-secondary" type="button" onClick={resetTemplateForm}>
                        Отмена
                      </button>
                    )}
                  </div>
                </div>

                {/* Template list */}
                <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                  {templates.map((template) => (
                    <div key={template.id} className="card" style={{ border: `1px solid ${editingTemplateId === template.id ? 'var(--blue-400)' : 'var(--gray-200)'}` }}>
                      <div className="card-body" style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{template.title}</div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <span className="badge badge-blue">{PRIORITY_LABELS[template.defaultPriority] || template.defaultPriority}</span>
                            {!template.isActive && <span className="badge badge-gray">Неактивен</span>}
                          </div>
                        </div>
                        {template.description && (
                          <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{template.description}</div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Автор: {template.createdBy || '-'}</div>
                        {template.subtasks.length > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--gray-700)' }}>
                            <span style={{ fontWeight: 600 }}>Подзадачи:</span>{' '}
                            {template.subtasks.map((item) => item.title).join(', ')}
                          </div>
                        )}
                        {template.checklistItems.length > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--gray-700)' }}>
                            <span style={{ fontWeight: 600 }}>Чек-лист:</span>{' '}
                            {template.checklistItems.map((item) => item.text).join(', ')}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" type="button" onClick={() => applyTemplate(template)}>
                            Применить
                          </button>
                          <button className="btn btn-secondary btn-sm" type="button" onClick={() => startEditTemplate(template)}>
                            Изменить
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            style={{ color: 'var(--red-600)' }}
                            onClick={() => deleteTemplate(template.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {templates.length === 0 && (
                    <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>Шаблонов пока нет.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="task-board-shell">
            <div className="task-board-heading">
              <div>
                <div className="task-section-title">Доска задач</div>
                <div className="task-section-subtitle">Перетаскивайте карточки между колонками или меняйте статус кнопками на карточке</div>
              </div>
            <div className="task-board-hint">Клик по карточке открывает полные детали, комментарии и историю</div>
          </div>
          {hiddenSystemTasksCount > 0 ? (
            <div className="task-board-callout">
              Системные задачи скрыты по умолчанию в командной доске: {hiddenSystemTasksCount}. Переключите фильтр "Тип задачи" на "Все" или "Системные".
            </div>
          ) : null}

            <div className="kanban-board">
              {columns.map((column) => (
                <div
                  key={column.order}
                  className="kanban-col"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropToColumn(column.order)}
                >
                  <div className="kanban-col-header">
                    <div>
                      <span className="kanban-col-title">{column.name}</span>
                      <div className="kanban-col-subtitle">
                        {column.order === 1 && 'Новые входящие задачи'}
                        {column.order === 2 && 'Активная работа'}
                        {column.order === 3 && 'Ожидают проверки'}
                        {column.order === 4 && 'Закрытые задачи'}
                      </div>
                    </div>
                    <span className="badge badge-blue">{column.items.length}</span>
                  </div>
                  {(taskSection === 'team'
                    ? Object.entries(
                        column.items.reduce((acc, task) => {
                          const key = task.assigneeName || 'Без исполнителя';
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(task);
                          return acc;
                        }, {})
                      ).sort(([leftName], [rightName]) => leftName.localeCompare(rightName, 'ru'))
                    : [['', column.items]]
                  ).map(([groupName, groupedTasks]) => (
                    <div key={`${column.order}-${groupName || 'default'}`} className="task-group-block">
                      {taskSection === 'team' && groupName ? (
                        <div className="task-group-header">
                          <span className="task-group-name">{groupName}</span>
                          <span className="task-group-count">{groupedTasks.length}</span>
                        </div>
                      ) : null}
                      {groupedTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`kanban-card ${task.isSystem ? 'is-system-task' : ''}`}
                          draggable={!task.isReadOnly}
                          onDragStart={() => handleDragStart(task)}
                          onDragEnd={() => setDragTaskId(null)}
                          style={{
                            border: task.isOverdue ? '1px solid var(--danger)' : undefined,
                            opacity: movingTaskId === task.id ? 0.6 : 1,
                            cursor: 'pointer',
                          }}
                          onClick={() => openTaskDetails(task)}
                        >
                          <div className="kanban-card-top">
                            <span className="task-assignee-banner"><UserRound size={13} /> {task.assigneeName}</span>
                            <span className={`task-status-pill ${task.isOverdue ? 'is-overdue' : ''}`}>
                              {task.isOverdue ? 'Просрочена' : (task.statusLabel || task.status)}
                            </span>
                          </div>
                          <div className="task-card-badges">
                            <span className={`task-priority-pill priority-${task.priority}`}>{PRIORITY_LABELS[task.priority] || task.priority}</span>
                            {task.isSystem ? <span className="task-system-badge">{task.systemBadge}</span> : null}
                            {task.isSystem ? <span className="task-type-badge">{task.taskTypeLabel}</span> : null}
                          </div>
                          <div className="kanban-card-title">{task.title}</div>
                          <div className="kanban-card-description">{task.description || 'Без описания'}</div>
                          <div className="task-meta-list">
                            <div className="task-meta-item"><MessageSquareText size={13} /> {task.reporterName || 'Без постановщика'}</div>
                            <div className={`task-meta-item ${task.isOverdue ? 'is-overdue' : ''}`}><CalendarDays size={13} /> {formatDate(task.dueDate)}</div>
                          </div>
                          {task.subtasks.length > 0 && (
                            <div className="task-inline-note">
                              Подзадачи: {task.subtasks.length}
                            </div>
                          )}
                          {task.checklistItems.length > 0 && (
                            <div className="task-inline-note">
                              Чек-лист: {task.checklistItems.length}
                            </div>
                          )}
                          {task.canCompleteParent ? (
                            <div className="task-inline-note is-success">
                              Все подзадачи выполнены — можно завершить основную задачу.
                            </div>
                          ) : null}
                          {task.isReadOnly ? (
                            <div className="task-inline-note">
                              Редактирование закрыто для завершенной задачи.
                            </div>
                          ) : null}
                          <div className="task-move-actions">
                            {DEFAULT_COLUMN_ORDERS.map((order) => (
                              <button
                                key={`${task.id}-${order}`}
                                className="btn btn-secondary btn-sm"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveTask(task, order);
                                }}
                                disabled={movingTaskId === task.id || order === task.columnOrder || task.isReadOnly}
                              >
                                {DEFAULT_COLUMN_NAMES[order]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {column.items.length === 0 ? <div className="kanban-empty-state">Пока пусто</div> : null}
                </div>
              ))}
            </div>
          </div>

          {canSubmitDaily && (!canSwitchTaskSections || taskSection === 'my') && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontWeight: 700 }}>Ежедневный отчет</div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Дата</label>
                    <input className="form-input" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
                  </div>
                </div>
                <textarea className="form-textarea" placeholder="Что начал" value={dailyForm.started_tasks} onChange={(e) => setDailyForm((p) => ({ ...p, started_tasks: e.target.value }))} />
                <textarea className="form-textarea" placeholder="Что взял в работу" value={dailyForm.taken_tasks} onChange={(e) => setDailyForm((p) => ({ ...p, taken_tasks: e.target.value }))} />
                <textarea className="form-textarea" placeholder="Что завершил" value={dailyForm.completed_tasks} onChange={(e) => setDailyForm((p) => ({ ...p, completed_tasks: e.target.value }))} />
                <textarea className="form-textarea" placeholder="Проблемы / блокеры" value={dailyForm.blockers} onChange={(e) => setDailyForm((p) => ({ ...p, blockers: e.target.value }))} />
                <div>
                  <button className="btn btn-primary" onClick={submitDailyReport}>Отправить отчет</button>
                </div>
              </div>
            </div>
          )}

          {canViewDaily && canSwitchTaskSections && taskSection === 'team' && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-body">
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Отчеты сотрудников за {reportDate}</div>
                <div className="daily-report-summary">
                  <div className="daily-report-summary-card">
                    <span>Всего</span>
                    <strong>{reportSummary.total}</strong>
                  </div>
                  <div className="daily-report-summary-card">
                    <span>На проверке</span>
                    <strong>{reportSummary.sent}</strong>
                  </div>
                  <div className="daily-report-summary-card">
                    <span>Приняты</span>
                    <strong>{reportSummary.accepted}</strong>
                  </div>
                  <div className="daily-report-summary-card is-alert">
                    <span>Нужны правки</span>
                    <strong>{reportSummary.revision}</strong>
                  </div>
                </div>

                <div className="daily-report-grid">
                  {reports.map((r) => (
                    <div key={r.id} className="daily-report-card">
                      <div className="daily-report-card__top">
                        <div>
                          <div className="daily-report-card__name">{r.username}</div>
                          <div className="daily-report-card__meta">{r.date || reportDate}</div>
                        </div>
                        {reportStatusBadge(r.status, r.statusLabel)}
                      </div>

                      <div className="daily-report-card__sections">
                        <div className="daily-report-card__section">
                          <span>Начал</span>
                          <p>{r.started || '—'}</p>
                        </div>
                        <div className="daily-report-card__section">
                          <span>Взял в работу</span>
                          <p>{r.taken || '—'}</p>
                        </div>
                        <div className="daily-report-card__section">
                          <span>Завершил</span>
                          <p>{r.completed || '—'}</p>
                        </div>
                        <div className="daily-report-card__section">
                          <span>Блокеры</span>
                          <p>{r.blockers || '—'}</p>
                        </div>
                      </div>

                      {r.reviewComment ? (
                        <div className="daily-report-card__review">
                          <strong>Комментарий ревью</strong>
                          <p>{r.reviewComment}</p>
                          {(r.reviewedByUsername || r.reviewedAt) ? (
                            <div className="daily-report-card__review-meta">
                              {r.reviewedByUsername || 'Проверяющий'}{r.reviewedAt ? ` · ${formatDateTime(r.reviewedAt)}` : ''}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {r.aiSummary ? (
                        <div style={{
                          margin: '8px 0',
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                          border: '1px solid #bfdbfe',
                          fontSize: 13,
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: 6, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
                            ✨ AI-анализ
                            {r.aiAnalyzedAt && (
                              <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>
                                · {formatDateTime(r.aiAnalyzedAt)}
                              </span>
                            )}
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', color: '#1e293b', lineHeight: 1.5 }}>{r.aiSummary}</div>
                        </div>
                      ) : null}

                      <div className="daily-report-card__actions">
                        {canReviewDaily ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => reviewDailyReport(r, 'ACCEPTED')}
                              disabled={r.status === 'ACCEPTED'}
                            >
                              Принять
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => reviewDailyReport(r, 'REVISION_REQUIRED')}
                            >
                              Нужны правки
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => analyzeReport(r)}
                              disabled={analyzingReportId === r.id}
                              style={{ color: '#2563eb' }}
                            >
                              {analyzingReportId === r.id ? '⏳ Анализирую...' : '✨ AI-анализ'}
                            </button>
                          </>
                        ) : (
                          <span style={{ color: 'var(--gray-500)', fontSize: 12 }}>Режим просмотра</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {reports.length === 0 && (
                    <div className="kanban-empty-state">Отчетов за этот день пока нет.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showModal ? (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title">Новая задача</div>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Название</label>
                <input className="form-input" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Описание</label>
                <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="grid-2" style={{ marginBottom: 12 }}>
                {canSeeTeamTasksSection ? (
                  <div className="form-group">
                    <label className="form-label">Исполнитель</label>
                    <select className="form-select" value={form.assignee_id || user?.id || ''} onChange={(e) => setForm((prev) => ({ ...prev, assignee_id: e.target.value }))}>
                      {assigneeOptions.length === 0 ? <option value={user?.id || ''}>Я</option> : null}
                      {assigneeOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Исполнитель</label>
                    <input className="form-input" value={user?.name || user?.username || 'Я'} disabled />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Приоритет</label>
                  <select className="form-select" value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}>
                    <option value="critical">Критический</option>
                    <option value="high">Высокий</option>
                    <option value="medium">Средний</option>
                    <option value="low">Низкий</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Срок</label>
                <input className="form-input" type="date" value={form.due_date} onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={createTask}>Создать</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedTask ? (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal task-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{selectedTask.title}</div>
              <button className="btn-icon" onClick={() => setSelectedTask(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div>Загрузка...</div>
              ) : (
                <div className="task-detail-layout">
                  <div className="task-detail-main">
                    <div className="task-detail-summary">
                      <span className={`task-priority-pill priority-${selectedTask.priority}`}>{PRIORITY_LABELS[selectedTask.priority] || selectedTask.priority}</span>
                      <span className={`task-status-pill ${selectedTask.isOverdue ? 'is-overdue' : ''}`}>
                        {selectedTask.isOverdue ? 'Просрочена' : (selectedTask.statusLabel || selectedTask.status)}
                      </span>
                    </div>
                    <div className="task-detail-description">{selectedTask.description || 'Без описания'}</div>
                    <div className="task-detail-facts">
                      <div className="task-detail-fact"><span>Исполнитель</span><strong>{selectedTask.assigneeName}</strong></div>
                      <div className="task-detail-fact"><span>Постановщик</span><strong>{selectedTask.reporterName || '-'}</strong></div>
                      <div className="task-detail-fact"><span>Срок</span><strong>{selectedTask.dueDate || '—'}</strong></div>
                      <div className="task-detail-fact"><span>Подзадачи</span><strong>{selectedTask.subtasks.length}</strong></div>
                    </div>
                    {selectedTask.subtasks.length > 0 ? (
                      <div className="task-detail-panel">
                        <div className="task-detail-panel-title">Подзадачи</div>
                        <div className="task-detail-chip-list">
                          {selectedTask.subtasks.map((item) => (
                            <span key={item.id || item.title} className="task-detail-chip">{item.title}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedTask.checklistItems.length > 0 ? (
                      <div className="task-detail-panel">
                        <div className="task-detail-panel-title">Чек-лист</div>
                        <div className="task-detail-chip-list">
                          {selectedTask.checklistItems.map((item) => (
                            <span key={item.id || item.text} className="task-detail-chip">{item.text}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="task-detail-panel">
                      <div className="task-detail-panel-title">Вложения</div>
                      <div className="task-detail-scroll">
                        {(selectedTask.attachments || []).map((item) => (
                          <div key={item.id} className="task-detail-entry">
                            <div className="task-detail-entry-title">
                              <a href={item.file_url || item.file} target="_blank" rel="noreferrer">{item.filename || 'Файл'}</a>
                            </div>
                            <div className="task-detail-entry-meta">
                              {item.uploaded_by_username || 'Пользователь'} • {item.uploaded_at}
                            </div>
                            <div className="task-detail-entry-body">
                              Размер: {item.size ? `${Math.max(1, Math.round(item.size / 1024))} KB` : '—'}
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <button className="btn btn-secondary btn-sm" type="button" onClick={() => deleteAttachment(item.id)}>
                                Удалить
                              </button>
                            </div>
                          </div>
                        ))}
                        {(selectedTask.attachments || []).length === 0 ? <div className="task-detail-empty">Вложений пока нет.</div> : null}
                      </div>
                      <input
                        className="form-input"
                        type="file"
                        style={{ marginTop: 8 }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadAttachment(file);
                          e.target.value = '';
                        }}
                        disabled={attachmentUploading}
                      />
                      <div className="task-section-subtitle">До 10MB. Запрещены: .exe, .bat, .sh</div>
                    </div>
                  </div>
                  <div className="task-detail-side">
                    <div className="task-detail-panel">
                      <div className="task-detail-panel-title">Комментарии</div>
                      <div className="task-detail-scroll">
                        {taskComments.map((item) => (
                          <div key={item.id} className="task-detail-entry">
                            <div className="task-detail-entry-title">{item.author_username || 'Пользователь'}</div>
                            <div className="task-detail-entry-meta">{item.created_at}</div>
                            <div className="task-detail-entry-body">{item.text}</div>
                          </div>
                        ))}
                        {taskComments.length === 0 ? <div className="task-detail-empty">Комментариев пока нет.</div> : null}
                      </div>
                      <textarea
                        className="form-textarea"
                        style={{ marginTop: 8 }}
                        placeholder="Добавить комментарий"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                      />
                      <button className="btn btn-primary" type="button" onClick={addComment}>Отправить комментарий</button>
                    </div>
                    <div className="task-detail-panel">
                      <div className="task-detail-panel-title">История изменений</div>
                      <div className="task-detail-scroll is-tall">
                        {taskHistory.map((item) => (
                          <div key={item.id} className="task-detail-entry">
                            <div className="task-detail-entry-title">{item.action}</div>
                            <div className="task-detail-entry-meta">{item.actor_username || 'Система'} • {item.created_at}</div>
                            <div className="task-detail-entry-body">{item.field_name ? `${item.field_name}: ` : ''}{item.old_value ? `${item.old_value} → ` : ''}{item.new_value || '—'}</div>
                          </div>
                        ))}
                        {taskHistory.length === 0 ? <div className="task-detail-empty">История пока пуста.</div> : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {progressUser ? (
        <div className="modal-overlay" onClick={() => setProgressUser(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Прогресс: {progressUser.name}</div>
              <button className="btn-icon" onClick={() => setProgressUser(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {progressLoading ? (
                <div>Загрузка...</div>
              ) : (
                <>
                  {isInternMember ? (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 8 }}>
                        День: {progressData?.overview?.current_day_number || '-'} | Выполнено: {completedDays}/{totalDays}
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                          Прогресс стажировки: {progressPercent}%
                        </div>
                        <div style={{ height: 10, borderRadius: 999, background: 'var(--gray-200)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${progressPercent}%`,
                              height: '100%',
                              background: 'var(--primary)',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Регламенты</div>
                      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8, padding: 8, marginBottom: 10 }}>
                        {(progressData?.regulations || []).map((item) => (
                          <div key={item.id} style={{ fontSize: 12, marginBottom: 6 }}>
                            День {item.day_number} • {item.title} • шаг: {item.step} • тест: {item.quiz_score}/{item.quiz_total}
                          </div>
                        ))}
                        {(progressData?.regulations || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Нет данных.</div>}
                      </div>
                    </>
                  ) : null}
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Задачи</div>
                  <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8, padding: 8 }}>
                    {(progressData?.tasks || []).map((item) => (
                      <div key={item.id} style={{ fontSize: 12, marginBottom: 6 }}>
                        {item.title} • {item.column}
                      </div>
                    ))}
                    {(progressData?.tasks || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Нет задач.</div>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
}
