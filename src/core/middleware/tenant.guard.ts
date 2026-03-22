import { Request, Response, NextFunction } from 'express';
import { ROLES } from '../rbac/roles.constants';
import { ERROR_CODES } from '../constants/errors.constants';

/**
 * Tenant Guard — MOST CRITICAL MIDDLEWARE
 *
 * Enforces multi-tenant isolation at the middleware level:
 * - superadmin: full access, no restriction
 * - superadmin_team: platform view only — blocked from ALL org-specific routes
 * - org_admin/org_manager/org_employee: can only access their own org
 *
 * The orgId is extracted from route params, body, or query.
 * If it doesn't match the user's orgId from the JWT, the request is blocked
 * BEFORE any controller or database query runs.
 */
export function tenantGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const { user } = req;

  // superadmin: full access, no restriction
  if (user.role === ROLES.SUPERADMIN) {
    next();
    return;
  }

  // superadmin_team: platform view only — block ALL org-specific routes
  // canImpersonate is always false for this role (set in JWT)
  if (user.role === ROLES.SUPERADMIN_TEAM) {
    const orgId =
      req.params.orgId || req.body?.orgId || (req.query?.orgId as string);
    if (orgId) {
      res.status(403).json({
        statusCode: 403,
        error: ERROR_CODES.IMPERSONATION_BLOCKED,
        message:
          'Platform team members cannot access organization-specific data',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }
    next();
    return;
  }

  // org-level roles: enforce org boundary
  if (user.level === 'org') {
    const requestedOrgId =
      req.params.orgId || req.body?.orgId || (req.query?.orgId as string);

    if (!requestedOrgId) {
      // No org in route — auto-scope to user's own org
      req.resolvedOrgId = user.orgId!;
      next();
      return;
    }

    // THE CRITICAL CHECK — org A user cannot access org B data
    if (requestedOrgId !== user.orgId) {
      res.status(403).json({
        statusCode: 403,
        error: ERROR_CODES.TENANT_VIOLATION,
        message: 'Access denied: you do not belong to this organization',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }

    req.resolvedOrgId = user.orgId!;
    next();
    return;
  }

  res.status(403).json({
    statusCode: 403,
    error: ERROR_CODES.ROLE_DENIED,
    message: 'Access denied',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}
