export const MODULES = {
  HRMS: 'hrms',
  ATTENDANCE: 'attendance',
  TRACKING: 'tracking',
  CRM: 'crm',
  SALES: 'sales',
  PLATFORM: 'platform',
} as const;

export const ACTIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  MANAGE: 'manage',
} as const;

export type Module = (typeof MODULES)[keyof typeof MODULES];
export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];
