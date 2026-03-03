import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, User } from 'lucide-react';
import { pathFromLanding, landingFromRole } from '../../utils/roles';

const ROLE_COLORS = {
  intern: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  employee: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  projectmanager: { bg: '#FAF5FF', color: '#7C3AED', border: '#DDD6FE' },
  admin: { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
  administrator: { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
  systemadmin: { bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC' },
  superadmin: { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
};

const ROLE_ICONS = {
  intern: '🎓',
  employee: '💼',
  projectmanager: '📋',
  admin: '🛡️',
  superadmin: '👑',
};

const FALLBACK = { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' };

export default function Login() {
  const { login, loading, mockUsers = [], USE_MOCK } = useAuth();
  const navigate = useNavigate();
  const [loginVal, setLoginVal] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  const doLogin = async (loginStr, passStr) => {
    setError('');
    try {
      const u = await login(loginStr, passStr);
      const landing = u?.landing || landingFromRole(u?.role);
      navigate(pathFromLanding(landing));
    } catch (err) {
      setError(err.message || 'Неверный логин или пароль');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loginVal || !password) {
      setError('Заполните все поля');
      return;
    }
    doLogin(loginVal, password);
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

        <h2 style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 4, marginTop: 8 }}>
          Войти в аккаунт
        </h2>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>
          Корпоративная платформа «В Плюсе»
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Логин</label>
            <div style={{ position: 'relative' }}>
              <User size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                className="form-input"
                type="text"
                placeholder="Введите логин"
                value={loginVal}
                onChange={(e) => setLoginVal(e.target.value)}
                style={{ paddingLeft: 32 }}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Пароль</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: 40 }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer' }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--danger)', fontSize: 13, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        {USE_MOCK && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 16px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
              <span style={{ fontSize: 12, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>Быстрый вход</span>
              <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mockUsers.map((u) => {
                const c = ROLE_COLORS[u.role] || FALLBACK;
                const icon = ROLE_ICONS[u.role] || '👤';
                return (
                  <button
                    key={u.id}
                    onClick={() => doLogin(u.login, u.password)}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      border: `1px solid ${c.border}`,
                      borderRadius: 'var(--radius)',
                      background: c.bg,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)', marginBottom: 1 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{u.position_name || u.position || ''}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: `${c.color}20`, color: c.color, flexShrink: 0 }}>
                      {u.roleLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--gray-400)', textAlign: 'center' }}>
              Пароль для всех аккаунтов: <b>1234</b>
            </div>
          </>
        )}

        <div className="auth-footer">© 2025 В Плюсе. Внутренняя корпоративная платформа.</div>
      </div>
    </div>
  );
}
