import { Request, Response, NextFunction } from 'express';
import { ROLES } from '../rbac/roles.constants';
import { query } from '../../db/db.client';

/**
 * Department Scope Guard
 *
 * For org_manager: looks up assigned departments from the user_departments
 * junction table and injects them into the request for downstream filtering.
 *
 * - req.scopedDepartmentIds — array of department IDs the manager can access
 * - req.scopedDepartmentId  — kept for backward compatibility (first dept)
 *
 * Other roles pass through unmodified.
 */
export async function deptScopeGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (req.user.role === ROLES.ORG_MANAGER) {
      // Fetch all departments assigned to this manager
      const result = await query(
        'SELECT department_id FROM user_departments WHERE user_id = $1',
        [req.user.id],
      );

      const deptIds = result.rows.map((r: any) => r.department_id);

      if (deptIds.length > 0) {
        req.scopedDepartmentIds = deptIds;
        req.scopedDepartmentId = deptIds[0]; // backward compatibility
      } else if (req.user.departmentId) {
        // Fallback to JWT departmentId if junction table is empty
        req.scopedDepartmentIds = [req.user.departmentId];
        req.scopedDepartmentId = req.user.departmentId;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
