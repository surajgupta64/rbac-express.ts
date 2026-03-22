import { Role } from '../core/rbac/roles.constants';

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: Role;
        level: 'platform' | 'org';
        orgId: string | null;
        departmentId: string | null;
        permissions: Record<string, string[]>;
        canImpersonate: boolean;
      };
      resolvedOrgId?: string;
      scopedDepartmentId?: string;
      scopedDepartmentIds?: string[];
    }
  }
}

export {};
