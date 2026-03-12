import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Check } from 'lucide-react';
import { authAPI } from '../../api/auth';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [form, setForm] = useState({
    token: tokenFromUrl,
    new_password: '',
    confirm: '',
  });
  const [showPass, setShowPass] = useState({ new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.token.trim()) { setError('Введите токен из письма.'); return; }
    if (form.new_password.length < 6) { setError('Пароль должен быть не менее 6 символов.'); return; }
    if (form.new_password !== form.confirm) { setError('Пароли не совпадают.'); return; }
    setLoading(true);
    try {
      await authAPI.confirmPasswordReset(form.token.trim(), form.new_password);
      setDone(true);
    } catch (err) {
      const data = err?.response?.data;
      setError(
        data?.error
          ? Array.isArray(data.error) ? data.error.join(' ') : String(data.error)
          : data?.detail || 'Неверный или истёкший токен.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="auth-logo-text">В Плюсе</span>
        </div>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px auto' }}>
          <Check size={28} color="var(--success)" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Пароль успешно изменён</h2>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>
          Теперь вы можете войти с новым паролем.
        </p>
        <button className="btn btn-primary w-full btn-lg" style={{ justifyContent: 'center' }} onClick={() => navigate('/login')}>
          Перейти ко входу
        </button>
        <div className="auth-footer">© 2025 В Плюсе. Внутренняя корпоративная платформа.</div>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="auth-logo-text">В Плюсе</span>
        </div>
        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>
          Новый пароль
        </h2>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>
          {tokenFromUrl ? 'Придумайте новый пароль' : 'Введите токен из письма и новый пароль'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!tokenFromUrl && (
            <div className="form-group">
              <label className="form-label">Код из письма (токен)</label>
              <input
                className="form-input"
                value={form.token}
                onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                placeholder="Вставьте токен из письма"
                required
              />
            </div>
          )}

          {[
            { key: 'new_password', label: 'Новый пароль', showKey: 'new' },
            { key: 'confirm', label: 'Подтвердите пароль', showKey: 'confirm' },
          ].map(({ key, label, showKey }) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPass[showKey] ? 'text' : 'password'}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{ paddingRight: 40 }}
                  required
                  minLength={6}
                />
                <button type="button"
                  onClick={() => setShowPass((s) => ({ ...s, [showKey]: !s[showKey] }))}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer' }}>
                  {showPass[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--danger)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ justifyContent: 'center', marginTop: 4 }}>
            {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
          </button>
          <button type="button" className="btn btn-secondary btn-lg w-full" style={{ justifyContent: 'center' }} onClick={() => navigate('/login')}>
            Назад ко входу
          </button>
        </form>
        <div className="auth-footer">© 2025 В Плюсе. Внутренняя корпоративная платформа.</div>
      </div>
    </div>
  );
}
