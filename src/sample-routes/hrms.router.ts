import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../core/middleware/auth.middleware';
import { tenantGuard } from '../core/middleware/tenant.guard';
import { requireRole } from '../core/middleware/role.guard';
import { requirePermission } from '../core/middleware/permission.guard';
import { deptScopeGuard } from '../core/middleware/dept-scope.guard';
import { validateUuidParams } from '../core/middleware/validate-uuid';
import { ROLES } from '../core/rbac/roles.constants';
import { MODULES, ACTIONS } from '../core/constants/modules.constants';
import { query } from '../db/db.client';

const router = Router();

// Shared middleware chain for all HRMS routes
const baseChain = [authMiddleware, tenantGuard];

// ─── GET /orgs/employees ─────────────────────────────────────────
// Superadmin only — list ALL employees across ALL orgs (no orgId needed)
router.get(
  '/orgs/employees',
  authMiddleware,
  requireRole([ROLES.SUPERADMIN]),
  requirePermission(MODULES.HRMS, ACTIONS.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `SELECT u.id, u.name, u.email, u.role, u.created_at,
                o.id AS org_id, o.name AS org_name
         FROM users u
         LEFT JOIN orgs o ON o.id = u.org_id
         WHERE u.is_active = true
         ORDER BY o.name, u.name`,
      );

      const userIds = result.rows.map((r: any) => r.id);
      let deptMap: Record<string, { id: string; name: string }[]> = {};

      if (userIds.length > 0) {
        const depts = await query(
          `SELECT ud.user_id, d.id, d.name
           FROM user_departments ud
           JOIN departments d ON d.id = ud.department_id
           WHERE ud.user_id = ANY($1)
           ORDER BY d.name`,
          [userIds],
        );
        for (const row of depts.rows) {
          if (!deptMap[row.user_id]) deptMap[row.user_id] = [];
          deptMap[row.user_id].push({ id: row.id, name: row.name });
        }
      }

      const employees = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        organization: row.org_id ? { id: row.org_id, name: row.org_name } : null,
        departments: deptMap[row.id] || [],
        createdAt: row.created_at,
      }));

      res.json({
        statusCode: 200,
        data: employees,
        meta: {
          count: employees.length,
          requestedBy: req.user.email,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /orgs/:orgId/employees ──────────────────────────────────
// org_admin sees all org employees, org_manager sees dept only,
// org_employee sees only self, superadmin sees all
router.get(
  '/orgs/:orgId/employees',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER, ROLES.ORG_EMPLOYEE]),
  requirePermission(MODULES.HRMS, ACTIONS.READ),
  deptScopeGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
    const orgId = req.resolvedOrgId || req.params.orgId;

    let sql = `SELECT u.id, u.name, u.email, u.role, u.created_at
      FROM users u
      WHERE u.org_id = $1 AND u.is_active = true`;
    const params: any[] = [orgId];

    // org_manager: scoped to assigned departments (multiple)
    if (req.scopedDepartmentIds && req.scopedDepartmentIds.length > 0) {
      sql += ` AND (u.department_id = ANY($${params.length + 1})
        OR u.id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.department_id = ANY($${params.length + 1})))`;
      params.push(req.scopedDepartmentIds);
    }

    // org_employee: self only
    if (req.user.role === ROLES.ORG_EMPLOYEE) {
      sql += ` AND u.id = $${params.length + 1}`;
      params.push(req.user.id);
    }

    const result = await query(sql, params);

    // Fetch departments for each user from user_departments junction table
    const userIds = result.rows.map((r: any) => r.id);
    let deptMap: Record<string, { id: string; name: string }[]> = {};

    if (userIds.length > 0) {
      const depts = await query(
        `SELECT ud.user_id, d.id, d.name
         FROM user_departments ud
         JOIN departments d ON d.id = ud.department_id
         WHERE ud.user_id = ANY($1)
         ORDER BY d.name`,
        [userIds],
      );

      for (const row of depts.rows) {
        if (!deptMap[row.user_id]) deptMap[row.user_id] = [];
        deptMap[row.user_id].push({ id: row.id, name: row.name });
      }
    }

    const employees = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      departments: deptMap[row.id] || [],
      createdAt: row.created_at,
    }));

    res.json({
      statusCode: 200,
      data: employees,
      meta: {
        count: employees.length,
        orgId,
        requestedBy: req.user.email,
        role: req.user.role,
        scopedDepartmentIds: req.scopedDepartmentIds || null,
      },
    });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /orgs/:orgId/employees ─────────────────────────────────
// Only org_admin and superadmin can create employees
// org_manager: accepts departmentIds[] (multiple departments)
// org_employee: accepts departmentId (single department)
router.post(
  '/orgs/:orgId/employees',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.HRMS, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { name, email, role, departmentId, departmentIds } = req.body;

      if (!name || !email || !role) {
        res.status(400).json({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'name, email, and role are required',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      const allowedRoles = ['org_admin', 'org_manager', 'org_employee'];
      if (!allowedRoles.includes(role)) {
        res.status(400).json({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: `Invalid role '${role}'. Allowed: ${allowedRoles.join(', ')}`,
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // For org_manager: require departmentIds (array of multiple departments)
      // For org_employee: require departmentId (single department)
      let deptIdsToAssign: string[] = [];

      if (role === 'org_manager') {
        if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
          res.status(400).json({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'departmentIds (array) is required for org_manager. A manager must be assigned to at least one department.',
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
          });
          return;
        }
        deptIdsToAssign = departmentIds;
      } else if (role === 'org_employee') {
        if (!departmentId) {
          res.status(400).json({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'departmentId is required for org_employee',
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
          });
          return;
        }
        deptIdsToAssign = [departmentId];
      }

      // Validate all department IDs belong to this org
      if (deptIdsToAssign.length > 0) {
        const validDepts = await query(
          'SELECT id, name FROM departments WHERE id = ANY($1) AND org_id = $2',
          [deptIdsToAssign, orgId],
        );

        if (validDepts.rows.length !== deptIdsToAssign.length) {
          const validIds = validDepts.rows.map((d: any) => d.id);
          const invalidIds = deptIdsToAssign.filter((id) => !validIds.includes(id));
          res.status(400).json({
            statusCode: 400,
            error: 'INVALID_DEPARTMENT',
            message: `Department(s) not found in this organization: ${invalidIds.join(', ')}`,
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
          });
          return;
        }
      }

      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash('TempPassword1', 12);

      // Keep department_id on user for backward compatibility (first dept for employees, null for managers)
      const primaryDeptId = role === 'org_employee' ? deptIdsToAssign[0] : null;

      const result = await query(
        `INSERT INTO users (name, email, password_hash, role, org_id, department_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, email, role, org_id, department_id, created_at`,
        [name, email, passwordHash, role, orgId, primaryDeptId],
      );

      const userId = result.rows[0].id;

      // Insert into user_departments junction table
      for (const deptId of deptIdsToAssign) {
        await query(
          'INSERT INTO user_departments (user_id, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, deptId],
        );
      }

      // Fetch assigned departments for response
      const assignedDepts = await query(
        'SELECT d.id, d.name FROM user_departments ud JOIN departments d ON d.id = ud.department_id WHERE ud.user_id = $1',
        [userId],
      );

      res.status(201).json({
        statusCode: 201,
        data: {
          ...result.rows[0],
          departments: assignedDepts.rows,
        },
        message: 'Employee created successfully',
      });
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(409).json({
          statusCode: 409,
          error: 'DUPLICATE_EMAIL',
          message: 'A user with this email already exists',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }
      next(err);
    }
  },
);

// ─── DELETE /orgs/:orgId/employees/:id ───────────────────────────
// Only org_admin and superadmin can delete (soft-delete)
router.delete(
  '/orgs/:orgId/employees/:id',
  validateUuidParams('orgId', 'id'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.HRMS, ACTIONS.DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      const result = await query(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 AND org_id = $2 RETURNING id',
        [req.params.id, orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Employee not found in this organization',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      res.status(200).json({
        statusCode: 200,
        message: 'Employee deactivated successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /orgs/:orgId/employees/:id ──────────────────────────────
// Update employee details (name, email, role, departments)
router.put(
  '/orgs/:orgId/employees/:id',
  validateUuidParams('orgId', 'id'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.HRMS, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const empId = req.params.id;
      const { name, email, role, departmentId, departmentIds } = req.body;

      // Check employee exists in this org
      const existing = await query(
        'SELECT id, role FROM users WHERE id = $1 AND org_id = $2 AND is_active = true',
        [empId, orgId],
      );

      if (existing.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Employee not found in this organization',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Build dynamic update
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name) { fields.push(`name = $${paramIndex++}`); values.push(name); }
      if (email) { fields.push(`email = $${paramIndex++}`); values.push(email); }
      if (role) {
        const allowedRoles = ['org_admin', 'org_manager', 'org_employee'];
        if (!allowedRoles.includes(role)) {
          res.status(400).json({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: `Invalid role '${role}'. Allowed: ${allowedRoles.join(', ')}`,
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
          });
          return;
        }
        fields.push(`role = $${paramIndex++}`);
        values.push(role);
      }

      // For org_employee: single departmentId on users table
      const finalRole = role || existing.rows[0].role;
      if (finalRole === 'org_employee' && departmentId) {
        fields.push(`department_id = $${paramIndex++}`);
        values.push(departmentId);
      }

      if (fields.length === 0 && !departmentIds) {
        res.status(400).json({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'At least one field to update is required (name, email, role, departmentId, departmentIds)',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      fields.push(`updated_at = NOW()`);
      values.push(empId);
      values.push(orgId);

      const result = await query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
         RETURNING id, name, email, role, department_id, created_at, updated_at`,
        values,
      );

      // Update departments in junction table if departmentIds provided (for org_manager)
      if (departmentIds && Array.isArray(departmentIds)) {
        // Validate departments belong to this org
        if (departmentIds.length > 0) {
          const validDepts = await query(
            'SELECT id FROM departments WHERE id = ANY($1) AND org_id = $2',
            [departmentIds, orgId],
          );
          if (validDepts.rows.length !== departmentIds.length) {
            const validIds = validDepts.rows.map((d: any) => d.id);
            const invalidIds = departmentIds.filter((id: string) => !validIds.includes(id));
            res.status(400).json({
              statusCode: 400,
              error: 'INVALID_DEPARTMENT',
              message: `Department(s) not found in this organization: ${invalidIds.join(', ')}`,
              timestamp: new Date().toISOString(),
              path: req.originalUrl,
            });
            return;
          }
        }

        // Clear old and insert new
        await query('DELETE FROM user_departments WHERE user_id = $1', [empId]);
        for (const deptId of departmentIds) {
          await query(
            'INSERT INTO user_departments (user_id, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [empId, deptId],
          );
        }
      } else if (departmentId && finalRole === 'org_employee') {
        // Single department for employee
        await query('DELETE FROM user_departments WHERE user_id = $1', [empId]);
        await query(
          'INSERT INTO user_departments (user_id, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [empId, departmentId],
        );
      }

      // Fetch updated departments
      const assignedDepts = await query(
        'SELECT d.id, d.name FROM user_departments ud JOIN departments d ON d.id = ud.department_id WHERE ud.user_id = $1',
        [empId],
      );

      res.status(200).json({
        statusCode: 200,
        data: {
          ...result.rows[0],
          departments: assignedDepts.rows,
        },
        message: 'Employee updated successfully',
      });
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(409).json({
          statusCode: 409,
          error: 'DUPLICATE_EMAIL',
          message: 'A user with this email already exists',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }
      next(err);
    }
  },
);

// ─── PATCH /orgs/:orgId/employees/:id/activate ──────────────────
// Activate an employee
router.patch(
  '/orgs/:orgId/employees/:id/activate',
  validateUuidParams('orgId', 'id'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.HRMS, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      const result = await query(
        `UPDATE users SET is_active = true, updated_at = NOW()
         WHERE id = $1 AND org_id = $2
         RETURNING id, name, email, role, is_active`,
        [req.params.id, orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Employee not found in this organization',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      res.status(200).json({
        statusCode: 200,
        data: result.rows[0],
        message: 'Employee activated successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /orgs/:orgId/employees/:id/deactivate ────────────────
// Deactivate an employee
router.patch(
  '/orgs/:orgId/employees/:id/deactivate',
  validateUuidParams('orgId', 'id'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.HRMS, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      const result = await query(
        `UPDATE users SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND org_id = $2
         RETURNING id, name, email, role, is_active`,
        [req.params.id, orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Employee not found in this organization',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      res.status(200).json({
        statusCode: 200,
        data: result.rows[0],
        message: 'Employee deactivated successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /orgs/:orgId/payroll ────────────────────────────────────
// Only org_admin and superadmin (manage permission)
router.get(
  '/orgs/:orgId/payroll',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.HRMS, ACTIONS.MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      res.json({
        statusCode: 200,
        data: [],
        message: 'Payroll data — placeholder for payroll service integration',
        meta: { orgId, requestedBy: req.user.email },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
