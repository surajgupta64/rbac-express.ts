import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../core/middleware/auth.middleware';
import { requireRole } from '../core/middleware/role.guard';
import { validateUuidParams } from '../core/middleware/validate-uuid';
import { ROLES } from '../core/rbac/roles.constants';
import { query } from '../db/db.client';

const router = Router();

/**
 * Platform / Org Management Routes
 *
 * - superadmin: full CRUD (create, read, update, delete, activate/deactivate)
 * - superadmin_team: read-only (list + get org details)
 * - org_admin / org_manager / org_employee: NO access
 */

// ─── GET /org ────────────────────────────────────────────────────
// List all organizations registered on the platform
router.get(
  '/org',
  authMiddleware,
  requireRole([ROLES.SUPERADMIN, ROLES.SUPERADMIN_TEAM]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        'SELECT id, name, slug, is_active, created_at FROM orgs ORDER BY created_at DESC',
      );

      res.status(200).json({
        statusCode: 200,
        data: result.rows,
        meta: {
          count: result.rows.length,
          requestedBy: req.user.email,
          role: req.user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /org/:orgId ─────────────────────────────────────────────
// Get a single organization's details
router.get(
  '/org/:orgId',
  validateUuidParams('orgId'),
  authMiddleware,
  requireRole([ROLES.SUPERADMIN, ROLES.SUPERADMIN_TEAM]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        'SELECT id, name, slug, is_active, created_at FROM orgs WHERE id = $1',
        [req.params.orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      res.status(200).json({
        statusCode: 200,
        data: result.rows[0],
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /org ───────────────────────────────────────────────────
// Create a new organization (superadmin ONLY)
router.post(
  '/org',
  authMiddleware,
  requireRole([ROLES.SUPERADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, slug } = req.body;

      if (!name || !slug) {
        res.status(400).json({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'name and slug are required',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      const existing = await query('SELECT id, name FROM orgs WHERE slug = $1', [slug]);
      if (existing.rows.length > 0) {
        res.status(409).json({
          statusCode: 409,
          error: 'DUPLICATE_SLUG',
          message: `Organization with slug '${slug}' already exists. Existing org: '${existing.rows[0].name}' (id: ${existing.rows[0].id})`,
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      const result = await query(
        `INSERT INTO orgs (name, slug) VALUES ($1, $2)
         RETURNING id, name, slug, is_active, created_at`,
        [name, slug],
      );

      res.status(201).json({
        statusCode: 201,
        data: result.rows[0],
        message: 'Organization created successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /org/:orgId ─────────────────────────────────────────────
// Update an organization's details (superadmin ONLY)
router.put(
  '/org/:orgId',
  validateUuidParams('orgId'),
  authMiddleware,
  requireRole([ROLES.SUPERADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, slug } = req.body;

      if (!name && !slug) {
        res.status(400).json({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'At least one of name or slug is required',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Check org exists
      const existing = await query('SELECT id FROM orgs WHERE id = $1', [req.params.orgId]);
      if (existing.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Check slug uniqueness if slug is being changed
      if (slug) {
        const slugCheck = await query(
          'SELECT id, name FROM orgs WHERE slug = $1 AND id != $2',
          [slug, req.params.orgId],
        );
        if (slugCheck.rows.length > 0) {
          res.status(409).json({
            statusCode: 409,
            error: 'DUPLICATE_SLUG',
            message: `Slug '${slug}' is already used by '${slugCheck.rows[0].name}'`,
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
          });
          return;
        }
      }

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name) {
        fields.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (slug) {
        fields.push(`slug = $${paramIndex++}`);
        values.push(slug);
      }

      values.push(req.params.orgId);

      const result = await query(
        `UPDATE orgs SET ${fields.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, name, slug, is_active, created_at`,
        values,
      );

      res.status(200).json({
        statusCode: 200,
        data: result.rows[0],
        message: 'Organization updated successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /org/:orgId/activate ──────────────────────────────────
// Activate an organization (superadmin ONLY)
router.patch(
  '/org/:orgId/activate',
  validateUuidParams('orgId'),
  authMiddleware,
  requireRole([ROLES.SUPERADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `UPDATE orgs SET is_active = true WHERE id = $1
         RETURNING id, name, slug, is_active, created_at`,
        [req.params.orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      res.status(200).json({
        statusCode: 200,
        data: result.rows[0],
        message: 'Organization activated successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /org/:orgId/deactivate ────────────────────────────────
// Deactivate an organization (superadmin ONLY)
// Deactivated orgs' users will be blocked by auth middleware on next request
router.patch(
  '/org/:orgId/deactivate',
  validateUuidParams('orgId'),
  authMiddleware,
  requireRole([ROLES.SUPERADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `UPDATE orgs SET is_active = false WHERE id = $1
         RETURNING id, name, slug, is_active, created_at`,
        [req.params.orgId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      res.status(200).json({
        statusCode: 200,
        data: result.rows[0],
        message: 'Organization deactivated successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /org/:orgId ──────────────────────────────────────────
// Permanently delete an organization (superadmin ONLY)
// This will cascade delete all departments and set user org_id to null
router.delete(
  '/org/:orgId',
  validateUuidParams('orgId'),
  authMiddleware,
  requireRole([ROLES.SUPERADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check org exists
      const existing = await query('SELECT id, name FROM orgs WHERE id = $1', [req.params.orgId]);
      if (existing.rows.length === 0) {
        res.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      // Delete all refresh tokens for users in this org
      await query(
        'DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE org_id = $1)',
        [req.params.orgId],
      );

      // Delete all login attempts for users in this org
      await query(
        'DELETE FROM login_attempts WHERE email IN (SELECT email FROM users WHERE org_id = $1)',
        [req.params.orgId],
      );

      // Delete all users in this org
      const deletedUsers = await query(
        'DELETE FROM users WHERE org_id = $1 RETURNING id, name, email',
        [req.params.orgId],
      );

      // Delete the organization (departments cascade via ON DELETE CASCADE)
      await query('DELETE FROM orgs WHERE id = $1', [req.params.orgId]);

      res.status(200).json({
        statusCode: 200,
        message: `Organization '${existing.rows[0].name}' permanently deleted.`,
        data: {
          deletedUsers: deletedUsers.rows.length,
          users: deletedUsers.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
