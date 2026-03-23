import { useState } from 'react';
import { CheckCircle, KeyRound, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../api/auth';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    setError('');
    setLoading(true);
    try {
      await authAPI.requestPasswordReset(value.trim());
      setSent(true);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error;
      setError(msg || 'Не удалось отправить запрос. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="auth-logo-text">В Плюсе</span>
        </div>

        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px auto 16px' }}>
          <KeyRound size={24} color="#2563EB" />
        </div>

        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>
          Забыли пароль?
        </h2>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <CheckCircle size={48} color="#16A34A" />
            </div>
            <p style={{ fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.7, marginBottom: 24 }}>
              Если аккаунт найден, мы отправили <strong>временный пароль</strong> на привязанный email.<br />
              Войдите с ним — система попросит сразу сменить пароль.
            </p>
            <button className="btn btn-primary btn-lg w-full" style={{ justifyContent: 'center' }} onClick={() => navigate('/login')}>
              Перейти ко входу
            </button>
          </div>
        ) : (
          <>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-500)', marginBottom: 24, lineHeight: 1.6 }}>
              Введите ваш логин или email. Мы пришлём временный пароль для входа.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Логин или Email</label>
                <input
                  className="form-input"
                  type="text"
                  autoComplete="username"
                  placeholder="username или email@example.com"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div style={{ color: 'var(--danger)', fontSize: 13, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>
                  {error}
                </div>
              )}

              <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ justifyContent: 'center' }}>
                {loading ? <><Loader size={16} className="spin" /> Отправка...</> : 'Получить временный пароль'}
              </button>

              <button className="btn btn-secondary btn-lg w-full" type="button" style={{ justifyContent: 'center' }} onClick={() => navigate('/login')}>
                Назад ко входу
              </button>
            </form>
          </>
        )}

        <div className="auth-footer">© 2026 В Плюсе. Внутренняя корпоративная платформа.</div>
      </div>
    </div>
  );
}
