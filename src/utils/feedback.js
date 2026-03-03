export const FEEDBACK_TYPE_CODES = {
  suggestion: 'suggestion',
  complaint: 'complaint',
  question: 'question',
};

export const FEEDBACK_TYPE_LABELS = {
  suggestion: 'Предложение',
  complaint: 'Жалоба',
  question: 'Вопрос',
};

export const FEEDBACK_TYPE_OPTIONS = [
  { value: FEEDBACK_TYPE_CODES.suggestion, label: FEEDBACK_TYPE_LABELS.suggestion },
  { value: FEEDBACK_TYPE_CODES.complaint, label: FEEDBACK_TYPE_LABELS.complaint },
  { value: FEEDBACK_TYPE_CODES.question, label: FEEDBACK_TYPE_LABELS.question },
];

export function normalizeFeedbackType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return FEEDBACK_TYPE_CODES.suggestion;
  if (raw === 'предложение' || raw === 'suggestion') return FEEDBACK_TYPE_CODES.suggestion;
  if (raw === 'жалоба' || raw === 'complaint') return FEEDBACK_TYPE_CODES.complaint;
  if (raw === 'вопрос' || raw === 'question') return FEEDBACK_TYPE_CODES.question;
  return FEEDBACK_TYPE_CODES.suggestion;
}

export function getFeedbackTypeLabel(value) {
  const code = normalizeFeedbackType(value);
  return FEEDBACK_TYPE_LABELS[code] || FEEDBACK_TYPE_LABELS.suggestion;
}

export function buildFeedbackCreatePayload({ type, text, isAnonymous }) {
  const typeCode = normalizeFeedbackType(type);
  const typeLabel = getFeedbackTypeLabel(typeCode);
  const cleanText = String(text || '').trim();

  return {
    type: typeCode,
    category: typeCode,
    kind: typeCode,
    type_label: typeLabel,
    text: cleanText,
    message: cleanText,
    body: cleanText,
    is_anonymous: Boolean(isAnonymous),
    anonymous: Boolean(isAnonymous),
  };
}
