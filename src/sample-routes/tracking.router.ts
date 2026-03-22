import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../core/middleware/auth.middleware';
import { tenantGuard } from '../core/middleware/tenant.guard';
import { requireRole } from '../core/middleware/role.guard';
import { requirePermission } from '../core/middleware/permission.guard';
import { validateUuidParams } from '../core/middleware/validate-uuid';
import { ROLES } from '../core/rbac/roles.constants';
import { MODULES, ACTIONS } from '../core/constants/modules.constants';

const router = Router();
const baseChain = [authMiddleware, tenantGuard];

/**
 * Live Tracking Routes
 *
 * Real-time field staff location tracking.
 * - superadmin: full access across all orgs
 * - org_admin: read + write within own org
 * - org_manager: read-only within own org
 * - org_employee: no access
 * - superadmin_team: blocked from org routes
 */

// ─── GET /orgs/:orgId/tracking/locations ─────────────────────────
// Get real-time locations of field staff
router.get(
  '/orgs/:orgId/tracking/locations',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER]),
  requirePermission(MODULES.TRACKING, ACTIONS.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      res.json({
        statusCode: 200,
        data: [
          {
            id: 'loc-001',
            userId: 'field-staff-001',
            orgId,
            latitude: 28.6139,
            longitude: 77.209,
            timestamp: new Date().toISOString(),
            status: 'active',
          },
          {
            id: 'loc-002',
            userId: 'field-staff-002',
            orgId,
            latitude: 28.7041,
            longitude: 77.1025,
            timestamp: new Date().toISOString(),
            status: 'idle',
          },
        ],
        meta: { orgId, role: req.user.role },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /orgs/:orgId/tracking/history/:userId ───────────────────
// Get location history for a specific field staff member
router.get(
  '/orgs/:orgId/tracking/history/:userId',
  validateUuidParams('orgId', 'userId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN, ROLES.ORG_ADMIN, ROLES.ORG_MANAGER]),
  requirePermission(MODULES.TRACKING, ACTIONS.READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;

      res.json({
        statusCode: 200,
        data: [
          {
            latitude: 28.6139,
            longitude: 77.209,
            timestamp: '2026-03-22T09:00:00.000Z',
          },
          {
            latitude: 28.6145,
            longitude: 77.2095,
            timestamp: '2026-03-22T09:15:00.000Z',
          },
        ],
        meta: { orgId, userId: req.params.userId, role: req.user.role },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /orgs/:orgId/tracking/checkin ──────────────────────────
// Only superadmin can write tracking data (org_admin has read-only per task spec)
router.post(
  '/orgs/:orgId/tracking/checkin',
  validateUuidParams('orgId'),
  ...baseChain,
  requireRole([ROLES.SUPERADMIN]),
  requirePermission(MODULES.TRACKING, ACTIONS.WRITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.resolvedOrgId || req.params.orgId;
      const { latitude, longitude } = req.body;

      res.status(201).json({
        statusCode: 201,
        data: {
          userId: req.user.id,
          orgId,
          latitude: latitude || 28.6139,
          longitude: longitude || 77.209,
          timestamp: new Date().toISOString(),
          status: 'checked_in',
        },
        message: 'Location check-in recorded successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
