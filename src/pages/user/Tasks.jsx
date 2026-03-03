import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';
import { Plus, X, Flag, MessageSquare, Calendar, User, Paperclip, History } from 'lucide-react';
import { isAdminRole, isSuperAdminRole } from '../../utils/roles';

const COLUMNS = [
  { id: 'new',       title: 'Новые',           color: '#22C55E', bg: '#DCFCE7' },
  { id: 'progress',  title: 'В работе',        color: '#0EA5E9', bg: '#E0F2FE' },
  { id: 'review',    title: 'На проверке',     color: '#EAB308', bg: '#FEF9C3' },
  { id: 'done',      title: 'Завершённые',     color: '#8B5CF6', bg: '#EDE9FE' },
];

const PRIORITY_COLORS = {
  high:   { color: '#EF4444', label: 'Высокий',   bg: '#FEE2E2' },
  normal: { color: '#F59E0B', label: 'Средний',   bg: '#FEF9C3' },
  low:    { color: '#6B7280', label: 'Низкий',    bg: '#F3F4F6' },
};

const TASKS_STORAGE_KEY = 'vpluse_tasks_workflow_v1';

const DEFAULT_TASKS = [
  { id: 1, title: 'Спарсить всех АУ по ЕФРСБ', description: 'Подготовить выгрузку и сверить с текущим списком.', project: 'ЕФРСБ интеграция', col: 'new', priority: 'high', assigneeId: 1, assignee: 'Алексей П.', date: '2026-03-02', comments: [], attachments: [], history: [] },
  { id: 2, title: 'Ревизия CRM на ошибки', description: 'Найти дубли и некорректные статусы сделок.', project: 'CRM аудит', col: 'progress', priority: 'high', assigneeId: 1, assignee: 'Алексей П.', date: '2026-03-03', comments: [], attachments: [], history: [] },
  { id: 3, title: 'Отправить майндкарту Свете', description: 'Обновить версии и отправить итоговый вариант.', project: 'CRM аудит', col: 'new', priority: 'normal', assigneeId: 2, assignee: 'Айбек У.', date: '2026-03-01', comments: [], attachments: [], history: [] },
  { id: 4, title: 'Поставить систему смены статуса', description: 'Согласовать правила автоперехода воронки.', project: 'ЕФРСБ интеграция', col: 'review', priority: 'normal', assigneeId: 3, assignee: 'Максат С.', date: '2026-03-04', comments: [], attachments: [], history: [] },
];

const nowLabel = () => new Date().toLocaleString('ru-RU');

const readTasks = () => {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return DEFAULT_TASKS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_TASKS;
  } catch {
    return DEFAULT_TASKS;
  }
};

const saveTasks = (tasks) => {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
};

const depKey = (u) => String(u?.department_name || u?.department || '').trim().toLowerCase();

function TaskCard({ task, onDelete, onMove, columns, onOpen }) {
  const p = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.normal;
  return (
    <div className="kanban-card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: p.bg, color: p.color }}>
          <Flag size={9} style={{ marginRight: 3, display: 'inline' }} />{p.label}
        </span>
        <button onClick={() => onDelete(task.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', padding: 2, lineHeight: 1 }}>
          <X size={12} />
        </button>
      </div>

      <div className="kanban-card-title" style={{ cursor: 'pointer' }} onClick={() => onOpen(task)}>{task.title}</div>

      <div className="kanban-card-meta" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {task.date && (
            <span style={{ fontSize: 11, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Calendar size={10} />{task.date}
            </span>
          )}
          {task.comments?.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <MessageSquare size={10} />{task.comments.length}
            </span>
          )}
          {task.attachments?.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Paperclip size={10} />{task.attachments.length}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <User size={10} />{task.assignee}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
        {columns.filter(c => c.id !== task.col).map(c => (
          <button key={c.id} onClick={() => onMove(task.id, c.id)}
            style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: '1px solid ' + c.color,
              color: c.color, background: c.bg, cursor: 'pointer' }}>
            → {c.title}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Tasks() {
  const { user, mockUsers = [] } = useAuth();
  const [allTasks, setAllTasks] = useState(readTasks);
  const [adminTaskView, setAdminTaskView] = useState('my');
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [projectTeamDetails, setProjectTeamDetails] = useState(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState(user?.id ? [String(user.id)] : []);
  const [commentText, setCommentText] = useState('');
  const [form, setForm] = useState({ title: '', description: '', project: '', priority: 'normal', assigneeId: user?.id || '', date: '', col: 'new' });

  useEffect(() => {
    saveTasks(allTasks);
  }, [allTasks]);

  useEffect(() => {
    setForm(f => ({ ...f, assigneeId: user?.id || '' }));
    setSelectedAssigneeIds(user?.id ? [String(user.id)] : []);
  }, [user?.id]);

  const isProjectManager = user?.role === 'projectmanager';
  const isEmployee = user?.role === 'employee';
  const isAdmin = isAdminRole(user?.role);
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const isAdminOrSuper = isAdmin || isSuperAdmin;
  const isProjectWorkspace = isEmployee || isProjectManager || isAdmin || isSuperAdmin;
  const canManageAll = isAdminOrSuper;
  const canManageDepartment = isProjectManager;
  const canAssignTasks = canManageAll || canManageDepartment;
  const managerDepartmentKey = depKey(user);

  const baseTasks = useMemo(() => {
    if (canManageAll) return allTasks;
    if (canManageDepartment) {
      return allTasks.filter((t) => {
        if (t.assigneeId === user?.id) return true;
        const assignee = mockUsers.find((u) => String(u.id) === String(t.assigneeId));
        return depKey(assignee) === managerDepartmentKey;
      });
    }
    return allTasks.filter(t => t.assigneeId === user?.id);
  }, [allTasks, canManageAll, canManageDepartment, managerDepartmentKey, mockUsers, user?.id]);

  const tasks = useMemo(() => {
    if (!isAdmin) return baseTasks;
    if (adminTaskView === 'employees') return baseTasks.filter(t => t.assigneeId !== user?.id);
    return baseTasks.filter(t => t.assigneeId === user?.id);
  }, [adminTaskView, baseTasks, isAdmin, user?.id]);

  const managedTeamTasks = useMemo(() => {
    if (!isAdminOrSuper) return [];
    return allTasks.filter((t) => t.assigneeId !== user?.id);
  }, [allTasks, isAdminOrSuper, user?.id]);

  const roleLabelMap = useMemo(() => {
    const map = {};
    mockUsers.forEach((u) => {
      map[String(u.id)] = u.roleLabel || u.role || 'Сотрудник';
    });
    return map;
  }, [mockUsers]);

  useEffect(() => {
    if (!isAdmin) return;
    setForm(f => ({
      ...f,
      assigneeId: adminTaskView === 'employees' ? '' : (user?.id || ''),
    }));
    setSelectedAssigneeIds(adminTaskView === 'employees' ? [] : (user?.id ? [String(user.id)] : []));
  }, [adminTaskView, isAdmin, user?.id]);

  const assigneeOptions = useMemo(() => {
    if (canManageAll) {
      return mockUsers
        .filter((u) => u.role !== 'superadmin')
        .map(u => ({ id: u.id, name: u.name || u.username || u.email }));
    }
    if (canManageDepartment) {
      return mockUsers
        .filter((u) => depKey(u) === managerDepartmentKey)
        .filter((u) => ['intern', 'employee', 'projectmanager'].includes(u.role))
        .map((u) => ({ id: u.id, name: u.name || u.username || u.email }));
    }
    return [{ id: user?.id, name: user?.name || 'Я' }];
  }, [canManageAll, canManageDepartment, managerDepartmentKey, mockUsers, user?.id, user?.name]);

  const selectedAssigneeNames = useMemo(() => {
    const byId = new Map(assigneeOptions.map((a) => [String(a.id), a.name]));
    return selectedAssigneeIds.map((id) => byId.get(String(id))).filter(Boolean);
  }, [assigneeOptions, selectedAssigneeIds]);

  const addTask = () => {
    if (!form.title.trim()) return;
    const targetIds = canAssignTasks
      ? (selectedAssigneeIds.length > 0 ? selectedAssigneeIds : (form.assigneeId ? [String(form.assigneeId)] : []))
      : [String(user?.id)];
    if (targetIds.length === 0) return;

    const tasksToCreate = targetIds.map((assigneeId, idx) => {
      const assignee = assigneeOptions.find(a => String(a.id) === String(assigneeId));
      const nowTs = Date.now() + idx;
      return {
        id: nowTs,
        title: form.title.trim(),
        description: form.description.trim(),
        project: form.project.trim() || 'Без проекта',
        col: form.col,
        priority: form.priority,
        assigneeId: Number(assigneeId) || user?.id,
        assignee: assignee?.name || user?.name || '—',
        date: form.date || null,
        comments: [],
        attachments: [],
        history: [
          { id: `h-${nowTs}`, at: nowLabel(), by: user?.name || 'Система', from: null, to: form.col, note: 'Задача создана' }
        ],
      };
    });

    setAllTasks(t => [...t, ...tasksToCreate]);
    setForm({
      title: '',
      description: '',
      project: '',
      priority: 'normal',
      assigneeId: canAssignTasks
        ? (isAdmin && adminTaskView === 'my' ? (user?.id || '') : '')
        : (user?.id || ''),
      date: '',
      col: 'new',
    });
    setSelectedAssigneeIds(isAdmin && adminTaskView === 'employees' ? [] : (user?.id ? [String(user.id)] : []));
    setModal(false);
  };

  const deleteTask = (id) => setAllTasks(t => t.filter(x => x.id !== id));

  const moveTask = (id, col) => {
    setAllTasks(t => t.map(x => {
      if (x.id !== id) return x;
      const history = Array.isArray(x.history) ? x.history : [];
      return {
        ...x,
        col,
        history: [
          ...history,
          { id: `h-${Date.now()}-${Math.random()}`, at: nowLabel(), by: user?.name || 'Система', from: x.col, to: col, note: 'Смена статуса' }
        ],
      };
    }));
    if (detail?.id === id) {
      setDetail(d => d ? { ...d, col } : d);
    }
  };

  const openDetail = (task) => {
    setDetail(task);
    setCommentText('');
  };

  const addComment = () => {
    if (!detail || !commentText.trim()) return;
    const newComment = { id: `c-${Date.now()}`, author: user?.name || 'Пользователь', text: commentText.trim(), at: nowLabel() };
    setAllTasks(ts => ts.map(t => t.id === detail.id ? { ...t, comments: [...(t.comments || []), newComment] } : t));
    setDetail(d => d ? { ...d, comments: [...(d.comments || []), newComment] } : d);
    setCommentText('');
  };

  const addAttachments = (files) => {
    if (!detail || !files?.length) return;
    const mapped = Array.from(files).map(f => ({ id: `a-${Date.now()}-${f.name}`, name: f.name, size: Math.round(f.size / 1024) + ' KB' }));
    setAllTasks(ts => ts.map(t => t.id === detail.id ? { ...t, attachments: [...(t.attachments || []), ...mapped] } : t));
    setDetail(d => d ? { ...d, attachments: [...(d.attachments || []), ...mapped] } : d);
  };

  const colCount = (colId) => tasks.filter(t => t.col === colId).length;
  const projectStats = useMemo(() => {
    const grouped = tasks.reduce((acc, task) => {
      const projectName = task.project?.trim() || 'Без проекта';
      if (!acc[projectName]) acc[projectName] = [];
      acc[projectName].push(task);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, items]) => {
      const total = items.length;
      const done = items.filter(t => t.col === 'done').length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      const byCol = {
        new: items.filter(t => t.col === 'new').length,
        progress: items.filter(t => t.col === 'progress').length,
        review: items.filter(t => t.col === 'review').length,
        done: items.filter(t => t.col === 'done').length,
      };
      return { name, total, done, progress, items, byCol };
    });
  }, [tasks]);

  const visibleProjectStats = useMemo(() => projectStats.slice(0, 3), [projectStats]);
  const workspaceMembers = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      const key = String(t.assigneeId || t.assignee || t.id);
      if (!map.has(key)) map.set(key, t.assignee || '—');
    });
    return Array.from(map.values());
  }, [tasks]);

  const workspaceBoardCols = useMemo(() => {
    return COLUMNS.map((col) => {
      const colTasks = tasks.filter((t) => t.col === col.id);
      const grouped = {};
      colTasks.forEach((task) => {
        const projectName = task.project?.trim() || 'Без проекта';
        if (!grouped[projectName]) grouped[projectName] = [];
        grouped[projectName].push(task);
      });
      const projects = Object.entries(grouped)
        .map(([project, projectTasks]) => ({ project, tasks: projectTasks }))
        .sort((a, b) => b.tasks.length - a.tasks.length);
      return {
        ...col,
        count: colTasks.length,
        projects,
      };
    });
  }, [tasks]);

  const pmTeamWorkRows = useMemo(() => {
    if (!isProjectManager) return [];
    const grouped = {};
    tasks.forEach(task => {
      const key = String(task.assigneeId || task.assignee || task.id);
      if (!grouped[key]) {
        const userInfo = mockUsers.find(u => String(u.id) === String(task.assigneeId));
        grouped[key] = {
          assignee: task.assignee || '—',
          department: userInfo?.department || 'Без отдела',
          new: 0,
          progress: 0,
          review: 0,
          done: 0,
          current: '—',
        };
      }
      grouped[key][task.col] = (grouped[key][task.col] || 0) + 1;
      if (grouped[key].current === '—' && task.col !== 'done') grouped[key].current = task.title;
    });
    return Object.values(grouped);
  }, [isProjectManager, mockUsers, tasks]);

  const adminTeamRows = useMemo(() => {
    if (!isAdminOrSuper) return [];
    const grouped = {};
    managedTeamTasks.forEach(task => {
      const userInfo = mockUsers.find(u => String(u.id) === String(task.assigneeId));
      const department = userInfo?.department || 'Без отдела';
      if (!grouped[department]) {
        grouped[department] = {
          department,
          users: new Set(),
          total: 0,
          done: 0,
          progress: 0,
          review: 0,
          new: 0,
        };
      }
      grouped[department].users.add(task.assigneeId || task.assignee);
      grouped[department].total += 1;
      grouped[department][task.col] = (grouped[department][task.col] || 0) + 1;
      if (task.col === 'done') grouped[department].done += 1;
    });
    return Object.values(grouped).map(row => ({
      ...row,
      usersCount: row.users.size,
      progressPercent: row.total > 0 ? Math.round((row.done / row.total) * 100) : 0,
    }));
  }, [isAdminOrSuper, managedTeamTasks, mockUsers]);

  const adminEmployeeRows = useMemo(() => {
    if (!isAdminOrSuper) return [];
    const grouped = {};
    managedTeamTasks.forEach(task => {
      const key = String(task.assigneeId || task.assignee || task.id);
      const userInfo = mockUsers.find(u => String(u.id) === String(task.assigneeId));
      if (!grouped[key]) {
        grouped[key] = {
          assignee: task.assignee || userInfo?.name || '—',
          department: userInfo?.department || 'Без отдела',
          team: userInfo?.subdivision || 'Без команды',
          total: 0,
          done: 0,
          progress: 0,
          review: 0,
          new: 0,
          current: '—',
        };
      }
      grouped[key].total += 1;
      grouped[key][task.col] = (grouped[key][task.col] || 0) + 1;
      if (task.col === 'done') grouped[key].done += 1;
      if (grouped[key].current === '—' && task.col !== 'done') grouped[key].current = task.title;
    });

    return Object.values(grouped).map((row) => ({
      ...row,
      progressPercent: row.total > 0 ? Math.round((row.done / row.total) * 100) : 0,
    }));
  }, [isAdminOrSuper, managedTeamTasks, mockUsers]);

  const projectAssignmentRows = useMemo(() => {
    if (!isProjectManager && !isAdminOrSuper) return [];
    const source = isProjectManager ? tasks : managedTeamTasks;
    const grouped = {};

    source.forEach((task) => {
      const key = String(task.assigneeId || task.assignee || task.id);
      const userInfo = mockUsers.find((u) => String(u.id) === String(task.assigneeId));
      if (!grouped[key]) {
        grouped[key] = {
          assigneeId: task.assigneeId,
          assignee: task.assignee || userInfo?.name || '—',
          department: userInfo?.department || 'Без отдела',
          projects: new Set(),
          activeProject: '—',
          total: 0,
        };
      }
      const projectName = task.project?.trim() || 'Без проекта';
      grouped[key].projects.add(projectName);
      grouped[key].total += 1;
      if (grouped[key].activeProject === '—' && task.col !== 'done') {
        grouped[key].activeProject = projectName;
      }
    });

    return Object.values(grouped).map((row) => ({
      ...row,
      projectsCount: row.projects.size,
      projectsList: Array.from(row.projects).join(', '),
    }));
  }, [isAdminOrSuper, isProjectManager, managedTeamTasks, mockUsers, tasks]);

  const adminProjectRows = useMemo(() => {
    if (!isAdminOrSuper) return [];
    const grouped = {};
    managedTeamTasks.forEach((task) => {
      const projectName = task.project?.trim() || 'Без проекта';
      if (!grouped[projectName]) {
        grouped[projectName] = {
          project: projectName,
          total: 0,
          done: 0,
          progress: 0,
          members: new Map(),
        };
      }
      grouped[projectName].total += 1;
      if (task.col === 'done') grouped[projectName].done += 1;

      const memberKey = String(task.assigneeId || task.assignee || task.id);
      const userInfo = mockUsers.find((u) => String(u.id) === String(task.assigneeId));
      if (!grouped[projectName].members.has(memberKey)) {
        grouped[projectName].members.set(memberKey, {
          assignee: task.assignee || userInfo?.name || '—',
          role: roleLabelMap[String(task.assigneeId)] || userInfo?.role || 'Сотрудник',
          total: 0,
          done: 0,
          inWork: 0,
          current: '—',
        });
      }
      const member = grouped[projectName].members.get(memberKey);
      member.total += 1;
      if (task.col === 'done') member.done += 1;
      if (task.col === 'progress') member.inWork += 1;
      if (member.current === '—' && task.col !== 'done') member.current = task.title;
    });

    return Object.values(grouped).map((row) => ({
      ...row,
      progress: row.total > 0 ? Math.round((row.done / row.total) * 100) : 0,
      membersCount: row.members.size,
      members: Array.from(row.members.values()),
    })).sort((a, b) => b.total - a.total);
  }, [isAdminOrSuper, managedTeamTasks, mockUsers, roleLabelMap]);

  const openProjectDetails = (row) => {
    const source = isProjectManager ? tasks : managedTeamTasks;
    const personTasks = source.filter((t) => String(t.assigneeId) === String(row.assigneeId));
    const grouped = {};

    personTasks.forEach((task) => {
      const projectName = task.project?.trim() || 'Без проекта';
      if (!grouped[projectName]) {
        grouped[projectName] = {
          name: projectName,
          total: 0,
          done: 0,
          progress: 0,
          participants: new Map(),
        };
      }
      grouped[projectName].total += 1;
      if (task.col === 'done') grouped[projectName].done += 1;
    });

    Object.values(grouped).forEach((project) => {
      source
        .filter((t) => (t.project?.trim() || 'Без проекта') === project.name)
        .forEach((t) => {
          const participant = mockUsers.find((u) => String(u.id) === String(t.assigneeId));
          const pid = String(t.assigneeId || t.assignee || t.id);
          project.participants.set(pid, {
            name: t.assignee || participant?.name || '—',
            role: roleLabelMap[String(t.assigneeId)] || participant?.role || 'Сотрудник',
          });
        });
      project.progress = project.total > 0 ? Math.round((project.done / project.total) * 100) : 0;
      project.participants = Array.from(project.participants.values());
    });

    setProjectDetails({
      assignee: row.assignee,
      department: row.department,
      projects: Object.values(grouped).sort((a, b) => b.total - a.total),
    });
  };

  return (
    <MainLayout title={isProjectWorkspace ? 'Проекты' : 'Трекер задач'}>
      <div className="page-header">
        <div>
          <div className="page-title">{isProjectWorkspace ? 'Проекты' : 'Трекер задач'}</div>
          <div className="page-subtitle">
            {isProjectWorkspace
              ? 'Проекты, прогресс выполнения и таблицы по статусам задач'
              : 'Исполнитель, дедлайн, комментарии, вложения и история статусов'}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <Plus size={15} /> Новая задача
        </button>
      </div>

      {isAdmin && (
        <div style={{ display: 'inline-flex', gap: 8, marginBottom: 16, padding: 4, borderRadius: 12, border: '1px solid var(--gray-200)', background: '#fff' }}>
          <button
            className={`btn btn-sm ${adminTaskView === 'my' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAdminTaskView('my')}
          >
            Мои задачи
          </button>
          <button
            className={`btn btn-sm ${adminTaskView === 'employees' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAdminTaskView('employees')}
          >
            Задачи сотрудников
          </button>
        </div>
      )}

      {isAdminOrSuper && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header"><span className="card-title">Проекты сотрудников</span></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ПРОЕКТ</th>
                  <th>ЗАДАЧ</th>
                  <th>СДЕЛАНО</th>
                  <th>ПРОГРЕСС</th>
                  <th>УЧАСТНИКИ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {adminProjectRows.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ color: 'var(--gray-500)' }}>Нет проектов сотрудников.</td>
                  </tr>
                )}
                {adminProjectRows.map((row) => (
                  <tr key={`proj-${row.project}`}>
                    <td>{row.project}</td>
                    <td>{row.total}</td>
                    <td>{row.done}</td>
                    <td>{row.progress}%</td>
                    <td>{row.membersCount}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setProjectTeamDetails(row)}>
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isProjectWorkspace && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {COLUMNS.map(col => (
            <div key={col.id} style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '12px 16px', borderTop: '3px solid ' + col.color }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: col.color }}>{colCount(col.id)}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{col.title}</div>
            </div>
          ))}
        </div>
      )}

      {isProjectWorkspace && projectStats.length === 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ color: 'var(--gray-500)' }}>
            Проектов пока нет. Создайте первую задачу и укажите проект.
          </div>
        </div>
      )}

      {!isProjectWorkspace && tasks.length === 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ color: 'var(--gray-500)' }}>
            Для вас пока нет задач. Они появятся после назначения.
          </div>
        </div>
      )}

      {isProjectWorkspace ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>
                {isAdminOrSuper ? 'Мои задачи' : 'Задачи'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                {workspaceMembers.length > 0 ? workspaceMembers.join(', ') : 'Участники появятся после назначения задач.'}
              </div>
            </div>
          </div>

          <div className="kanban-board">
            {workspaceBoardCols.map((col) => (
              <div key={`workspace-${col.id}`} className="kanban-col" style={{ minWidth: 310, maxWidth: 340 }}>
                <div className="kanban-col-header" style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 30, lineHeight: 1, fontWeight: 800, color: col.color }}>{col.count}</span>
                    <span className="kanban-col-title" style={{ background: col.bg, color: col.color }}>{col.title}</span>
                  </div>
                </div>

                {col.projects.map((group) => (
                  <div key={`${col.id}-${group.project}`} style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{group.project}</div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: col.color, background: col.bg, borderRadius: 999, padding: '2px 8px' }}>
                        {group.tasks.length}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {group.tasks.map((task) => (
                        <TaskCard key={task.id} task={task} onDelete={deleteTask} onMove={moveTask} columns={COLUMNS} onOpen={openDetail} />
                      ))}
                    </div>
                    <button
                      className="kanban-new-task"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        setForm((f) => ({ ...f, col: col.id, project: group.project }));
                        setModal(true);
                      }}
                    >
                      <Plus size={13} /> Добавить задачу
                    </button>
                  </div>
                ))}

                <button
                  className="kanban-new-task"
                  onClick={() => {
                    setForm((f) => ({ ...f, col: col.id }));
                    setModal(true);
                  }}
                >
                  <Plus size={13} /> Добавить задачу
                </button>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Таблица прогресса по проектам</span></div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ПРОЕКТ</th>
                    <th>НОВЫЕ</th>
                    <th>В РАБОТЕ</th>
                    <th>НА ПРОВЕРКЕ</th>
                    <th>СДЕЛАНО</th>
                    <th>ПРОГРЕСС</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProjectStats.map(p => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td>{p.byCol.new}</td>
                      <td>{p.byCol.progress}</td>
                      <td>{p.byCol.review}</td>
                      <td>{p.byCol.done}</td>
                      <td>{p.progress}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {isProjectManager && (
            <div className="card">
              <div className="card-header"><span className="card-title">Команда: кто над чем работает</span></div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>СОТРУДНИК</th>
                      <th>ОТДЕЛ</th>
                      <th>НОВЫЕ</th>
                      <th>В РАБОТЕ</th>
                      <th>ПРОВЕРКА</th>
                      <th>СДЕЛАНО</th>
                      <th>ТЕКУЩАЯ ЗАДАЧА</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pmTeamWorkRows.map((row, i) => (
                      <tr key={`${row.assignee}-${i}`}>
                        <td>{row.assignee}</td>
                        <td>{row.department}</td>
                        <td>{row.new}</td>
                        <td>{row.progress}</td>
                        <td>{row.review}</td>
                        <td>{row.done}</td>
                        <td>{row.current}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(isProjectManager || isAdminOrSuper) && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  {isProjectManager ? 'Команда отдела: кто в каких проектах' : 'Сотрудники: кто в каких проектах'}
                </span>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>СОТРУДНИК</th>
                      <th>ОТДЕЛ</th>
                      <th>ПРОЕКТОВ</th>
                      <th>ТЕКУЩИЙ ПРОЕКТ</th>
                      <th>ВСЕ ПРОЕКТЫ</th>
                      <th>ЗАДАЧ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectAssignmentRows.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ color: 'var(--gray-500)' }}>
                          Нет данных по проектам сотрудников.
                        </td>
                      </tr>
                    )}
                    {projectAssignmentRows.map((row, i) => (
                      <tr key={`${row.assignee}-projects-${i}`}>
                        <td>{row.assignee}</td>
                        <td>{row.department}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openProjectDetails(row)}
                          >
                            {row.projectsCount}
                          </button>
                        </td>
                        <td>{row.activeProject}</td>
                        <td>{row.projectsList || '—'}</td>
                        <td>{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isAdminOrSuper && (
            <div className="card">
              <div className="card-header"><span className="card-title">Сотрудники: выполнение задач</span></div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>СОТРУДНИК</th>
                      <th>ОТДЕЛ</th>
                      <th>КОМАНДА</th>
                      <th>ЗАДАЧ ВСЕГО</th>
                      <th>СДЕЛАНО</th>
                      <th>В РАБОТЕ</th>
                      <th>ТЕКУЩАЯ ЗАДАЧА</th>
                      <th>ПРОГРЕСС</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminEmployeeRows.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ color: 'var(--gray-500)' }}>
                          Нет задач сотрудников для расчёта прогресса.
                        </td>
                      </tr>
                    )}
                    {adminEmployeeRows.map((row, i) => (
                      <tr key={`${row.assignee}-${i}`}>
                        <td>{row.assignee}</td>
                        <td>{row.department}</td>
                        <td>{row.team}</td>
                        <td>{row.total}</td>
                        <td>{row.done}</td>
                        <td>{row.progress}</td>
                        <td>{row.current}</td>
                        <td>{row.progressPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isAdminOrSuper && (
            <div className="card">
              <div className="card-header"><span className="card-title">Все команды: общий прогресс</span></div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>КОМАНДА / ОТДЕЛ</th>
                      <th>СОТРУДНИКОВ</th>
                      <th>ЗАДАЧ ВСЕГО</th>
                      <th>СДЕЛАНО</th>
                      <th>В РАБОТЕ</th>
                      <th>ПРОГРЕСС</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminTeamRows.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ color: 'var(--gray-500)' }}>
                          Нет данных по командам.
                        </td>
                      </tr>
                    )}
                    {adminTeamRows.map(row => (
                      <tr key={row.department}>
                        <td>{row.department}</td>
                        <td>{row.usersCount}</td>
                        <td>{row.total}</td>
                        <td>{row.done}</td>
                        <td>{row.progress}</td>
                        <td>{row.progressPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.col === col.id);
            return (
              <div key={col.id} className="kanban-col">
                <div className="kanban-col-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                    <span className="kanban-col-title">{col.title}</span>
                    <span style={{ marginLeft: 4, background: col.bg, color: col.color, fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>{colTasks.length}</span>
                  </div>
                </div>
                {colTasks.map(task => (
                  <TaskCard key={task.id} task={task} onDelete={deleteTask} onMove={moveTask} columns={COLUMNS} onOpen={openDetail} />
                ))}
                <button className="kanban-new-task" onClick={() => { setForm(f => ({ ...f, col: col.id })); setModal(true); }}>
                  <Plus size={13} /> Добавить задачу
                </button>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title">Новая задача</div>
              <button className="btn-icon" onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Название задачи *</label>
                <input className="form-input" placeholder="Опишите задачу..." value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Описание</label>
                <textarea className="form-textarea" style={{ minHeight: 80 }} placeholder="Детали задачи"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Проект</label>
                <input className="form-input" placeholder="Например: CRM аудит" value={form.project}
                  onChange={e => setForm(f => ({ ...f, project: e.target.value }))} />
              </div>
              <div className="grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Приоритет</label>
                  <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="high">Высокий</option>
                    <option value="normal">Средний</option>
                    <option value="low">Низкий</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Колонка</label>
                  <select className="form-select" value={form.col} onChange={e => setForm(f => ({ ...f, col: e.target.value }))}>
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">{canAssignTasks ? 'Исполнители (можно несколько)' : 'Исполнитель'}</label>
                  {canAssignTasks ? (
                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 12, padding: 10, minHeight: 126 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {selectedAssigneeNames.length === 0 && (
                          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Выбери одного или нескольких сотрудников</span>
                        )}
                        {selectedAssigneeNames.map((name) => (
                          <span
                            key={name}
                            style={{ fontSize: 11, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 999, padding: '2px 8px' }}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                      <div style={{ maxHeight: 150, overflowY: 'auto', display: 'grid', gap: 6 }}>
                        {assigneeOptions.map((a) => {
                          const selected = selectedAssigneeIds.includes(String(a.id));
                          return (
                            <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...selectedAssigneeIds, String(a.id)]
                                    : selectedAssigneeIds.filter((id) => id !== String(a.id));
                                  setSelectedAssigneeIds(next);
                                  setForm((f) => ({ ...f, assigneeId: next[0] || '' }));
                                }}
                              />
                              {a.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <input className="form-input" value={user?.name || 'Я'} disabled />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Дедлайн</label>
                  <input className="form-input" type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={addTask}>Создать задачу</button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <div className="modal-title">{detail.title}</div>
              <button className="btn-icon" onClick={() => setDetail(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Описание</div>
                <div style={{ fontSize: 13, marginBottom: 14 }}>{detail.description || 'Без описания'}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Комментарии</div>
                <div style={{ maxHeight: 170, overflow: 'auto', marginBottom: 10, border: '1px solid var(--gray-200)', borderRadius: 10, padding: 10 }}>
                  {(detail.comments || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Комментариев пока нет</div>}
                  {(detail.comments || []).map(c => (
                    <div key={c.id} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{c.author} · {c.at}</div>
                      <div style={{ fontSize: 13 }}>{c.text}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" placeholder="Комментарий..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                  <button className="btn btn-primary btn-sm" onClick={addComment}>Добавить</button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Вложения</div>
                <div style={{ maxHeight: 130, overflow: 'auto', marginBottom: 10, border: '1px solid var(--gray-200)', borderRadius: 10, padding: 10 }}>
                  {(detail.attachments || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Файлов пока нет</div>}
                  {(detail.attachments || []).map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span>{a.name}</span><span style={{ color: 'var(--gray-500)' }}>{a.size}</span>
                    </div>
                  ))}
                </div>
                <input type="file" multiple onChange={e => addAttachments(e.target.files)} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 8, fontSize: 12, color: 'var(--gray-500)' }}>
                  <History size={14} /> История статусов
                </div>
                <div style={{ maxHeight: 170, overflow: 'auto', border: '1px solid var(--gray-200)', borderRadius: 10, padding: 10 }}>
                  {(detail.history || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Истории пока нет</div>}
                  {(detail.history || []).map(h => (
                    <div key={h.id} style={{ marginBottom: 8, fontSize: 12 }}>
                      <div style={{ color: 'var(--gray-600)' }}>{h.at} · {h.by}</div>
                      <div>{h.note}: {h.from || '—'} → {h.to || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {projectDetails && (
        <div className="modal-overlay" onClick={() => setProjectDetails(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <div className="modal-title">
                Проекты сотрудника: {projectDetails.assignee}
              </div>
              <button className="btn-icon" onClick={() => setProjectDetails(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>
                Отдел: {projectDetails.department}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ПРОЕКТ</th>
                      <th>ЗАДАЧ</th>
                      <th>СДЕЛАНО</th>
                      <th>ПРОГРЕСС</th>
                      <th>УЧАСТНИКИ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectDetails.projects.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ color: 'var(--gray-500)' }}>
                          У сотрудника пока нет проектов.
                        </td>
                      </tr>
                    )}
                    {projectDetails.projects.map((p) => (
                      <tr key={p.name}>
                        <td>{p.name}</td>
                        <td>{p.total}</td>
                        <td>{p.done}</td>
                        <td>{p.progress}%</td>
                        <td>
                          {p.participants.map((x) => `${x.name} (${x.role})`).join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {projectTeamDetails && (
        <div className="modal-overlay" onClick={() => setProjectTeamDetails(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
            <div className="modal-header">
              <div className="modal-title">Проект: {projectTeamDetails.project}</div>
              <button className="btn-icon" onClick={() => setProjectTeamDetails(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>
                Задач: {projectTeamDetails.total} · Сделано: {projectTeamDetails.done} · Прогресс: {projectTeamDetails.progress}%
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>СОТРУДНИК</th>
                      <th>РОЛЬ</th>
                      <th>ЗАДАЧ</th>
                      <th>СДЕЛАНО</th>
                      <th>В РАБОТЕ</th>
                      <th>ОТВЕЧАЕТ СЕЙЧАС</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectTeamDetails.members.map((m, i) => (
                      <tr key={`${m.assignee}-${i}`}>
                        <td>{m.assignee}</td>
                        <td>{m.role}</td>
                        <td>{m.total}</td>
                        <td>{m.done}</td>
                        <td>{m.inWork}</td>
                        <td>{m.current}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
