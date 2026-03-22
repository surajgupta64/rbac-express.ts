import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../core/middleware/auth.middleware';
import { tenantGuard } from '../core/middleware/tenant.guard';
import { requireRole } from '../core/middleware/role.guard';
import { requirePermission } from '../core/middleware/permission.guard';
import { ROLES } from '../core/rbac/roles.constants';
import { MODULES, ACTIONS } from '../core/constants/modules.constants';
import { query } from '../db/db.client';

const router = Router();
const baseChain = [authMiddleware, tenantGuard];

// ─── GET /orgs/:orgId/sales/orders ───────────────────────────────
router.get(
  '/orgs/:orgId/sales/orders',
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER]),
  requirePermission(MODULES.SALES, ACTIONS.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { status } = req.query;

      let sql = `
        SELECT o.id, o.customer_name, o.amount, o.currency, o.status, o.notes,
               o.created_at, o.updated_at,
               u.name AS created_by_name
        FROM sales_orders o
        LEFT JOIN users u ON u.id = o.created_by
        WHERE o.org_id = $1`;
      const params: any[] = [orgId];

      if (status) {
        sql += ` AND o.status = $${params.length + 1}`;
        params.push(status);
      }

      sql += ' ORDER BY o.created_at DESC';

      const result = await query(sql, params);

      res.json({
        statusCode: 200,
        data: result.rows,
        meta: { count: result.rows.length, orgId },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /orgs/:orgId/sales/orders/:orderId ──────────────────────
router.get(
  '/orgs/:orgId/sales/orders/:orderId',
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER]),
  requirePermission(MODULES.SALES, ACTIONS.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      const result = await query(
        `SELECT o.*, u.name AS created_by_name FROM sales_orders o
         LEFT JOIN users u ON u.id = o.created_by
         WHERE o.id = $1 AND o.org_id = $2`,
        [req.params.orderId, orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ statusCode: 404, error: 'NOT_FOUND', message: 'Order not found', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      res.json({ statusCode: 200, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /orgs/:orgId/sales/orders ──────────────────────────────
router.post(
  '/orgs/:orgId/sales/orders',
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.SALES, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { customerName, amount, currency, status, notes } = req.body;

      if (!customerName || amount === undefined) {
        res.status(400).json({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'customerName and amount are required', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      const result = await query(
        `INSERT INTO sales_orders (org_id, customer_name, amount, currency, status, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [orgId, customerName, amount, currency || 'INR', status || 'pending', notes || null, req.user.id],
      );

      res.status(201).json({
        statusCode: 201,
        data: result.rows[0],
        message: 'Sales order created successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /orgs/:orgId/sales/orders/:orderId ──────────────────────
router.put(
  '/orgs/:orgId/sales/orders/:orderId',
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.SALES, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { customerName, amount, currency, status, notes } = req.body;

      const fields: string[] = [];
      const values: any[] = [];
      let i = 1;

      if (customerName) { fields.push(`customer_name = $${i++}`); values.push(customerName); }
      if (amount !== undefined) { fields.push(`amount = $${i++}`); values.push(amount); }
      if (currency) { fields.push(`currency = $${i++}`); values.push(currency); }
      if (status) { fields.push(`status = $${i++}`); values.push(status); }
      if (notes !== undefined) { fields.push(`notes = $${i++}`); values.push(notes); }

      if (fields.length === 0) {
        res.status(400).json({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'At least one field to update is required', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      fields.push('updated_at = NOW()');
      values.push(req.params.orderId, orgId);

      const result = await query(
        `UPDATE sales_orders SET ${fields.join(', ')} WHERE id = $${i++} AND org_id = $${i} RETURNING *`,
        values,
      );

      if (result.rows.length === 0) {
        res.status(404).json({ statusCode: 404, error: 'NOT_FOUND', message: 'Order not found', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      res.json({ statusCode: 200, data: result.rows[0], message: 'Order updated successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /orgs/:orgId/sales/orders/:id ────────────────────────
router.delete(
  '/orgs/:orgId/sales/orders/:id',
  ...baseChain,
  requireRole([ROLES.SUPERADMIN]),
  requirePermission(MODULES.SALES, ACTIONS.DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      const result = await query(
        'DELETE FROM sales_orders WHERE id = $1 AND org_id = $2 RETURNING id, customer_name',
        [req.params.id, orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ statusCode: 404, error: 'NOT_FOUND', message: 'Order not found', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      res.json({ statusCode: 200, message: `Order for '${result.rows[0].customer_name}' deleted successfully` });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /orgs/:orgId/sales/targets ──────────────────────────────
router.get(
  '/orgs/:orgId/sales/targets',
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER]),
  requirePermission(MODULES.SALES, ACTIONS.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      const result = await query(
        'SELECT * FROM sales_targets WHERE org_id = $1 ORDER BY start_date DESC',
        [orgId],
      );

      res.json({
        statusCode: 200,
        data: result.rows,
        meta: { count: result.rows.length, orgId },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /orgs/:orgId/sales/targets ─────────────────────────────
router.post(
  '/orgs/:orgId/sales/targets',
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.SALES, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { name, target, achieved, currency, startDate, endDate } = req.body;

      if (!name || target === undefined) {
        res.status(400).json({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'name and target are required', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      const result = await query(
        `INSERT INTO sales_targets (org_id, name, target, achieved, currency, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [orgId, name, target, achieved || 0, currency || 'INR', startDate || null, endDate || null],
      );

      res.status(201).json({
        statusCode: 201,
        data: result.rows[0],
        message: 'Sales target created successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
