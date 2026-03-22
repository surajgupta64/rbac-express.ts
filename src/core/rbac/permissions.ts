import { Role } from './roles.constants';

/**
 * Default Permission Map
 *
 * Defines which actions each role can perform on each module.
 * This is baked into the JWT at login time so microservices
 * don't need a DB call per request.
 *
 * For org-specific overrides, the role_permissions table in
 * the database takes precedence over these defaults.
 */
export const DEFAULT_PERMISSIONS: Record<Role, Record<string, string[]>> = {
  superadmin: {
    platform: ['read', 'write', 'delete', 'manage'],
    hrms: ['read', 'write', 'delete', 'manage'],
    attendance: ['read', 'write', 'delete', 'manage'],
    tracking: ['read', 'write', 'delete', 'manage'],
    crm: ['read', 'write', 'delete', 'manage'],
    sales: ['read', 'write', 'delete', 'manage'],
  },

  superadmin_team: {
    platform: ['read'],
    hrms: ['read'],
    attendance: ['read'],
    tracking: [],
    crm: [],
    sales: [],
  },

  org_admin: {
    hrms: ['read', 'write', 'delete'],   // full employee management within own org
    attendance: ['read', 'write'],        // manage attendance, no delete
    tracking: ['read'],                   // view only
    crm: ['read', 'write'],              // manage leads, no delete
    sales: ['read', 'write'],            // manage orders, no delete
  },

  org_manager: {
    hrms: ['read', 'write'],
    attendance: ['read', 'write'],
    tracking: ['read'],
    crm: ['read'],
    sales: ['read'],
  },

  org_employee: {
    hrms: ['read'],
    attendance: ['read', 'write'],
    tracking: [],
    crm: [],
    sales: [],
  },
};
