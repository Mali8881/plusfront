const CODE_ALIASES = {
  promotion: 'promotion_request',
  promotion_request: 'promotion_request',
  schedule: 'schedule_request',
  schedule_request: 'schedule_request',
  feedback: 'feedback_ticket',
  feedback_ticket: 'feedback_ticket',
  'feedback.new': 'feedback_ticket',
  'onboarding.day_unlocked': 'onboarding_day_unlocked',
  'onboarding.intern_completed': 'onboarding_intern_completed',
  'onboarding.intern_approved': 'onboarding_intern_approved',
  'regulation.updated': 'regulation_updated',
  'report.daily_reminder': 'report_daily_reminder',
  'report.daily_submitted': 'report_daily_submitted',
  'schedule.weekly_plan_deadline_missed': 'schedule_deadline_missed',
};

function normalizeCode(raw) {
  const code = String(raw || '').trim().toLowerCase();
  return CODE_ALIASES[code] || code;
}

function asRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

export function translateStatus(status, t) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return '';
  const translated = t(`status.${normalized}`, normalized);
  return translated || normalized;
}

export function mapNotification(notification, t) {
  const item = asRecord(notification);
  const payload = asRecord(item.payload);
  const params = asRecord(item.params);

  const rawCode = item.code || item.type || payload.code || payload.type;
  const code = normalizeCode(rawCode);
  const action_url = item.action_url || payload.action_url || item.actionUrl || payload.actionUrl || '';
  const severity = item.severity || payload.severity || '';

  const titleFromApi = item.title || payload.title || '';
  const messageFromApi = item.message || item.text || payload.message || payload.text || '';

  const titleByCode = code ? t(`notifications.code.${code}.title`, '') : '';
  const messageByCode = code ? t(`notifications.code.${code}.message`, '') : '';

  let message = messageFromApi || messageByCode || t('notifications.fallback.message', 'New event');
  const status = translateStatus(item.status || payload.status || params.status, t);
  if (status && !message.includes(status)) {
    message = `${message} (${status})`;
  }

  return {
    id: item.id || `${code || 'notification'}:${item.created_at || Date.now()}`,
    title: titleFromApi || titleByCode || t('notifications.fallback.title', 'Notification'),
    message,
    created_at: item.created_at || payload.created_at || '',
    code,
    severity,
    action_url,
    raw: item,
  };
}

