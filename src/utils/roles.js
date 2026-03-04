const ROLE_ALIASES = {
  SUPER_ADMIN: 'superadmin',
  SUPERADMIN: 'superadmin',
  SUPER_USER: 'superadmin',
  SUPERUSER: 'superadmin',
  ADMINISTRATOR: 'administrator',
  ADMIN: 'admin',
  SYSTEMADMIN: 'systemadmin',
  SYSTEM_ADMIN: 'systemadmin',
  SYSTEM_ADMINISTRATOR: 'systemadmin',
  STAFF: 'admin',
  IS_STAFF: 'admin',
  DEPARTMENT_HEAD: 'admin',
  DEPARTMENTHEAD: 'admin',
  HEAD_OF_DEPARTMENT: 'admin',
  MANAGER: 'projectmanager',
  EMPLOYEE: 'employee',
  INTERN: 'intern',
  PROJECT_MANAGER: 'projectmanager',
  PROJECTMANAGER: 'projectmanager',
};

export function normalizeRole(role) {
  if (!role) return 'employee';
  const raw = String(role).trim();
  const upperRaw = raw.toUpperCase();
  const aliasByRaw = ROLE_ALIASES[upperRaw];
  if (aliasByRaw) return aliasByRaw;

  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const aliasByNormalized = ROLE_ALIASES[normalized.toUpperCase()];
  if (aliasByNormalized) return aliasByNormalized;

  return normalized;
}

export function isAdminRole(role) {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'administrator' || normalized === 'superadmin' || normalized === 'systemadmin';
}

export function isSuperAdminRole(role) {
  return normalizeRole(role) === 'superadmin';
}

export function isInternRole(role) {
  return normalizeRole(role) === 'intern';
}

export function landingFromRole(role) {
  const normalized = normalizeRole(role);
  if (normalized === 'superadmin' || normalized === 'admin' || normalized === 'administrator' || normalized === 'systemadmin') return 'admin_panel';
  if (normalized === 'intern') return 'intern_portal';
  return 'employee_portal';
}

export function normalizeLandingForRole(landing, role) {
  const expected = landingFromRole(role);
  return landing === expected ? landing : expected;
}

export function pathFromLanding(landing) {
  if (landing === 'admin_panel') return '/admin/overview';
  if (landing === 'intern_portal') return '/onboarding';
  return '/dashboard';
}

export function pathFromRole(role) {
  return pathFromLanding(landingFromRole(role));
}
