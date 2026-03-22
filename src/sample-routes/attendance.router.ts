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
const baseChain = [authMiddleware, tenantGuard];

// ─── GET /orgs/:orgId/attendance ─────────────────────────────────
// List attendance records
// superadmin/org_admin: all org records
// org_manager: department-scoped
// org_employee: own records only
router.get(
  '/orgs/:orgId/attendance',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER, ROLES.ORG_EMPLOYEE]),
  requirePermission(MODULES.ATTENDANCE, ACTIONS.READ),
  deptScopeGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { date, from, to } = req.query;

      let sql = `
        SELECT a.id, a.user_id, a.date, a.clock_in, a.clock_out, a.status, a.notes,
               u.name AS employee_name, u.email AS employee_email
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        WHERE a.org_id = $1`;
      const params: any[] = [orgId];

      // Filter by specific date
      if (date) {
        sql += ` AND a.date = $${params.length + 1}`;
        params.push(date);
      }

      // Filter by date range
      if (from) {
        sql += ` AND a.date >= $${params.length + 1}`;
        params.push(from);
      }
      if (to) {
        sql += ` AND a.date <= $${params.length + 1}`;
        params.push(to);
      }

      // org_manager: scoped to their departments
      if (req.scopedDepartmentIds && req.scopedDepartmentIds.length > 0) {
        sql += ` AND (u.department_id = ANY($${params.length + 1})
          OR u.id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.department_id = ANY($${params.length + 1})))`;
        params.push(req.scopedDepartmentIds);
      }

      // org_employee: own records only
      if (req.user.role === ROLES.ORG_EMPLOYEE) {
        sql += ` AND a.user_id = $${params.length + 1}`;
        params.push(req.user.id);
      }

      sql += ' ORDER BY a.date DESC, a.clock_in DESC';

      const result = await query(sql, params);

      res.json({
        statusCode: 200,
        data: result.rows,
        meta: {
          count: result.rows.length,
          orgId,
          role: req.user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /orgs/:orgId/attendance/clock-in ───────────────────────
// Clock in for a specific employee (pass employeeId in body)
// If no employeeId, clocks in the logged-in user
router.post(
  '/orgs/:orgId/attendance/clock-in',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER, ROLES.ORG_EMPLOYEE]),
  requirePermission(MODULES.ATTENDANCE, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const employeeId = req.body.employeeId || req.user.id;
      const today = new Date().toISOString().split('T')[0];

      // org_employee can only clock in for themselves
      if (req.user.role === ROLES.ORG_EMPLOYEE && employeeId !== req.user.id) {
        res.status(403).json({
          statusCode: 403,
          error: 'SELF_ONLY',
          message: 'Employees can only clock in for themselves',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Verify employee exists in this org
      const emp = await query(
        'SELECT id, name, email FROM users WHERE id = $1 AND org_id = $2 AND is_active = true',
        [employeeId, orgId],
      );

      if (emp.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Employee not found in this organization',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Check if already clocked in today
      const existing = await query(
        'SELECT id, clock_in, clock_out FROM attendance WHERE user_id = $1 AND date = $2',
        [employeeId, today],
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0].clock_in && !existing.rows[0].clock_out) {
          res.status(400).json({
            statusCode: 400,
            error: 'ALREADY_CLOCKED_IN',
            message: `Employee already clocked in today at ${existing.rows[0].clock_in}. Please clock out first.`,
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
          });
          return;
        }
        if (existing.rows[0].clock_out) {
          res.status(400).json({
            statusCode: 400,
            error: 'ALREADY_COMPLETED',
            message: 'Attendance for today is already completed (clocked in and out)',
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
          });
          return;
        }
      }

      const clockInTime = new Date();
      const result = await query(
        `INSERT INTO attendance (user_id, org_id, date, clock_in, status)
         VALUES ($1, $2, $3, $4, 'present')
         RETURNING id, user_id, date, clock_in, status`,
        [employeeId, orgId, today, clockInTime],
      );

      res.status(201).json({
        statusCode: 201,
        data: {
          ...result.rows[0],
          employee: emp.rows[0],
        },
        message: 'Clock-in recorded successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /orgs/:orgId/attendance/clock-out ──────────────────────
// Clock out for a specific employee (pass employeeId in body)
// If no employeeId, clocks out the logged-in user
router.post(
  '/orgs/:orgId/attendance/clock-out',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER, ROLES.ORG_EMPLOYEE]),
  requirePermission(MODULES.ATTENDANCE, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const employeeId = req.body.employeeId || req.user.id;
      const today = new Date().toISOString().split('T')[0];

      // org_employee can only clock out for themselves
      if (req.user.role === ROLES.ORG_EMPLOYEE && employeeId !== req.user.id) {
        res.status(403).json({
          statusCode: 403,
          error: 'SELF_ONLY',
          message: 'Employees can only clock out for themselves',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Find today's attendance record with clock_in but no clock_out
      const existing = await query(
        `SELECT a.id, a.clock_in, u.name, u.email
         FROM attendance a
         JOIN users u ON u.id = a.user_id
         WHERE a.user_id = $1 AND a.date = $2 AND a.org_id = $3`,
        [employeeId, today, orgId],
      );

      if (existing.rows.length === 0) {
        res.status(400).json({
          statusCode: 400,
          error: 'NOT_CLOCKED_IN',
          message: 'No clock-in found for today. Please clock in first.',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      if (existing.rows[0].clock_out) {
        res.status(400).json({
          statusCode: 400,
          error: 'ALREADY_CLOCKED_OUT',
          message: 'Already clocked out for today',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      const clockOutTime = new Date();
      const clockInTime = new Date(existing.rows[0].clock_in);
      const hoursWorked = ((clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)).toFixed(2);

      const result = await query(
        `UPDATE attendance SET clock_out = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, user_id, date, clock_in, clock_out, status`,
        [clockOutTime, existing.rows[0].id],
      );

      res.status(200).json({
        statusCode: 200,
        data: {
          ...result.rows[0],
          hoursWorked: parseFloat(hoursWorked),
          employee: {
            name: existing.rows[0].name,
            email: existing.rows[0].email,
          },
        },
        message: 'Clock-out recorded successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
