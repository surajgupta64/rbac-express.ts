import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../core/middleware/auth.middleware';
import { tenantGuard } from '../core/middleware/tenant.guard';
import { requireRole } from '../core/middleware/role.guard';
import { validateUuidParams } from '../core/middleware/validate-uuid';
import { ROLES } from '../core/rbac/roles.constants';
import { query } from '../db/db.client';

const router = Router();
const baseChain = [authMiddleware, tenantGuard];

/**
 * Department Management Routes
 *
 * - superadmin: full access across all orgs
 * - org_admin: full CRUD within own org
 * - org_manager / org_employee: no access
 *
 * Delete rules:
 *   - If employees are mapped to the department → 400 error
 *   - Must reassign employees first, then delete
 */

// ─── GET /orgs/:orgId/departments ────────────────────────────────
// List all departments in the organization
router.get(
  '/orgs/:orgId/departments',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      const result = await query(
        `SELECT d.id, d.name, d.org_id, d.created_at,
                COUNT(u.id)::int AS employee_count
         FROM departments d
         LEFT JOIN users u ON u.department_id = d.id AND u.is_active = true
         WHERE d.org_id = $1
         GROUP BY d.id
         ORDER BY d.name`,
        [orgId],
      );

      res.status(200).json({
        statusCode: 200,
        data: result.rows,
        meta: {
          count: result.rows.length,
          orgId,
          requestedBy: req.user.email,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /orgs/:orgId/departments/:deptId ────────────────────────
// Get a single department with its employees
router.get(
  '/orgs/:orgId/departments/:deptId',
  validateUuidParams('orgId', 'deptId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      const dept = await query(
        'SELECT id, name, org_id, created_at FROM departments WHERE id = $1 AND org_id = $2',
        [req.params.deptId, orgId],
      );

      if (dept.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Department not found in this organization',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      const employees = await query(
        'SELECT id, name, email, role FROM users WHERE department_id = $1 AND org_id = $2 AND is_active = true',
        [req.params.deptId, orgId],
      );

      res.status(200).json({
        statusCode: 200,
        data: {
          ...dept.rows[0],
          employees: employees.rows,
          employee_count: employees.rows.length,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /orgs/:orgId/departments ───────────────────────────────
// Create a new department
router.post(
  '/orgs/:orgId/departments',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { name } = req.body;

      if (!name) {
        res.status(400).json({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Department name is required',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Check duplicate name within same org
      const existing = await query(
        'SELECT id FROM departments WHERE name = $1 AND org_id = $2',
        [name, orgId],
      );

      if (existing.rows.length > 0) {
        res.status(409).json({
          statusCode: 409,
          error: 'DUPLICATE_DEPARTMENT',
          message: `Department '${name}' already exists in this organization`,
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      const result = await query(
        'INSERT INTO departments (name, org_id) VALUES ($1, $2) RETURNING id, name, org_id, created_at',
        [name, orgId],
      );

      res.status(201).json({
        statusCode: 201,
        data: result.rows[0],
        message: 'Department created successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /orgs/:orgId/departments/:deptId ────────────────────────
// Update department name
router.put(
  '/orgs/:orgId/departments/:deptId',
  validateUuidParams('orgId', 'deptId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { name } = req.body;

      if (!name) {
        res.status(400).json({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Department name is required',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Check duplicate name (exclude self)
      const duplicate = await query(
        'SELECT id FROM departments WHERE name = $1 AND org_id = $2 AND id != $3',
        [name, orgId, req.params.deptId],
      );

      if (duplicate.rows.length > 0) {
        res.status(409).json({
          statusCode: 409,
          error: 'DUPLICATE_DEPARTMENT',
          message: `Department '${name}' already exists in this organization`,
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      const result = await query(
        'UPDATE departments SET name = $1 WHERE id = $2 AND org_id = $3 RETURNING id, name, org_id, created_at',
        [name, req.params.deptId, orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Department not found in this organization',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      res.status(200).json({
        statusCode: 200,
        data: result.rows[0],
        message: 'Department updated successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /orgs/:orgId/departments/:deptId ─────────────────────
// Delete a department — ONLY if no employees are mapped to it
router.delete(
  '/orgs/:orgId/departments/:deptId',
  validateUuidParams('orgId', 'deptId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      // Check department exists
      const dept = await query(
        'SELECT id, name FROM departments WHERE id = $1 AND org_id = $2',
        [req.params.deptId, orgId],
      );

      if (dept.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Department not found in this organization',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Check if any active employees are mapped (via users.department_id OR user_departments junction)
      const mappedEmployees = await query(
        `SELECT DISTINCT u.id, u.name, u.email, u.role FROM users u
         LEFT JOIN user_departments ud ON ud.user_id = u.id
         WHERE (u.department_id = $1 OR ud.department_id = $1)
         AND u.org_id = $2 AND u.is_active = true`,
        [req.params.deptId, orgId],
      );

      if (mappedEmployees.rows.length > 0) {
        res.status(400).json({
          statusCode: 400,
          error: 'DEPARTMENT_HAS_EMPLOYEES',
          message: `Cannot delete department '${dept.rows[0].name}'. ${mappedEmployees.rows.length} employee(s) are still assigned to this department. Please reassign them to another department first.`,
          data: {
            department: dept.rows[0].name,
            employeeCount: mappedEmployees.rows.length,
            employees: mappedEmployees.rows.map((e: any) => ({
              id: e.id,
              name: e.name,
              email: e.email,
              role: e.role,
            })),
          },
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Safe to delete — no employees mapped
      await query('DELETE FROM user_departments WHERE department_id = $1', [req.params.deptId]);
      await query('DELETE FROM departments WHERE id = $1', [req.params.deptId]);

      res.status(200).json({
        statusCode: 200,
        message: `Department '${dept.rows[0].name}' deleted successfully`,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /orgs/:orgId/employees/:empId/department ──────────────
// Reassign an employee to a different department
router.patch(
  '/orgs/:orgId/employees/:empId/department',
  validateUuidParams('orgId', 'empId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { departmentId } = req.body;

      if (!departmentId) {
        res.status(400).json({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'departmentId is required',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Verify department exists in same org
      const dept = await query(
        'SELECT id, name FROM departments WHERE id = $1 AND org_id = $2',
        [departmentId, orgId],
      );

      if (dept.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Target department not found in this organization',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Update employee's department
      const result = await query(
        `UPDATE users SET department_id = $1, updated_at = NOW()
         WHERE id = $2 AND org_id = $3 AND is_active = true
         RETURNING id, name, email, role, department_id`,
        [departmentId, req.params.empId, orgId],
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
        message: `Employee reassigned to '${dept.rows[0].name}' department successfully`,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
