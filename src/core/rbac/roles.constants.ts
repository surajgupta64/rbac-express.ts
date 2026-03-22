export const ROLES = {
  SUPERADMIN: 'superadmin',
  SUPERADMIN_TEAM: 'superadmin_team',
  ORG_ADMIN: 'org_admin',
  ORG_MANAGER: 'org_manager',
  ORG_EMPLOYEE: 'org_employee',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PLATFORM_ROLES: Role[] = [ROLES.SUPERADMIN, ROLES.SUPERADMIN_TEAM];

export const ORG_ROLES: Role[] = [
  ROLES.ORG_ADMIN,
  ROLES.ORG_MANAGER,
  ROLES.ORG_EMPLOYEE,
];

export const ROLE_HIERARCHY: Record<Role, number> = {
  superadmin: 100,
  superadmin_team: 50,
  org_admin: 40,
  org_manager: 30,
  org_employee: 10,
};
