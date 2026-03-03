import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authAPI } from '../api/auth';
import {
  normalizeRole,
  isAdminRole,
  isSuperAdminRole,
  isInternRole,
  normalizeLandingForRole,
  pathFromLanding,
} from '../utils/roles';

const AuthContext = createContext(null);

const USE_MOCK = false;
const STORAGE_KEYS = {
  access: 'access_token',
  refresh: 'refresh_token',
  role: 'onboarding_role',
  landing: 'onboarding_landing',
  legacyAccess: 'onboarding_access_token',
};

const ROLE_LABELS = {
  intern: 'Стажер',
  employee: 'Сотрудник',
  projectmanager: 'Проект-менеджер',
  admin: 'Администратор',
  administrator: 'Администратор',
  systemadmin: 'Системный администратор',
  superadmin: 'Суперадминистратор',
};

let bootstrapPromise = null;

function clearSessionStorage() {
  localStorage.removeItem(STORAGE_KEYS.access);
  localStorage.removeItem(STORAGE_KEYS.refresh);
  localStorage.removeItem(STORAGE_KEYS.role);
  localStorage.removeItem(STORAGE_KEYS.landing);
  localStorage.removeItem(STORAGE_KEYS.legacyAccess);
}

function syncRoleAndLanding(role) {
  const normalizedRole = normalizeRole(role);
  const previousLanding = localStorage.getItem(STORAGE_KEYS.landing);
  const nextLanding = normalizeLandingForRole(previousLanding, normalizedRole);
  localStorage.setItem(STORAGE_KEYS.role, normalizedRole);
  localStorage.setItem(STORAGE_KEYS.landing, nextLanding);
  return { normalizedRole, landing: nextLanding };
}

function normalizeUser(raw = {}) {
  const roleLabelText = String(raw.role_label || raw.user?.role_label || raw.role_name || raw.user?.role_name || '').toLowerCase();
  const resolveRoleFromLabel = () => {
    if (!roleLabelText) return null;
    if (roleLabelText.includes('super') || roleLabelText.includes('супер')) return 'SUPER_ADMIN';
    if (roleLabelText.includes('system') || roleLabelText.includes('систем')) return 'SYSTEMADMIN';
    if (roleLabelText.includes('admin') || roleLabelText.includes('админ')) return 'ADMINISTRATOR';
    if (roleLabelText.includes('intern') || roleLabelText.includes('стаж')) return 'INTERN';
    if (roleLabelText.includes('project') || roleLabelText.includes('руковод')) return 'PROJECTMANAGER';
    if (roleLabelText.includes('employee') || roleLabelText.includes('сотруд')) return 'EMPLOYEE';
    return null;
  };

  const hasSuperuserFlag =
    Boolean(raw.is_superuser) ||
    Boolean(raw.user?.is_superuser) ||
    Boolean(raw.is_super_admin) ||
    Boolean(raw.user?.is_super_admin);
  const hasAdminFlag =
    Boolean(raw.is_staff) ||
    Boolean(raw.user?.is_staff) ||
    Boolean(raw.is_admin) ||
    Boolean(raw.user?.is_admin) ||
    Boolean(raw.is_system_admin) ||
    Boolean(raw.user?.is_system_admin);

  const roleCandidates = [
    raw.role,
    raw.role?.code,
    raw.role?.name,
    raw.user_role,
    raw.role_code,
    raw.role_name,
    raw.user?.role,
    raw.user?.role?.code,
    raw.user?.role?.name,
    raw.user?.user_role,
    raw.user?.role_code,
    raw.account?.role,
    raw.account?.role?.code,
    raw.account?.role_code,
  ];
  let roleSource = roleCandidates.find(Boolean);
  if (!roleSource) roleSource = resolveRoleFromLabel();
  if (hasSuperuserFlag) roleSource = 'SUPER_ADMIN';
  else if (!roleSource && hasAdminFlag) roleSource = 'ADMIN';
  const role = normalizeRole(roleSource);
  const fullName =
    raw.full_name ||
    [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() ||
    raw.name ||
    raw.username ||
    raw.email ||
    '';

  return {
    id: raw.id,
    username: raw.username || raw.email || String(raw.id || ''),
    login: raw.username || raw.email || String(raw.id || ''),
    name: fullName,
    email: raw.email || '',
    role,
    roleLabel: raw.role_label || raw.user?.role_label || ROLE_LABELS[role] || role,
    department: raw.department || '',
    department_name: raw.department_name || '',
    subdivision: raw.subdivision || '',
    subdivision_name: raw.subdivision_name || '',
    position: raw.position || '',
    position_name: raw.position_name || '',
    phone: raw.phone || '',
    telegram: raw.telegram || '',
    hireDate: raw.hire_date || '',
    photo: raw.photo || raw.avatar || raw.profile_photo || raw.user?.photo || raw.user?.avatar || '',
  };
}

function decodeJwtPayload(token) {
  try {
    const [, payload = ''] = String(token).split('.');
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenExpired(token, skewSeconds = 30) {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  if (!exp) return true;
  return Date.now() >= (exp - skewSeconds) * 1000;
}

async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw new Error('Missing refresh token');
  const res = await authAPI.refresh(refreshToken);
  const { access, access_token } = res.data || {};
  const nextAccess = access || access_token;
  if (!nextAccess) throw new Error('No access token in refresh response');
  localStorage.setItem(STORAGE_KEYS.access, nextAccess);
  localStorage.setItem(STORAGE_KEYS.legacyAccess, nextAccess);
  return nextAccess;
}

async function bootstrapAuthState() {
  const accessToken = localStorage.getItem(STORAGE_KEYS.access);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refresh);

  if (!accessToken && !refreshToken) {
    return { user: null, landing: 'employee_portal' };
  }

  if (!accessToken && refreshToken) {
    await refreshAccessToken(refreshToken);
  } else if (accessToken && isTokenExpired(accessToken)) {
    if (!refreshToken) throw new Error('Access token expired and no refresh token');
    await refreshAccessToken(refreshToken);
  }

  const profileResponse = await authAPI.getMe();
  const normalized = normalizeUser(profileResponse.data || {});
  const synced = syncRoleAndLanding(normalized.role);
  return {
    user: { ...normalized, role: synced.normalizedRole, landing: synced.landing },
    landing: synced.landing,
  };
}

async function getBootstrapAuthState() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapAuthState().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [landing, setLanding] = useState(() => localStorage.getItem(STORAGE_KEYS.landing) || 'employee_portal');
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    getBootstrapAuthState()
      .then((state) => {
        if (!mountedRef.current) return;
        setUser(state.user);
        setLanding(state.landing);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        clearSessionStorage();
        setUser(null);
        setLanding('employee_portal');
      })
      .finally(() => {
        if (mountedRef.current) setBootstrapped(true);
      });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const login = async (loginVal, password) => {
    setLoading(true);
    try {
      // Drop stale tokens before starting a fresh login.
      clearSessionStorage();
      const res = await authAPI.login(loginVal, password);
      const { access, refresh, access_token, refresh_token } = res.data || {};
      const finalAccess = access || access_token;
      const finalRefresh = refresh || refresh_token;

      if (finalAccess) {
        localStorage.setItem(STORAGE_KEYS.access, finalAccess);
        localStorage.setItem(STORAGE_KEYS.legacyAccess, finalAccess);
      }
      if (finalRefresh) localStorage.setItem(STORAGE_KEYS.refresh, finalRefresh);

      const profileResponse = await authAPI.getMe();
      const normalized = normalizeUser(profileResponse.data || {});
      const synced = syncRoleAndLanding(normalized.role);
      const nextUser = { ...normalized, role: synced.normalizedRole, landing: synced.landing };

      setLanding(synced.landing);
      setUser(nextUser);
      return nextUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const refresh = localStorage.getItem(STORAGE_KEYS.refresh);
    if (refresh) await authAPI.logout(refresh).catch(() => {});
    clearSessionStorage();
    setUser(null);
    setLanding('employee_portal');
  };

  const updateUser = async (patch) => {
    const res = await authAPI.updateMe(patch);
    const normalized = normalizeUser(res.data || {});
    const synced = syncRoleAndLanding(normalized.role);
    const nextUser = { ...normalized, role: synced.normalizedRole, landing: synced.landing };
    setLanding(synced.landing);
    setUser(nextUser);
    return nextUser;
  };

  const isAdmin = isAdminRole(user?.role);
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const isIntern = isInternRole(user?.role);

  if (!bootstrapped) return null;

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateUser,
        loading,
        isAdmin,
        isSuperAdmin,
        isIntern,
        landing,
        getDefaultPath: () => pathFromLanding(landing),
        USE_MOCK,
        mockUsers: [],
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

