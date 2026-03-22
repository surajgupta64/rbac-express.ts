import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '../constants/errors.constants';

/**
 * Permission Guard — Factory Middleware
 *
 * Returns an Express middleware that checks if the user's role
 * has the required action on the specified module.
 *
 * Reads from req.user.permissions (baked into the JWT),
 * so no DB call is needed per request.
 *
 * Usage:
 *   router.post('/employees', authMiddleware, tenantGuard, requirePermission('hrms', 'write'), handler);
 */
export function requirePermission(module: string, action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allowedActions: string[] = req.user.permissions?.[module] ?? [];

    if (!allowedActions.includes(action)) {
      res.status(403).json({
        statusCode: 403,
        error: ERROR_CODES.PERMISSION_DENIED,
        message: `Permission denied: ${action} on ${module}`,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }
    next();
  };
}
