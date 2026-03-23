import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { exitInterviewsAPI } from '../../api/auth';

const INITIAL_FORM = {
  reason: '',
  management_rating: 5,
  comment: '',
};

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ExitInterview() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    exitInterviewsAPI.getByToken(token)
      .then((res) => {
        if (!active) return;
        setState(res.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.detail || 'Ссылка недействительна или не найдена.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await exitInterviewsAPI.submitByToken(token, form);
      setState(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось отправить анкету.');
    } finally {
      setSubmitting(false);
    }
  };

  const isCompleted = state?.status === 'completed';
  const isRevoked = state?.status === 'revoked';
  const isAvailable = state?.is_available;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 55%, #ecfeff 100%)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 760,
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 30px 80px rgba(15, 23, 42, 0.12)',
        padding: '32px',
        border: '1px solid rgba(148, 163, 184, 0.18)',
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: '#2563eb', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Exit Interview
          </div>
          <h1 style={{ margin: '10px 0 8px', fontSize: 34, lineHeight: 1.1, color: '#0f172a' }}>
            Анонимная анкета сотрудника
          </h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#475569' }}>
            Ваши ответы помогут улучшить процессы, взаимодействие с менеджментом и общий опыт работы в компании. После отправки ответ сохраняется без привязки к вашей учетной записи.
          </p>
        </div>

        {loading ? <div>Загрузка анкеты...</div> : null}
        {!loading && error ? <div style={{ color: '#b91c1c', marginBottom: 16 }}>{error}</div> : null}

        {!loading && !error && isCompleted ? (
          <div style={{ padding: 20, borderRadius: 18, background: '#f0fdf4', color: '#166534' }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Спасибо, анкета отправлена.</div>
            <div>Ответ был зафиксирован {formatDateTime(state?.submitted_at)}.</div>
          </div>
        ) : null}

        {!loading && !error && isRevoked ? (
          <div style={{ padding: 20, borderRadius: 18, background: '#fff7ed', color: '#9a3412' }}>
            Ссылка была отменена и больше не используется.
          </div>
        ) : null}

        {!loading && !error && isAvailable ? (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: 18 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Причина ухода</span>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={5}
                  required
                  style={{ borderRadius: 14, border: '1px solid #cbd5e1', padding: 14, fontSize: 15, resize: 'vertical' }}
                  placeholder="Что повлияло на решение уйти?"
                />
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Оценка менеджмента</span>
                <select
                  value={form.management_rating}
                  onChange={(e) => setForm((prev) => ({ ...prev, management_rating: Number(e.target.value) }))}
                  style={{ borderRadius: 14, border: '1px solid #cbd5e1', padding: 14, fontSize: 15 }}
                >
                  <option value={5}>5 - отлично</option>
                  <option value={4}>4 - хорошо</option>
                  <option value={3}>3 - нормально</option>
                  <option value={2}>2 - слабо</option>
                  <option value={1}>1 - очень плохо</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Комментарий</span>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
                  rows={4}
                  style={{ borderRadius: 14, border: '1px solid #cbd5e1', padding: 14, fontSize: 15, resize: 'vertical' }}
                  placeholder="Что нам стоит улучшить в первую очередь?"
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <div style={{ color: '#64748b', fontSize: 14 }}>
                Ссылка одноразовая. После отправки повторное заполнение будет недоступно.
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  background: '#0f172a',
                  color: '#fff',
                  padding: '14px 22px',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                {submitting ? 'Отправка...' : 'Отправить анкету'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
