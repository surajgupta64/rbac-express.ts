import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../core/middleware/auth.middleware';
import { tenantGuard } from '../core/middleware/tenant.guard';
import { requireRole } from '../core/middleware/role.guard';
import { requirePermission } from '../core/middleware/permission.guard';
import { validateUuidParams } from '../core/middleware/validate-uuid';
import { ROLES } from '../core/rbac/roles.constants';
import { MODULES, ACTIONS } from '../core/constants/modules.constants';
import { query } from '../db/db.client';

const router = Router();
const baseChain = [authMiddleware, tenantGuard];

// ─── GET /orgs/:orgId/crm/leads ──────────────────────────────────
router.get(
  '/orgs/:orgId/crm/leads',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER]),
  requirePermission(MODULES.CRM, ACTIONS.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { status } = req.query;

      let sql = `
        SELECT l.id, l.name, l.email, l.phone, l.company, l.status, l.source, l.notes,
               l.created_at, l.updated_at,
               u1.name AS assigned_to_name, u1.email AS assigned_to_email,
               u2.name AS created_by_name
        FROM crm_leads l
        LEFT JOIN users u1 ON u1.id = l.assigned_to
        LEFT JOIN users u2 ON u2.id = l.created_by
        WHERE l.org_id = $1`;
      const params: any[] = [orgId];

      if (status) {
        sql += ` AND l.status = $${params.length + 1}`;
        params.push(status);
      }

      sql += ' ORDER BY l.created_at DESC';

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

// ─── GET /orgs/:orgId/crm/leads/:leadId ─────────────────────────
router.get(
  '/orgs/:orgId/crm/leads/:leadId',
  validateUuidParams('orgId', 'leadId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER]),
  requirePermission(MODULES.CRM, ACTIONS.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      const result = await query(
        `SELECT l.*, u1.name AS assigned_to_name, u2.name AS created_by_name
         FROM crm_leads l
         LEFT JOIN users u1 ON u1.id = l.assigned_to
         LEFT JOIN users u2 ON u2.id = l.created_by
         WHERE l.id = $1 AND l.org_id = $2`,
        [req.params.leadId, orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ statusCode: 404, error: 'NOT_FOUND', message: 'Lead not found', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      res.json({ statusCode: 200, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /orgs/:orgId/crm/leads ────────────────────────────────
router.post(
  '/orgs/:orgId/crm/leads',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.CRM, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { name, email, phone, company, status, source, notes, assignedTo } = req.body;

      if (!name) {
        res.status(400).json({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'Lead name is required', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      const result = await query(
        `INSERT INTO crm_leads (org_id, name, email, phone, company, status, source, notes, assigned_to, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [orgId, name, email || null, phone || null, company || null, status || 'new', source || null, notes || null, assignedTo || null, req.user.id],
      );

      res.status(201).json({
        statusCode: 201,
        data: result.rows[0],
        message: 'Lead created successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /orgs/:orgId/crm/leads/:leadId ─────────────────────────
router.put(
  '/orgs/:orgId/crm/leads/:leadId',
  validateUuidParams('orgId', 'leadId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN]),
  requirePermission(MODULES.CRM, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { name, email, phone, company, status, source, notes, assignedTo } = req.body;

      const fields: string[] = [];
      const values: any[] = [];
      let i = 1;

      if (name) { fields.push(`name = $${i++}`); values.push(name); }
      if (email !== undefined) { fields.push(`email = $${i++}`); values.push(email); }
      if (phone !== undefined) { fields.push(`phone = $${i++}`); values.push(phone); }
      if (company !== undefined) { fields.push(`company = $${i++}`); values.push(company); }
      if (status) { fields.push(`status = $${i++}`); values.push(status); }
      if (source !== undefined) { fields.push(`source = $${i++}`); values.push(source); }
      if (notes !== undefined) { fields.push(`notes = $${i++}`); values.push(notes); }
      if (assignedTo !== undefined) { fields.push(`assigned_to = $${i++}`); values.push(assignedTo); }

      if (fields.length === 0) {
        res.status(400).json({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'At least one field to update is required', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      fields.push('updated_at = NOW()');
      values.push(req.params.leadId, orgId);

      const result = await query(
        `UPDATE crm_leads SET ${fields.join(', ')} WHERE id = $${i++} AND org_id = $${i} RETURNING *`,
        values,
      );

      if (result.rows.length === 0) {
        res.status(404).json({ statusCode: 404, error: 'NOT_FOUND', message: 'Lead not found', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      res.json({ statusCode: 200, data: result.rows[0], message: 'Lead updated successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /orgs/:orgId/crm/leads/:id ───────────────────────────
router.delete(
  '/orgs/:orgId/crm/leads/:id',
  validateUuidParams('orgId', 'id'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN]),
  requirePermission(MODULES.CRM, ACTIONS.DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      const result = await query(
        'DELETE FROM crm_leads WHERE id = $1 AND org_id = $2 RETURNING id, name',
        [req.params.id, orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ statusCode: 404, error: 'NOT_FOUND', message: 'Lead not found', timestamp: new Date().toISOString(), path: req.originalUrl });
        return;
      }

      res.json({ statusCode: 200, message: `Lead '${result.rows[0].name}' deleted successfully` });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
