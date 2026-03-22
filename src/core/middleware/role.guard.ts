import { Request, Response, NextFunction } from 'express';
import { Role } from '../rbac/roles.constants';
import { ERROR_CODES } from '../constants/errors.constants';

/**
 * Role Guard — Factory Middleware
 *
 * Returns an Express middleware that checks if the authenticated
 * user's role is in the allowed list for this route.
 *
 * Usage:
 *   router.get('/employees', authMiddleware, tenantGuard, requireRole([ROLES.ORG_ADMIN, ROLES.SUPERADMIN]), handler);
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        statusCode: 403,
        error: ERROR_CODES.ROLE_DENIED,
        message: `Route requires one of: [${allowedRoles.join(', ')}]. Your role: ${req.user.role}`,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }
    next();
  };
}
