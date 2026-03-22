import { Role } from '../core/rbac/roles.constants';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  org_id: string | null;
  department_id: string | null;
  is_active: boolean;
  is_locked: boolean;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}
