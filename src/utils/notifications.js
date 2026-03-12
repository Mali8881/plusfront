import { newsAPI, feedbackAPI } from '../api/content';
import { promotionRequestsAPI } from '../api/auth';
import { getScheduleRequests } from './scheduleApproval';
import { normalizeRole, isAdminRole } from './roles';

const seenKey = (userId) => `vpluse_notifications_seen_${userId}`;

function safeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function readSeen(userId) {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function parseTs(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function tsLabel(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('ru-RU');
}

function normalizeFeedbackItem(raw = {}) {
  const statusRaw = String(raw.status || raw.state || '').toLowerCase();
  const status =
    statusRaw === 'resolved' || statusRaw === 'closed' || statusRaw === 'done'
      ? 'resolved'
      : statusRaw === 'in_progress' || statusRaw === 'processing' || statusRaw === 'pending'
      ? 'in_progress'
      : 'new';

  return {
    id: raw.id,
    userId: raw.user_id || raw.user?.id || raw.author_id || null,
    userName:
      raw.full_name ||
      raw.user_name ||
      raw.user?.full_name ||
      raw.user?.username ||
      raw.author_name ||
      'Пользователь',
    userRole: normalizeRole(raw.sender_role || raw.user_role || raw.user?.role || raw.user?.role_code || 'employee'),
    type: raw.type_label || raw.type || raw.kind || 'Обращение',
    text: raw.text || raw.message || raw.body || '',
    status,
    createdAt: raw.created_at || raw.date || '',
    updatedAt: raw.updated_at || raw.reviewed_at || raw.resolved_at || raw.created_at || '',
  };
}

function normalizePromotionItem(raw = {}) {
  return {
    id: raw.id,
    userName: raw.user_name || raw.full_name || raw.user?.full_name || raw.user?.username || 'Стажер',
    status: String(raw.status || 'pending').toLowerCase(),
    createdAt: raw.created_at || '',
  };
}

export const markAllNotificationsRead = (userId, ids) => {
  if (!userId) return;
  localStorage.setItem(seenKey(userId), JSON.stringify(ids));
};

export async function getNotificationsForUser(user) {
  if (!user?.id) return [];

  const role = normalizeRole(user.role);
  const notifications = [];
  const adminMode = isAdminRole(role);

  // 1) Site-wide news (all roles)
  try {
    const res = await newsAPI.list();
    const items = safeList(res?.data).slice(0, 20);
    items.forEach((n) => {
      const ts = n.published_at || n.created_at || n.updated_at || '';
      notifications.push({
        id: `news:${n.id}`,
        type: 'news',
        title: 'Новая новость',
        text: n.title || n.name || 'Новость компании',
        ts: tsLabel(ts),
        tsValue: parseTs(ts),
      });
    });
  } catch {
    // ignore temporary API errors
  }

  // 2) Admin-only endpoints. Non-admin roles often get 403 here.
  if (adminMode) {
    try {
      const res = await feedbackAPI.list();
      const tickets = safeList(res?.data).map(normalizeFeedbackItem);
      tickets
        .filter((t) => ['intern', 'employee', 'projectmanager'].includes(t.userRole))
        .filter((t) => t.status === 'new' || t.status === 'in_progress')
        .forEach((t) => {
          notifications.push({
            id: `feedback-admin:${t.id}:${t.status}`,
            type: 'feedback',
            title: t.status === 'new' ? 'Новое обращение' : 'Обращение в работе',
            text: `${t.userName}: ${t.text || t.type}`,
            ts: tsLabel(t.updatedAt || t.createdAt),
            tsValue: parseTs(t.updatedAt || t.createdAt),
          });
        });
    } catch {
      // ignore API errors
    }

    try {
      const res = await promotionRequestsAPI.list();
      const requests = safeList(res?.data).map(normalizePromotionItem);
      requests
        .filter((r) => r.status === 'pending')
        .forEach((r) => {
          notifications.push({
            id: `promotion-admin:${r.id}:pending`,
            type: 'promotion',
            title: 'Заявка на перевод стажера',
            text: `${r.userName} ожидает подтверждения`,
            ts: tsLabel(r.createdAt),
            tsValue: parseTs(r.createdAt),
          });
        });
    } catch {
      // endpoint may be unavailable in some environments
    }
  }

  // 3) Schedule approvals
  try {
    const schedule = getScheduleRequests();
    if (adminMode) {
      schedule
        .filter((r) => r.status === 'pending')
        .forEach((r) => {
          notifications.push({
            id: `schedule-admin:${r.id}:pending`,
            type: 'schedule',
            title: 'Новая заявка на график',
            text: `${r.userName || 'Сотрудник'}: ${r.schedule?.name || 'Новый график'}`,
            ts: String(r.createdAt || ''),
            tsValue: parseTs(r.createdAt),
          });
        });
    }
  } catch {
    // ignore local store parse errors
  }

  const uniq = new Map();
  notifications.forEach((n) => {
    if (!uniq.has(n.id)) uniq.set(n.id, n);
  });

  return Array.from(uniq.values()).sort((a, b) => (b.tsValue || 0) - (a.tsValue || 0));
}

export async function getUnreadCountForUser(user) {
  const items = await getNotificationsForUser(user);
  const seen = new Set(readSeen(user?.id));
  return items.filter((i) => !seen.has(i.id)).length;
}
