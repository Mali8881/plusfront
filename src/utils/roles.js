const ROLE_ALIASES = {
  SUPER_ADMIN: 'superadmin',
  SUPERADMIN: 'superadmin',
  SUPER_USER: 'superadmin',
  SUPERUSER: 'superadmin',
  ADMINISTRATOR: 'administrator',
  ADMIN: 'admin',
  ADMIN_OPERATOR: 'admin',
  ADMINOPERATOR: 'admin',
  SYSTEMADMIN: 'systemadmin',
  SYSTEM_ADMIN: 'systemadmin',
  SYSTEM_ADMINISTRATOR: 'systemadmin',
  STAFF: 'admin',
  IS_STAFF: 'admin',
  DEPARTMENT_HEAD: 'department_head',
  DEPARTMENTHEAD: 'department_head',
  HEAD_OF_DEPARTMENT: 'department_head',
  MANAGER: 'projectmanager',
  EMPLOYEE: 'employee',
  INTERN: 'intern',
  PROJECT_MANAGER: 'projectmanager',
  PROJECTMANAGER: 'projectmanager',
  TEAMLEAD: 'teamlead',
  TEAM_LEAD: 'teamlead',
};

export const ROLE_LABELS = {
  intern: 'Стажер',
  employee: 'Сотрудник',
  teamlead: 'Тимлид',
  projectmanager: 'Тимлид / Менеджер проекта',
  department_head: 'Руководитель подразделения',
  admin: 'Руководитель подразделения',
  administrator: 'Администратор',
  systemadmin: 'Системный администратор',
  superadmin: 'Суперадмин',
};

export const TEAM_MANAGER_ROLES = ['teamlead', 'projectmanager'];
export const DEPARTMENT_HEAD_ROLES = ['department_head', 'admin'];
export const ADMINISTRATOR_ROLES = ['administrator', 'systemadmin'];
export const ADMIN_LIKE_ROLES = [...DEPARTMENT_HEAD_ROLES, ...ADMINISTRATOR_ROLES, 'superadmin'];

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
  return ADMIN_LIKE_ROLES.includes(normalized);
}

export function isTeamManagerRole(role) {
  return TEAM_MANAGER_ROLES.includes(normalizeRole(role));
}

export function isDepartmentHeadRole(role) {
  return DEPARTMENT_HEAD_ROLES.includes(normalizeRole(role));
}

export function isAdministratorRole(role) {
  return ADMINISTRATOR_ROLES.includes(normalizeRole(role));
}

export function hasAnyRole(role, allowedRoles = []) {
  const normalized = normalizeRole(role);
  return allowedRoles.includes(normalized);
}

export function isSuperAdminRole(role) {
  return normalizeRole(role) === 'superadmin';
}

export function isInternRole(role) {
  return normalizeRole(role) === 'intern';
}

export function landingFromRole(role) {
  const normalized = normalizeRole(role);
  if (isAdminRole(normalized) && !isTeamManagerRole(normalized)) return 'admin_panel';
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
