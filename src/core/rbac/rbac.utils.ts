import { Role, PLATFORM_ROLES, ORG_ROLES } from './roles.constants';
import { DEFAULT_PERMISSIONS } from './permissions';

export function hasRole(userRole: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(userRole);
}

export function hasPermission(
  userRole: Role,
  module: string,
  action: string,
  tokenPermissions?: Record<string, string[]>,
): boolean {
  const perms = tokenPermissions ?? DEFAULT_PERMISSIONS[userRole];
  return perms?.[module]?.includes(action) ?? false;
}

export function isOrgLevel(role: Role): boolean {
  return ORG_ROLES.includes(role);
}

export function isPlatformLevel(role: Role): boolean {
  return PLATFORM_ROLES.includes(role);
}
