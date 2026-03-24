import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { tasksAPI } from '../../api/content';

const PRIORITY_LABELS = {
  critical: 'Критический',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_LABELS = {
  to_do: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Выполнено',
  blocked: 'Заблокировано',
};

const ROLE_LABELS = {
  projectmanager: 'Тимлид',
  department_head: 'Руководитель',
  admin: 'Админ',
  superadmin: 'Суперадмин',
  employee: 'Сотрудник',
  intern: 'Стажер',
};

const PROJECT_STATUS_LABELS = {
  planning: 'Запланирован',
  active: 'Активный',
  on_hold: 'На паузе',
  completed: 'Завершён',
  archived: 'В архиве',
};

const PROJECT_STATUS_TONES = {
  planning: 'badge-gray',
  active: 'badge-blue',
  on_hold: 'badge-red',
  completed: 'badge-green',
  archived: 'badge-gray',
};

const DEFAULT_COLUMN_ORDERS = [1, 2, 3, 4, 5];
const DEFAULT_COLUMN_NAMES = {
  1: 'К выполнению',
  2: 'В работе',
  3: 'На проверке',
  4: 'Выполнено',
  5: 'Заблокировано',
};

function formatDisplayDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ru-RU');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildProjectReportDocumentHtml(project, report) {
  const memberList = (project?.members || [])
    .map((member) => `<span class="chip">${escapeHtml((member.full_name || member.username) + (member.roleLabel ? ` • ${member.roleLabel}` : ''))}</span>`)
    .join('');

  const statusRows = [
    ['К выполнению', report.statusCounts.to_do],
    ['В работе', report.statusCounts.in_progress],
    ['На проверке', report.statusCounts.review],
    ['Выполнено', report.statusCounts.done],
    ['Заблокировано', report.statusCounts.blocked],
  ]
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join('');

  const assigneeRows = (report.assigneeStats || [])
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.total)}</td>
          <td>${escapeHtml(item.done)}</td>
          <td>${escapeHtml(item.inProgress)}</td>
          <td>${escapeHtml(item.review)}</td>
          <td>${escapeHtml(item.progress)}%</td>
        </tr>
      `,
    )
    .join('');

  const overdueRows = (report.overdueTasks || [])
    .map(
      (task) => `
        <tr>
          <td>${escapeHtml(task.title)}</td>
          <td>${escapeHtml(task.assigneeUsername)}</td>
          <td>${escapeHtml(task.statusLabel)}</td>
          <td>${escapeHtml(formatDisplayDate(task.dueDate))}</td>
        </tr>
      `,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(project?.name || 'Отчет по проекту')}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #182033; margin: 32px; }
    .hero { background: linear-gradient(135deg, #eaf2ff, #f7fbff); border: 1px solid #d9e6ff; border-radius: 22px; padding: 28px; margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .subtitle { color: #62708a; font-size: 14px; }
    .grid { width: 100%; border-collapse: separate; border-spacing: 12px; margin: 12px 0 20px; }
    .card { border: 1px solid #e3e8f2; border-radius: 18px; padding: 16px; background: #fff; }
    .card-label { color: #667085; font-size: 12px; margin-bottom: 6px; }
    .card-value { font-size: 22px; font-weight: 700; }
    .section { margin-top: 24px; }
    .section h2 { font-size: 18px; margin: 0 0 12px; }
    .chips { margin-top: 8px; }
    .chip { display: inline-block; margin: 0 8px 8px 0; padding: 8px 12px; border-radius: 999px; background: #eef3ff; color: #2f4ea6; font-size: 12px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #edf1f7; padding: 10px 8px; text-align: left; font-size: 13px; }
    th { color: #667085; font-weight: 700; }
    .progress-wrap { margin-top: 8px; }
    .progress-bar { width: 100%; height: 10px; background: #edf2f7; border-radius: 999px; overflow: hidden; }
    .progress-bar > div { width: ${Math.max(0, Math.min(report.progressPercentage, 100))}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #60a5fa); }
    .empty { color: #98a2b3; font-size: 13px; }
  </style>
</head>
<body>
  <div class="hero">
    <h1>${escapeHtml(project?.name || 'Без названия')}</h1>
    <div class="subtitle">${escapeHtml(project?.description || 'Описание проекта пока не заполнено')}</div>
  </div>

  <table class="grid">
    <tr>
      <td class="card">
        <div class="card-label">Ответственный</div>
        <div class="card-value">${escapeHtml(project?.responsibleUserName || '—')}</div>
      </td>
      <td class="card">
        <div class="card-label">Статус проекта</div>
        <div class="card-value">${escapeHtml(project?.statusLabel || '—')}</div>
      </td>
      <td class="card">
        <div class="card-label">Дата создания</div>
        <div class="card-value">${escapeHtml(formatDisplayDate(project?.createdAt))}</div>
      </td>
      <td class="card">
        <div class="card-label">Дата завершения</div>
        <div class="card-value">${escapeHtml(formatDisplayDate(project?.endDate))}</div>
      </td>
    </tr>
  </table>

  <div class="section">
    <h2>В команде</h2>
    <div class="chips">${memberList || '<span class="empty">Участники не добавлены</span>'}</div>
  </div>

  <div class="section">
    <h2>Насколько проект готов</h2>
    <table>
      <tr><th>Показатель</th><th>Значение</th></tr>
      <tr><td>Общее количество задач</td><td>${escapeHtml(report.totalTaskCount)}</td></tr>
      <tr><td>Процент выполнения</td><td>${escapeHtml(report.progressPercentage)}%</td></tr>
      <tr><td>Просроченные задачи</td><td>${escapeHtml(report.overdueTaskCount)}</td></tr>
    </table>
    <div class="progress-wrap">
      <div class="progress-bar"><div></div></div>
    </div>
  </div>

  <div class="section">
    <h2>Задачи по статусам</h2>
    <table>
      <tr><th>Статус</th><th>Количество</th></tr>
      ${statusRows}
    </table>
  </div>

  <div class="section">
    <h2>Эффективность членов команды</h2>
    ${
      assigneeRows
        ? `<table>
            <tr>
              <th>Участник</th>
              <th>Всего задач</th>
              <th>Выполнено</th>
              <th>В работе</th>
              <th>На проверке</th>
              <th>Прогресс</th>
            </tr>
            ${assigneeRows}
          </table>`
        : '<div class="empty">Нет данных по участникам проекта.</div>'
    }
  </div>

  <div class="section">
    <h2>Просроченные задачи</h2>
    ${
      overdueRows
        ? `<table>
            <tr>
              <th>Задача</th>
              <th>Исполнитель</th>
              <th>Статус</th>
              <th>Срок</th>
            </tr>
            ${overdueRows}
          </table>`
        : '<div class="empty">Просроченных задач нет.</div>'
    }
  </div>
</body>
</html>`;
}

function downloadProjectReportDocument(project, report) {
  const html = buildProjectReportDocumentHtml(project, report);
  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (project?.name || 'project-report').replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'project-report';
  link.href = url;
  link.download = `${safeName}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeTask(raw) {
  return {
    id: raw.id,
    title: raw.title || '',
    description: raw.description || '',
    assigneeId: raw.assignee,
    assigneeName: raw.assignee_display || raw.assignee_username || 'Без исполнителя',
    reporterName: raw.reporter_username || '',
    dueDate: raw.due_date || null,
    priority: raw.priority || 'medium',
    priorityLabel: raw.priority_label || PRIORITY_LABELS[raw.priority] || raw.priority,
    status: raw.status || 'to_do',
    isOverdue: Boolean(raw.is_overdue),
    columnId: raw.column,
    columnOrder: Number(raw.column_order || 0),
    columnName: raw.column_name || '',
    boardId: raw.board,
    boardName: raw.board_name || '',
    boardColumns: Array.isArray(raw.board_columns) ? raw.board_columns : [],
    subtasksTotal: Number(raw.subtasks_total || 0),
    subtasksCompleted: Number(raw.subtasks_completed || 0),
    checklistTotal: Number(raw.checklist_total || 0),
    checklistCompleted: Number(raw.checklist_completed || 0),
    completionPercentage: Number(raw.completion_percentage || 0),
    canCompleteParent: Boolean(raw.can_complete_parent),
    updatedAt: raw.updated_at,
  };
}

function normalizeSubtask(raw) {
  return {
    id: raw.id,
    title: raw.title || '',
    isCompleted: Boolean(raw.is_completed),
    createdBy: raw.created_by_username || '',
  };
}

function normalizeChecklistItem(raw) {
  return {
    id: raw.id,
    title: raw.title || '',
    isCompleted: Boolean(raw.is_completed),
    createdBy: raw.created_by_username || '',
  };
}

function normalizeProject(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    description: raw.description || '',
    status: raw.status || 'active',
    statusLabel: raw.status_label || PROJECT_STATUS_LABELS[raw.status] || raw.status,
    endDate: raw.end_date || null,
    createdAt: raw.created_at || null,
    responsibleUserId: raw.responsible_user || null,
    responsibleUserName: raw.responsible_user_username || raw.created_by_username || '—',
    taskCount: Number(raw.task_count || 0),
    completedTaskCount: Number(raw.completed_task_count || 0),
    inProgressTaskCount: Number(raw.in_progress_task_count || 0),
    overdueTaskCount: Number(raw.overdue_task_count || 0),
    progressPercentage: Number(raw.progress_percentage || 0),
    members: Array.isArray(raw.members)
      ? raw.members.map((member) => ({
          ...member,
          roleLabel: ROLE_LABELS[(member.role || '').toLowerCase()] || member.role || '',
        }))
      : [],
  };
}

function normalizeReport(raw) {
  return {
    id: raw.id,
    username: raw.user_full_name || raw.username || '-',
    started: raw.started_tasks || '',
    taken: raw.taken_tasks || '',
    completed: raw.completed_tasks || '',
    blockers: raw.blockers || '',
  };
}

function normalizeProjectReport(raw) {
  const statusCounts = raw?.status_counts || {};
  const overdueTasks = Array.isArray(raw?.overdue_tasks) ? raw.overdue_tasks : [];

  return {
    totalTaskCount: Number(raw?.total_task_count || 0),
    completedTaskCount: Number(raw?.completed_task_count || 0),
    progressPercentage: Number(raw?.progress_percentage || 0),
    overdueTaskCount: Number(raw?.overdue_task_count || 0),
    templateReport: raw?.template_report || '',
    assigneeStats: Array.isArray(raw?.assignee_stats)
      ? raw.assignee_stats.map((item) => ({
          name: item.name || item.username || '—',
          total: Number(item.total || 0),
          done: Number(item.done || 0),
          inProgress: Number(item.in_progress || 0),
          review: Number(item.review || 0),
          blocked: Number(item.blocked || 0),
          progress: Number(item.progress || 0),
        }))
      : [],
    statusCounts: {
      to_do: Number(statusCounts.to_do || 0),
      in_progress: Number(statusCounts.in_progress || 0),
      review: Number(statusCounts.review || 0),
      done: Number(statusCounts.done || 0),
      blocked: Number(statusCounts.blocked || 0),
    },
    overdueTasks: overdueTasks.map((task) => ({
      id: task.id,
      title: task.title || '',
      assigneeUsername: task.assignee_username || 'Без исполнителя',
      statusLabel: task.status_label || STATUS_LABELS[task.status] || task.status || '',
      dueDate: task.due_date || null,
    })),
  };
}

export default function Tasks({ view = 'tasks' }) {
  const { user } = useAuth();
  const role = user?.role;
  const isProjectsView = view === 'projects';
  const canSeeProjects = ['employee', 'projectmanager', 'department_head', 'admin', 'superadmin'].includes(role);
  const isManager = ['projectmanager', 'department_head', 'admin', 'superadmin'].includes(role);
  const canAssignProjectTasks = isManager;
  const canSubmitDaily = ['employee', 'projectmanager'].includes(role);
  const canViewDaily = ['department_head', 'admin', 'superadmin', 'projectmanager'].includes(role);

  const [taskSection] = useState(isProjectsView ? 'team' : 'my');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectReport, setProjectReport] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [movingTaskId, setMovingTaskId] = useState(null);
  const [reportDate, setReportDate] = useState(todayISO());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [updatingProjectStatus, setUpdatingProjectStatus] = useState(false);
  const [projectStatusFilter, setProjectStatusFilter] = useState('');
  const [taskComments, setTaskComments] = useState([]);
  const [taskHistory, setTaskHistory] = useState([]);
  const [taskSubtasks, setTaskSubtasks] = useState([]);
  const [taskChecklist, setTaskChecklist] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [checklistTitle, setChecklistTitle] = useState('');

  const [filters, setFilters] = useState({
    assigneeId: '',
    priority: '',
    status: '',
    overdueOnly: false,
  });

  const [taskForm, setTaskForm] = useState({
    board_id: '',
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assignee_id: '',
  });

  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    status: 'planning',
    end_date: '',
    responsible_user_id: '',
    member_ids: [],
  });

  const [dailyForm, setDailyForm] = useState({
    started_tasks: '',
    taken_tasks: '',
    completed_tasks: '',
    blockers: '',
  });

  const pageTitle = isProjectsView ? 'Проекты' : 'Задачи';
  const pageSubtitle = isProjectsView
    ? 'Проекты, участники и задачи команды по каждому проекту'
    : 'Ваши личные задачи и статусы выполнения';

  const loadProjects = async () => {
    if (!canSeeProjects) {
      setProjects([]);
      return;
    }
    try {
      const response = await tasksAPI.projects();
      const rows = Array.isArray(response.data) ? response.data : [];
      setProjects(rows.map(normalizeProject));
    } catch {
      setProjects([]);
    }
  };

  const loadAssignees = async () => {
    try {
      const response = await tasksAPI.assignees();
      const list = Array.isArray(response.data) ? response.data : [];
      setAssigneeOptions(
        list.map((item) => ({
          id: item.id,
          name: item.full_name || item.username || `ID ${item.id}`,
        }))
      );
    } catch {
      setAssigneeOptions([]);
    }
  };

  const loadTasksAndReports = async () => {
    setLoading(true);
    setError('');
    try {
      const taskRequest = isProjectsView
        ? (canSeeProjects && selectedProjectId
            ? tasksAPI.projectTasks(selectedProjectId)
            : Promise.resolve({ data: [] }))
        : tasksAPI.my();

      const [taskRes, reportsRes] = await Promise.all([
        taskRequest.catch(() => ({ data: [] })),
        canViewDaily && isProjectsView && selectedProjectId
          ? tasksAPI.dailyReports({ date: reportDate }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);

      const taskRows = Array.isArray(taskRes.data) ? taskRes.data : [];
      setTasks(taskRows.map(normalizeTask));

      const reportRows = Array.isArray(reportsRes.data) ? reportsRes.data : [];
      setReports(reportRows.map(normalizeReport));
    } catch {
      setError('Не удалось загрузить задачи.');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskMeta = async (taskId) => {
    try {
      const [checklistRes, commentsRes, historyRes, subtasksRes] = await Promise.all([
        tasksAPI.checklist(taskId).catch(() => ({ data: [] })),
        tasksAPI.comments(taskId).catch(() => ({ data: [] })),
        tasksAPI.history(taskId).catch(() => ({ data: [] })),
        tasksAPI.subtasks(taskId).catch(() => ({ data: [] })),
      ]);
      setTaskChecklist(Array.isArray(checklistRes.data) ? checklistRes.data.map(normalizeChecklistItem) : []);
      setTaskComments(Array.isArray(commentsRes.data) ? commentsRes.data : []);
      setTaskHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
      setTaskSubtasks(Array.isArray(subtasksRes.data) ? subtasksRes.data.map(normalizeSubtask) : []);
    } catch {
      setTaskChecklist([]);
      setTaskComments([]);
      setTaskHistory([]);
      setTaskSubtasks([]);
    }
  };

  const loadProjectReport = async (projectId) => {
    if (!projectId || !canSeeProjects) {
      setProjectReport(null);
      return;
    }
    try {
      const response = await tasksAPI.projectReport(projectId);
      setProjectReport(normalizeProjectReport(response.data));
    } catch {
      setProjectReport(null);
    }
  };

  useEffect(() => {
    loadProjects();
    loadAssignees();
  }, []);

  useEffect(() => {
    loadTasksAndReports();
  }, [taskSection, selectedProjectId, reportDate, isProjectsView]);

  useEffect(() => {
    if (!isProjectsView || !selectedProjectId) {
      setProjectReport(null);
      return;
    }
    loadProjectReport(selectedProjectId);
  }, [isProjectsView, selectedProjectId]);

  useEffect(() => {
    if (!activeTask) return;
    const current = tasks.find((item) => item.id === activeTask.id);
    if (current) setActiveTask(current);
  }, [tasks, activeTask]);

  useEffect(() => {
    if (!activeTask) return;
    loadTaskMeta(activeTask.id);
  }, [activeTask?.id]);

  useEffect(() => {
    if (!showTaskModal) return;
    setTaskForm((prev) => ({
      ...prev,
      board_id: prev.board_id || selectedProjectId || '',
      assignee_id: prev.assignee_id || user?.id || '',
    }));
  }, [showTaskModal, selectedProjectId, user?.id]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.assigneeId && String(task.assigneeId || '') !== String(filters.assigneeId)) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.overdueOnly && !task.isOverdue) return false;
      return true;
    });
  }, [tasks, filters]);

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === String(selectedProjectId)) || null,
    [projects, selectedProjectId]
  );

  const filteredProjects = useMemo(() => {
    if (!projectStatusFilter) return projects;
    return projects.filter((project) => project.status === projectStatusFilter);
  }, [projects, projectStatusFilter]);

  const projectMemberOptions = useMemo(() => {
    return assigneeOptions.filter((option) => {
      if (role === 'intern') return false;
      return true;
    });
  }, [assigneeOptions, role]);

  useEffect(() => {
    if (!projectStatusFilter) return;
    if (!selectedProjectId) return;
    const stillVisible = filteredProjects.some((project) => String(project.id) === String(selectedProjectId));
    if (!stillVisible) {
      setSelectedProjectId(filteredProjects[0] ? String(filteredProjects[0].id) : '');
    }
  }, [projectStatusFilter, filteredProjects, selectedProjectId]);

  const selectedTaskFormProject = useMemo(
    () => projects.find((project) => String(project.id) === String(taskForm.board_id)) || null,
    [projects, taskForm.board_id]
  );

  const visibleAssigneeOptions = useMemo(() => {
    const baseOptions = [...assigneeOptions];
    if (user?.id && !baseOptions.some((option) => Number(option.id) === Number(user.id))) {
      baseOptions.unshift({
        id: user.id,
        name: user.full_name || user.username || `ID ${user.id}`,
      });
    }

    const scopedProject = selectedTaskFormProject || (isProjectsView ? selectedProject : null);
    if (!scopedProject) {
      return baseOptions;
    }

    const memberIds = new Set(scopedProject.members.map((member) => Number(member.id)));
    const filtered = baseOptions.filter((option) => memberIds.has(Number(option.id)));

    if (filtered.length > 0) {
      return filtered;
    }

    return scopedProject.members.map((member) => ({
      id: member.id,
      name: member.full_name || member.username || `ID ${member.id}`,
    }));
  }, [assigneeOptions, isProjectsView, selectedProject, selectedTaskFormProject, user]);

  const selectedProjectTaskRows = useMemo(() => {
    if (!selectedProject) return [];
    return [...filteredTasks].sort((a, b) => {
      const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
  }, [filteredTasks, selectedProject]);

  const columns = useMemo(() => {
    const map = new Map();
    DEFAULT_COLUMN_ORDERS.forEach((order) => {
      map.set(order, { order, id: null, name: DEFAULT_COLUMN_NAMES[order], items: [] });
    });

    filteredTasks.forEach((task) => {
      const order = task.columnOrder || 1;
      if (!map.has(order)) {
        map.set(order, {
          order,
          id: task.columnId,
          name: task.columnName || `Колонка ${order}`,
          items: [],
        });
      }
      const column = map.get(order);
      if (!column.id) column.id = task.columnId;
      if (task.columnName) column.name = task.columnName;
      column.items.push(task);
    });

    return Array.from(map.values())
      .sort((a, b) => a.order - b.order)
      .map((column) => ({
        ...column,
        items: [...column.items].sort((a, b) => {
          const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        }),
      }));
  }, [filteredTasks]);

  const getDefaultAssigneeId = () => {
    const projectId = taskForm.board_id || selectedProjectId;
    if (!projectId) {
      return user?.id || '';
    }

    const project = projects.find((item) => String(item.id) === String(projectId));
    if (!project) {
      return user?.id || '';
    }

    const currentUserIsMember = project.members.some((member) => Number(member.id) === Number(user?.id));
    if (currentUserIsMember) {
      return user?.id || '';
    }

    if (project.responsibleUserId) {
      return project.responsibleUserId;
    }

    if (project.members.length > 0) {
      return project.members[0].id;
    }

    return '';
  };

  useEffect(() => {
    if (!showTaskModal || editingTaskId) return;
    if (!visibleAssigneeOptions.length) return;

    const currentExists = visibleAssigneeOptions.some(
      (option) => String(option.id) === String(taskForm.assignee_id)
    );

    if (!currentExists) {
      setTaskForm((prev) => ({
        ...prev,
        assignee_id: String(visibleAssigneeOptions[0].id),
      }));
    }
  }, [visibleAssigneeOptions, showTaskModal, editingTaskId, taskForm.assignee_id]);

  const resetTaskForm = () => {
    setTaskForm({
      board_id: selectedProjectId || '',
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
      assignee_id: getDefaultAssigneeId(),
    });
  };

  const saveTask = async () => {
    const title = taskForm.title.trim();
    if (!title) {
      setError('Название задачи не может быть пустым.');
      return;
    }

    if (isProjectsView && !editingTaskId && !taskForm.board_id) {
      setError('В разделе "Проекты" сначала выберите проект.');
      return;
    }

    try {
      if (editingTaskId) {
        await tasksAPI.update(editingTaskId, {
          title,
          description: taskForm.description.trim(),
          assignee: taskForm.assignee_id ? Number(taskForm.assignee_id) : null,
          due_date: taskForm.due_date || null,
          priority: taskForm.priority,
        });
      } else {
        await tasksAPI.create({
          board_id: taskForm.board_id || null,
          title,
          description: taskForm.description.trim(),
          assignee_id: taskForm.board_id && taskForm.assignee_id ? Number(taskForm.assignee_id) : null,
          due_date: taskForm.due_date || null,
          priority: taskForm.priority,
        });
      }
      setShowTaskModal(false);
      setEditingTaskId(null);
      resetTaskForm();
      await loadTasksAndReports();
      await loadProjects();
    } catch (e) {
      setError(e.response?.data?.detail || (editingTaskId ? 'Не удалось обновить задачу.' : 'Не удалось создать задачу.'));
    }
  };

  const startCreateTask = () => {
    if (isProjectsView && !selectedProjectId) {
      setError('Сначала выберите проект, затем создавайте задачу.');
      return;
    }
    setEditingTaskId(null);
    resetTaskForm();
    setShowTaskModal(true);
  };

  const startEditTask = () => {
    if (!activeTask) return;
    setEditingTaskId(activeTask.id);
    setTaskForm({
      board_id: activeTask.boardId || '',
      title: activeTask.title || '',
      description: activeTask.description || '',
      priority: activeTask.priority || 'medium',
      due_date: activeTask.dueDate || '',
      assignee_id: activeTask.assigneeId || '',
    });
    setShowTaskModal(true);
  };

  const deleteTask = async () => {
    if (!activeTask) return;
    const ok = window.confirm(`Удалить задачу "${activeTask.title}"?`);
    if (!ok) return;
    try {
      await tasksAPI.delete(activeTask.id);
      setActiveTask(null);
      await loadTasksAndReports();
      await loadProjects();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось удалить задачу.');
    }
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setEditingProjectId(null);
    setProjectForm({
      name: '',
      description: '',
      status: 'planning',
      end_date: '',
      responsible_user_id: '',
      member_ids: [],
    });
  };

  const openCreateProjectModal = () => {
    setError('');
    setEditingProjectId(null);
    setProjectForm({
      name: '',
      description: '',
      status: 'planning',
      end_date: '',
      responsible_user_id: user?.id ? String(user.id) : '',
      member_ids: [],
    });
    setShowProjectModal(true);
  };

  const startEditProject = () => {
    if (!selectedProject) return;
    setError('');
    setEditingProjectId(selectedProject.id);
    setProjectForm({
      name: selectedProject.name || '',
      description: selectedProject.description || '',
      status: selectedProject.status || 'planning',
      end_date: selectedProject.endDate || '',
      responsible_user_id: selectedProject.responsibleUserId ? String(selectedProject.responsibleUserId) : '',
      member_ids: selectedProject.members.map((member) => Number(member.id)),
    });
    setShowProjectModal(true);
  };

  const saveProject = async () => {
    const name = projectForm.name.trim();
    if (!name) {
      setError('Название проекта обязательно.');
      return;
    }

    const responsibleUserId = projectForm.responsible_user_id ? Number(projectForm.responsible_user_id) : null;
    const memberIds = new Set(projectForm.member_ids.map(Number));
    if (responsibleUserId) memberIds.add(responsibleUserId);

    try {
      const payload = {
        name,
        description: projectForm.description.trim(),
        status: projectForm.status,
        end_date: projectForm.end_date || null,
        responsible_user_id: responsibleUserId,
        member_ids: Array.from(memberIds),
      };

      const response = editingProjectId
        ? await tasksAPI.updateProject(editingProjectId, payload)
        : await tasksAPI.createProject(payload);

      const savedProjectId = response?.data?.id ? String(response.data.id) : (editingProjectId ? String(editingProjectId) : '');
      closeProjectModal();
      await loadProjects();
      if (savedProjectId) {
        setSelectedProjectId(savedProjectId);
      }
      await loadTasksAndReports();
      if (savedProjectId) {
        await loadProjectReport(savedProjectId);
      }
    } catch (e) {
      setError(
        e.response?.data?.detail
          || (editingProjectId ? 'Не удалось обновить проект.' : 'Не удалось создать проект.')
      );
    }
  };

  const changeProjectStatus = async (nextStatus) => {
    if (!selectedProject || !nextStatus || nextStatus === selectedProject.status) return;
    try {
      setUpdatingProjectStatus(true);
      await tasksAPI.updateProject(selectedProject.id, { status: nextStatus });
      await Promise.all([loadProjects(), loadTasksAndReports()]);
      await loadProjectReport(selectedProject.id);
      setError('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось изменить статус проекта.');
    } finally {
      setUpdatingProjectStatus(false);
    }
  };

  const moveTask = async (task, targetOrder) => {
    if (!task || targetOrder === task.columnOrder) return;
    const target = task.boardColumns.find((item) => Number(item.order) === Number(targetOrder));
    if (!target?.id) return;
    try {
      setMovingTaskId(task.id);
      await tasksAPI.move(task.id, target.id);
      await loadTasksAndReports();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось изменить статус задачи.');
    } finally {
      setMovingTaskId(null);
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
      await loadTasksAndReports();
    } catch {
      setError('Не удалось отправить ежедневный отчет.');
    }
  };

  const submitComment = async () => {
    if (!activeTask || !commentText.trim()) return;
    try {
      await tasksAPI.addComment(activeTask.id, { text: commentText.trim() });
      setCommentText('');
      await loadTaskMeta(activeTask.id);
    } catch {
      setError('Не удалось добавить комментарий.');
    }
  };

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text || '');
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const saveCommentEdit = async (commentId) => {
    if (!activeTask || !editingCommentText.trim()) {
      setError('Текст комментария не может быть пустым.');
      return;
    }
    try {
      await tasksAPI.updateComment(activeTask.id, commentId, { text: editingCommentText.trim() });
      cancelEditComment();
      await loadTaskMeta(activeTask.id);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось отредактировать комментарий.');
    }
  };

  const deleteComment = async (commentId) => {
    if (!activeTask) return;
    const ok = window.confirm('Удалить комментарий?');
    if (!ok) return;
    try {
      await tasksAPI.deleteComment(activeTask.id, commentId);
      if (editingCommentId === commentId) {
        cancelEditComment();
      }
      await loadTaskMeta(activeTask.id);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось удалить комментарий.');
    }
  };

  const submitSubtask = async () => {
    if (!activeTask || !subtaskTitle.trim()) return;
    try {
      await tasksAPI.addSubtask(activeTask.id, { title: subtaskTitle.trim() });
      setSubtaskTitle('');
      await Promise.all([loadTaskMeta(activeTask.id), loadTasksAndReports()]);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось добавить подзадачу.');
    }
  };

  const toggleSubtask = async (subtask) => {
    if (!activeTask) return;
    try {
      await tasksAPI.updateSubtask(activeTask.id, subtask.id, { is_completed: !subtask.isCompleted });
      await Promise.all([loadTaskMeta(activeTask.id), loadTasksAndReports()]);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось обновить подзадачу.');
    }
  };

  const deleteSubtask = async (subtaskId) => {
    if (!activeTask) return;
    try {
      await tasksAPI.deleteSubtask(activeTask.id, subtaskId);
      await Promise.all([loadTaskMeta(activeTask.id), loadTasksAndReports()]);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось удалить подзадачу.');
    }
  };

  const submitChecklistItem = async () => {
    if (!activeTask || !checklistTitle.trim()) return;
    try {
      await tasksAPI.addChecklistItem(activeTask.id, { title: checklistTitle.trim() });
      setChecklistTitle('');
      await Promise.all([loadTaskMeta(activeTask.id), loadTasksAndReports()]);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось добавить пункт чек-листа.');
    }
  };

  const toggleChecklistItem = async (item) => {
    if (!activeTask) return;
    try {
      await tasksAPI.updateChecklistItem(activeTask.id, item.id, { is_completed: !item.isCompleted });
      await Promise.all([loadTaskMeta(activeTask.id), loadTasksAndReports()]);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось обновить пункт чек-листа.');
    }
  };

  const editChecklistItem = async (item) => {
    if (!activeTask) return;
    const nextTitle = window.prompt('Новое название пункта', item.title);
    if (nextTitle === null) return;
    if (!nextTitle.trim()) {
      setError('Название пункта не может быть пустым.');
      return;
    }
    try {
      await tasksAPI.updateChecklistItem(activeTask.id, item.id, { title: nextTitle.trim() });
      await Promise.all([loadTaskMeta(activeTask.id), loadTasksAndReports()]);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось отредактировать пункт чек-листа.');
    }
  };

  const deleteChecklistItem = async (itemId) => {
    if (!activeTask) return;
    try {
      await tasksAPI.deleteChecklistItem(activeTask.id, itemId);
      await Promise.all([loadTaskMeta(activeTask.id), loadTasksAndReports()]);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось удалить пункт чек-листа.');
    }
  };

  return (
    <MainLayout title="Задачи">
      <div className="page-header">
        <div>
          <div className="page-title">{pageTitle}</div>
          <div className="page-subtitle">{pageSubtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isProjectsView && isManager && (
            <button className="btn btn-secondary" onClick={openCreateProjectModal}>
              <Plus size={15} /> Новый проект
            </button>
          )}
          {(!isProjectsView || canAssignProjectTasks) && (
            <button className="btn btn-primary" onClick={startCreateTask}>
              <Plus size={15} /> Новая задача
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ color: 'var(--danger)' }}>{error}</div>
        </div>
      ) : null}

      {isProjectsView && canSeeProjects ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '320px minmax(0, 1fr)',
            gap: 16,
            alignItems: 'start',
            marginBottom: 16,
          }}
        >
          <div className="card" style={{ position: 'sticky', top: 12 }}>
            <div className="card-body" style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>Проекты</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                  {role === 'employee'
                    ? 'Ваши проекты, участники команды и задачи внутри проектов'
                    : role === 'projectmanager'
                      ? 'Ваши проекты и задачи вашей команды'
                      : 'Проекты компании и командная загрузка'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={!projectStatusFilter ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  onClick={() => setProjectStatusFilter('')}
                >
                  Все
                </button>
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={projectStatusFilter === value ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                    onClick={() => setProjectStatusFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Быстрый выбор проекта</label>
                <select
                  className="form-select"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  <option value="">Выберите проект</option>
                  {filteredProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.taskCount})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gap: 10, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
                {filteredProjects.map((project) => {
                  const isSelected = String(selectedProjectId) === String(project.id);
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className="card"
                      style={{
                        textAlign: 'left',
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: isSelected ? 'linear-gradient(180deg, #f4f8ff 0%, #ffffff 100%)' : 'var(--card)',
                        boxShadow: isSelected ? '0 10px 24px rgba(37, 99, 235, 0.12)' : 'none',
                      }}
                      onClick={() => setSelectedProjectId(String(project.id))}
                    >
                      <div className="card-body" style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                          <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{project.name}</div>
                          <span className={`badge ${PROJECT_STATUS_TONES[project.status] || 'badge-gray'}`}>
                            {project.statusLabel}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                          {project.description || 'Без описания'}
                        </div>
                        <div style={{ fontSize: 12 }}>Ответственный: {project.responsibleUserName}</div>
                        <div style={{ fontSize: 12 }}>Задачи: {project.taskCount}</div>
                      </div>
                    </button>
                  );
                })}
                {filteredProjects.length === 0 ? (
                  <div style={{ color: 'var(--gray-500)' }}>
                    {projectStatusFilter ? 'По этому статусу проектов пока нет.' : 'Проектов пока нет.'}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {selectedProject ? (
              <div className="card">
                <div className="card-body" style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.2 }}>{selectedProject.name}</div>
                      <div style={{ color: 'var(--gray-500)', marginTop: 6 }}>
                        {selectedProject.description || 'Без описания'}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                      <span className={`badge ${PROJECT_STATUS_TONES[selectedProject.status] || 'badge-gray'}`}>
                        {selectedProject.statusLabel}
                      </span>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <select
                          className="form-select"
                          value={selectedProject.status}
                          onChange={(e) => changeProjectStatus(e.target.value)}
                          disabled={updatingProjectStatus}
                          style={{ minWidth: 180 }}
                        >
                          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        {isManager ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={startEditProject}
                          >
                            Редактировать проект
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedProjectId('')}
                        >
                          Закрыть проект
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    Статусы выше слева фильтруют список проектов. Здесь справа можно изменить статус только выбранного проекта.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                    <div className="card" style={{ border: '1px solid var(--border)' }}>
                      <div className="card-body">
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Ответственный</div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>{selectedProject.responsibleUserName}</div>
                      </div>
                    </div>
                    <div className="card" style={{ border: '1px solid var(--border)' }}>
                      <div className="card-body">
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Дата создания</div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>
                          {selectedProject.createdAt ? String(selectedProject.createdAt).slice(0, 10) : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="card" style={{ border: '1px solid var(--border)' }}>
                      <div className="card-body">
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Дата завершения</div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>{selectedProject.endDate || '—'}</div>
                      </div>
                    </div>
                    <div className="card" style={{ border: '1px solid var(--border)' }}>
                      <div className="card-body">
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Всего задач</div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>{selectedProject.taskCount}</div>
                      </div>
                    </div>
                    <div className="card" style={{ border: '1px solid var(--border)' }}>
                      <div className="card-body">
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Выполненные</div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>{selectedProject.completedTaskCount}</div>
                      </div>
                    </div>
                    <div className="card" style={{ border: '1px solid var(--border)' }}>
                      <div className="card-body">
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>В процессе</div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>{selectedProject.inProgressTaskCount}</div>
                      </div>
                    </div>
                    <div className="card" style={{ border: '1px solid var(--border)' }}>
                      <div className="card-body">
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Просроченные</div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>{selectedProject.overdueTaskCount}</div>
                      </div>
                    </div>
                    <div className="card" style={{ border: '1px solid var(--border)' }}>
                      <div className="card-body">
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Прогресс проекта</div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>{selectedProject.progressPercentage}%</div>
                        <div
                          style={{
                            marginTop: 10,
                            height: 8,
                            borderRadius: 999,
                            background: 'var(--gray-100)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(0, Math.min(100, selectedProject.progressPercentage))}%`,
                              height: '100%',
                              background: 'var(--primary)',
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ border: '1px solid var(--border)' }}>
                    <div className="card-body">
                      <div style={{ fontWeight: 700, marginBottom: 10 }}>Участники проекта</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {selectedProject.members.map((member) => (
                          <span key={member.id} className="badge badge-gray">
                            {(member.full_name || member.username) + (member.roleLabel ? ` • ${member.roleLabel}` : '')}
                          </span>
                        ))}
                        {selectedProject.members.length === 0 ? <span style={{ color: 'var(--gray-500)' }}>Участников пока нет.</span> : null}
                      </div>
                    </div>
                  </div>

                  {projectReport ? (
                    <div className="card" style={{ border: '1px solid var(--border)' }}>
                      <div className="card-body">
                        <div style={{ fontWeight: 700, marginBottom: 14 }}>Отчёт по задачам проекта</div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Общее количество задач</div>
                            <div style={{ fontWeight: 700, marginTop: 4 }}>{projectReport.totalTaskCount}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Выполненные задачи</div>
                            <div style={{ fontWeight: 700, marginTop: 4 }}>{projectReport.completedTaskCount}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Процент выполнения</div>
                            <div style={{ fontWeight: 700, marginTop: 4 }}>{projectReport.progressPercentage}%</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Просроченные задачи</div>
                            <div style={{ fontWeight: 700, marginTop: 4 }}>{projectReport.overdueTaskCount}</div>
                          </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Задачи по статусам</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <span className="badge badge-gray">К выполнению: {projectReport.statusCounts.to_do}</span>
                            <span className="badge badge-gray">В работе: {projectReport.statusCounts.in_progress}</span>
                            <span className="badge badge-gray">На проверке: {projectReport.statusCounts.review}</span>
                            <span className="badge badge-gray">Выполнено: {projectReport.statusCounts.done}</span>
                            <span className="badge badge-gray">Заблокировано: {projectReport.statusCounts.blocked}</span>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Список просроченных задач</div>
                          {projectReport.overdueTasks.length ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {projectReport.overdueTasks.map((task) => (
                                <div
                                  key={task.id}
                                  style={{
                                    border: '1px solid var(--border)',
                                    borderRadius: 12,
                                    padding: 12,
                                    background: 'var(--surface)',
                                  }}
                                >
                                  <div style={{ fontWeight: 700 }}>{task.title}</div>
                                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--gray-600)' }}>
                                    Исполнитель: {task.assigneeUsername}
                                  </div>
                                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--gray-600)' }}>
                                    Статус: {task.statusLabel}
                                  </div>
                                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--danger-600)' }}>
                                    Срок: {task.dueDate || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--gray-500)' }}>Просроченных задач нет.</div>
                          )}
                        </div>

                        <div style={{ marginTop: 16, marginBottom: 16 }}>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Эффективность членов команды</div>
                          {projectReport.assigneeStats.length ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {projectReport.assigneeStats.map((item) => (
                                <div
                                  key={item.name}
                                  style={{
                                    border: '1px solid var(--border)',
                                    borderRadius: 12,
                                    padding: 12,
                                    background: 'var(--surface)',
                                  }}
                                >
                                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--gray-600)' }}>
                                    Всего: {item.total} • Выполнено: {item.done} • В работе: {item.inProgress} • На проверке: {item.review}
                                  </div>
                                  <div style={{ marginTop: 8 }}>
                                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>Прогресс</div>
                                    <div
                                      style={{
                                        width: '100%',
                                        height: 8,
                                        borderRadius: 999,
                                        background: 'var(--gray-200)',
                                        overflow: 'hidden',
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: `${Math.max(0, Math.min(item.progress, 100))}%`,
                                          height: '100%',
                                          background: 'var(--primary)',
                                          borderRadius: 999,
                                        }}
                                      />
                                    </div>
                                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gray-600)' }}>{item.progress}%</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--gray-500)' }}>Нет данных по участникам проекта.</div>
                          )}
                        </div>

                        <div style={{ marginTop: 20 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              marginBottom: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Шаблон отчёта</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => navigator.clipboard.writeText(projectReport.templateReport || '')}
                                disabled={!projectReport.templateReport}
                              >
                                Копировать текст
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => downloadProjectReportDocument(selectedProject, projectReport)}
                              >
                                Скачать DOC
                              </button>
                            </div>
                          </div>

                          <div
                            style={{
                              border: '1px solid var(--border)',
                              borderRadius: 22,
                              overflow: 'hidden',
                              background: 'linear-gradient(180deg, #f7fbff 0%, #ffffff 100%)',
                            }}
                          >
                            <div
                              style={{
                                padding: 24,
                                background: 'linear-gradient(135deg, #edf4ff 0%, #f9fbff 100%)',
                                borderBottom: '1px solid var(--border)',
                              }}
                            >
                              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.03em' }}>{selectedProject.name}</div>
                              <div style={{ marginTop: 8, color: 'var(--gray-600)', maxWidth: 720, lineHeight: 1.6 }}>
                                {selectedProject.description || 'Описание проекта пока не заполнено.'}
                              </div>
                            </div>

                            <div style={{ padding: 24, display: 'grid', gap: 20 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                <div className="card" style={{ border: '1px solid var(--border)' }}>
                                  <div className="card-body">
                                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Ответственный</div>
                                    <div style={{ fontWeight: 800, marginTop: 6 }}>{selectedProject.responsibleUserName || '—'}</div>
                                  </div>
                                </div>
                                <div className="card" style={{ border: '1px solid var(--border)' }}>
                                  <div className="card-body">
                                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Статус проекта</div>
                                    <div style={{ fontWeight: 800, marginTop: 6 }}>{selectedProject.statusLabel}</div>
                                  </div>
                                </div>
                                <div className="card" style={{ border: '1px solid var(--border)' }}>
                                  <div className="card-body">
                                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Дата создания</div>
                                    <div style={{ fontWeight: 800, marginTop: 6 }}>{formatDisplayDate(selectedProject.createdAt)}</div>
                                  </div>
                                </div>
                                <div className="card" style={{ border: '1px solid var(--border)' }}>
                                  <div className="card-body">
                                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Дата завершения</div>
                                    <div style={{ fontWeight: 800, marginTop: 6 }}>{formatDisplayDate(selectedProject.endDate)}</div>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <div style={{ fontWeight: 800, marginBottom: 10 }}>В команде</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {selectedProject.members.length ? selectedProject.members.map((member) => (
                                    <span key={member.id} className="badge badge-gray">
                                      {(member.full_name || member.username) + (member.roleLabel ? ` • ${member.roleLabel}` : '')}
                                    </span>
                                  )) : <span style={{ color: 'var(--gray-500)' }}>Участники не добавлены.</span>}
                                </div>
                              </div>

                              <div className="card" style={{ border: '1px solid var(--border)', background: '#fffdf6' }}>
                                <div className="card-body" style={{ display: 'grid', gap: 14 }}>
                                  <div style={{ fontWeight: 800 }}>Насколько проект готов</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                                    <div>
                                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Всего задач</div>
                                  <div style={{ fontWeight: 800, marginTop: 4 }}>{projectReport.totalTaskCount}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Выполненные задачи</div>
                                  <div style={{ fontWeight: 800, marginTop: 4 }}>{projectReport.completedTaskCount}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Процент выполнения</div>
                                  <div style={{ fontWeight: 800, marginTop: 4 }}>{projectReport.progressPercentage}%</div>
                                </div>
                                    <div>
                                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Просрочено</div>
                                      <div style={{ fontWeight: 800, marginTop: 4 }}>{projectReport.overdueTaskCount}</div>
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      width: '100%',
                                      height: 10,
                                      borderRadius: 999,
                                      background: 'var(--gray-200)',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${Math.max(0, Math.min(projectReport.progressPercentage, 100))}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                                        borderRadius: 999,
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div>
                                <div style={{ fontWeight: 800, marginBottom: 10 }}>Текст шаблона</div>
                                <textarea
                                  readOnly
                                  value={projectReport.templateReport || ''}
                                  rows={14}
                                  style={{
                                    width: '100%',
                                    border: '1px solid var(--border)',
                                    borderRadius: 14,
                                    padding: 14,
                                    background: '#fff',
                                    color: 'var(--text)',
                                    resize: 'vertical',
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="card" style={{ border: '1px solid var(--border)' }}>
                    <div className="card-body">
                      <div style={{ fontWeight: 700, marginBottom: 10 }}>Задачи проекта</div>
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Задача</th>
                              <th>Исполнитель</th>
                              <th>Статус</th>
                              <th>Приоритет</th>
                              <th>Срок</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedProjectTaskRows.map((task) => (
                              <tr
                                key={task.id}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setActiveTask(task)}
                              >
                                <td>{task.id}</td>
                                <td>{task.title}</td>
                                <td>{task.assigneeName}</td>
                                <td>{STATUS_LABELS[task.status] || task.status}</td>
                                <td>{task.priorityLabel}</td>
                                <td>{task.dueDate || '—'}</td>
                              </tr>
                            ))}
                            {selectedProjectTaskRows.length === 0 ? (
                              <tr><td colSpan={6}>В этом проекте пока нет задач.</td></tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-body" style={{ display: 'grid', placeItems: 'center', minHeight: 260, textAlign: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 8 }}>Выберите проект</div>
                    <div style={{ color: 'var(--gray-500)', maxWidth: 420 }}>
                      Слева отображается список проектов. Выберите любой проект, чтобы увидеть участников, ответственного и задачи внутри проекта.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Исполнитель</label>
              <select
                className="form-select"
                value={filters.assigneeId}
                onChange={(e) => setFilters((prev) => ({ ...prev, assigneeId: e.target.value }))}
              >
                <option value="">Все</option>
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Приоритет</label>
              <select
                className="form-select"
                value={filters.priority}
                onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
              >
                <option value="">Все</option>
                <option value="critical">Критический</option>
                <option value="high">Высокий</option>
                <option value="medium">Средний</option>
                <option value="low">Низкий</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Статус</label>
              <select
                className="form-select"
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Все</option>
                <option value="to_do">К выполнению</option>
                <option value="in_progress">В работе</option>
                <option value="review">На проверке</option>
                <option value="done">Выполнено</option>
                <option value="blocked">Заблокировано</option>
              </select>
            </div>
            <label className="form-group" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 28 }}>
              <input
                type="checkbox"
                checked={filters.overdueOnly}
                onChange={(e) => setFilters((prev) => ({ ...prev, overdueOnly: e.target.checked }))}
              />
              Только просроченные
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card"><div className="card-body">Загрузка...</div></div>
      ) : isProjectsView && !selectedProject ? (
        <div className="card">
          <div className="card-body" style={{ color: 'var(--gray-600)' }}>
            Выберите проект сверху, чтобы увидеть его задачи, участников и кто чем занимается.
          </div>
        </div>
      ) : (
        <>
          <div className="kanban-board">
            {columns.map((column) => (
              <div key={column.order} className="kanban-col">
                <div className="kanban-col-header">
                  <span className="kanban-col-title">{column.name}</span>
                  <span className="badge badge-blue">{column.items.length}</span>
                </div>
                {column.items.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="kanban-card"
                    style={{ textAlign: 'left', border: activeTask?.id === task.id ? '1px solid var(--primary)' : '1px solid transparent' }}
                    onClick={() => setActiveTask(task)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <div className="kanban-card-title">{task.title}</div>
                      {task.isOverdue ? <span className="badge badge-red">Просрочено</span> : null}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>{task.description || 'Без описания'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      <span className="badge badge-blue">{task.priorityLabel}</span>
                      <span className="badge badge-gray">{STATUS_LABELS[task.status] || task.status}</span>
                      {task.boardName ? <span className="badge badge-gray">{task.boardName}</span> : null}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Исполнитель: {task.assigneeName}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Постановщик: {task.reporterName || '-'}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Срок: {task.dueDate || '—'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {DEFAULT_COLUMN_ORDERS.map((order) => (
                        <span key={`${task.id}-${order}`}>
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTask(task, order);
                            }}
                            disabled={movingTaskId === task.id || order === task.columnOrder || task.status === 'done'}
                          >
                            {DEFAULT_COLUMN_NAMES[order]}
                          </button>
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {activeTask ? (
            <div className="grid-2" style={{ marginTop: 16, gap: 16 }}>
              <div className="card">
                <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>Карточка задачи</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={startEditTask}>Редактировать</button>
                    <button className="btn btn-secondary btn-sm" onClick={deleteTask}>Удалить</button>
                  </div>
                  <div><strong>{activeTask.title}</strong></div>
                  <div style={{ color: 'var(--gray-600)' }}>{activeTask.description || 'Без описания'}</div>
                  <div>Проект: {activeTask.boardName || 'Личная доска'}</div>
                  <div>Исполнитель: {activeTask.assigneeName}</div>
                  <div>Приоритет: {activeTask.priorityLabel}</div>
                  <div>Статус: {STATUS_LABELS[activeTask.status] || activeTask.status}</div>
                  <div>Срок: {activeTask.dueDate || '—'}</div>
                  <div>Подзадачи: {activeTask.subtasksCompleted}/{activeTask.subtasksTotal}</div>
                  <div>Чек-лист: {activeTask.checklistCompleted}/{activeTask.checklistTotal}</div>
                  <div>Выполнение: {activeTask.completionPercentage}%</div>
                  <div style={{ height: 10, borderRadius: 999, background: 'var(--gray-100)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${activeTask.completionPercentage}%`,
                        height: '100%',
                        background: 'var(--primary)',
                      }}
                    />
                  </div>
                  {activeTask.canCompleteParent ? (
                    <div style={{ color: 'var(--success)', fontWeight: 700 }}>
                      Все подзадачи выполнены. Можно завершить основную задачу.
                    </div>
                  ) : null}
                  {activeTask.isOverdue ? <div style={{ color: '#b91c1c', fontWeight: 700 }}>Задача просрочена</div> : null}
                </div>
              </div>

              <div className="card">
                <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>Подзадачи</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {taskSubtasks.map((subtask) => (
                      <div key={subtask.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, background: 'var(--gray-50)' }}>
                        <input
                          type="checkbox"
                          checked={subtask.isCompleted}
                          onChange={() => toggleSubtask(subtask)}
                        />
                        <div style={{ flex: 1, textDecoration: subtask.isCompleted ? 'line-through' : 'none' }}>
                          {subtask.title}
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => deleteSubtask(subtask.id)}>Удалить</button>
                      </div>
                    ))}
                    {taskSubtasks.length === 0 ? <div style={{ color: 'var(--gray-500)' }}>Подзадач пока нет.</div> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      placeholder="Новая подзадача"
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                    />
                    <button className="btn btn-primary btn-sm" onClick={submitSubtask}>Добавить</button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>Чек-лист</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {taskChecklist.map((item) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, background: 'var(--gray-50)' }}>
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={() => toggleChecklistItem(item)}
                        />
                        <div style={{ flex: 1, textDecoration: item.isCompleted ? 'line-through' : 'none' }}>
                          {item.title}
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => editChecklistItem(item)}>Редактировать</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => deleteChecklistItem(item.id)}>Удалить</button>
                      </div>
                    ))}
                    {taskChecklist.length === 0 ? <div style={{ color: 'var(--gray-500)' }}>Чек-лист пока пуст.</div> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      placeholder="Новый пункт чек-листа"
                      value={checklistTitle}
                      onChange={(e) => setChecklistTitle(e.target.value)}
                    />
                    <button className="btn btn-primary btn-sm" onClick={submitChecklistItem}>Добавить</button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>Комментарии</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {taskComments.map((comment) => (
                      <div key={comment.id} style={{ padding: 10, borderRadius: 10, background: 'var(--gray-50)' }}>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>
                          {comment.author_username} • {String(comment.created_at || '').slice(0, 16).replace('T', ' ')}
                        </div>
                        {editingCommentId === comment.id ? (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <textarea
                              className="form-textarea"
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => saveCommentEdit(comment.id)}>
                                Сохранить
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={cancelEditComment}>
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div>{comment.text}</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => startEditComment(comment)}>
                                Редактировать
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => deleteComment(comment.id)}>
                                Удалить
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {taskComments.length === 0 ? <div style={{ color: 'var(--gray-500)' }}>Комментариев пока нет.</div> : null}
                  </div>
                  <textarea
                    className="form-textarea"
                    placeholder="Оставить комментарий"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <div>
                    <button className="btn btn-primary btn-sm" onClick={submitComment}>Добавить комментарий</button>
                  </div>
                </div>
              </div>

              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="card-body">
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>История изменений</div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Время</th>
                          <th>Пользователь</th>
                          <th>Действие</th>
                          <th>Уровень</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskHistory.map((row) => (
                          <tr key={row.id}>
                            <td>{String(row.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                            <td>{row.actor_username || '-'}</td>
                            <td>{row.action}</td>
                            <td>{row.level}</td>
                          </tr>
                        ))}
                        {taskHistory.length === 0 ? (
                          <tr><td colSpan={4}>История пока пустая.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!isProjectsView && canSubmitDaily && (
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

          {isProjectsView && canViewDaily && selectedProjectId && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-body">
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Отчеты сотрудников за {reportDate}</div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Сотрудник</th>
                        <th>Начал</th>
                        <th>Взял в работу</th>
                        <th>Завершил</th>
                        <th>Блокеры</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report) => (
                        <tr key={report.id}>
                          <td>{report.username}</td>
                          <td>{report.started || '-'}</td>
                          <td>{report.taken || '-'}</td>
                          <td>{report.completed || '-'}</td>
                          <td>{report.blockers || '-'}</td>
                        </tr>
                      ))}
                      {reports.length === 0 ? (
                        <tr><td colSpan={5}>Отчетов за этот день пока нет.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showTaskModal ? (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowTaskModal(false);
            setEditingTaskId(null);
            resetTaskForm();
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title">{editingTaskId ? 'Редактировать задачу' : 'Новая задача'}</div>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowTaskModal(false);
                  setEditingTaskId(null);
                  resetTaskForm();
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {isManager ? (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Проект</label>
                  <select
                    className="form-select"
                    value={taskForm.board_id}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, board_id: e.target.value }))}
                  >
                    <option value="">Личная доска / без проекта</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Название</label>
                <input className="form-input" value={taskForm.title} onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Описание</label>
                <textarea className="form-textarea" style={{ minHeight: 80 }} value={taskForm.description} onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="grid-2" style={{ marginBottom: 12 }}>
                {taskForm.board_id ? (
                  <div className="form-group">
                    <label className="form-label">Исполнитель</label>
                    <select className="form-select" value={taskForm.assignee_id} onChange={(e) => setTaskForm((prev) => ({ ...prev, assignee_id: e.target.value }))}>
                      {visibleAssigneeOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="form-group">
                  <label className="form-label">Приоритет</label>
                  <select className="form-select" value={taskForm.priority} onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}>
                    <option value="critical">Критический</option>
                    <option value="high">Высокий</option>
                    <option value="medium">Средний</option>
                    <option value="low">Низкий</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Срок</label>
                <input className="form-input" type="date" value={taskForm.due_date} onChange={(e) => setTaskForm((prev) => ({ ...prev, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowTaskModal(false);
                  setEditingTaskId(null);
                  resetTaskForm();
                }}
              >
                Отмена
              </button>
              <button className="btn btn-primary" onClick={saveTask}>{editingTaskId ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showProjectModal ? (
        <div className="modal-overlay" onClick={closeProjectModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title">{editingProjectId ? 'Редактировать проект' : 'Новый проект'}</div>
              <button className="btn-icon" onClick={closeProjectModal}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Название проекта</label>
                <input className="form-input" value={projectForm.name} onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Описание</label>
                <textarea className="form-textarea" value={projectForm.description} onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Статус проекта</label>
                  <select
                    className="form-select"
                    value={projectForm.status}
                    onChange={(e) => setProjectForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Дата завершения</label>
                  <input
                    className="form-input"
                    type="date"
                    value={projectForm.end_date}
                    onChange={(e) => setProjectForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Ответственный</label>
                <select
                  className="form-select"
                  value={projectForm.responsible_user_id}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, responsible_user_id: e.target.value }))}
                >
                  <option value="">Не выбран</option>
                  {projectMemberOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Участники проекта</label>
                <select
                  multiple
                  className="form-select"
                  style={{ minHeight: 180 }}
                  value={projectForm.member_ids.map(String)}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map((option) => Number(option.value));
                    setProjectForm((prev) => ({ ...prev, member_ids: values }));
                  }}
                >
                  {projectMemberOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeProjectModal}>Отмена</button>
              <button className="btn btn-primary" onClick={saveProject}>
                {editingProjectId ? 'Сохранить проект' : 'Создать проект'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
}
