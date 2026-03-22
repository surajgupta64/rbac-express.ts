import { Request, Response, NextFunction } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * UUID Validation Middleware Factory
 *
 * Returns Express middleware that validates the specified route params
 * are valid UUIDs. If any param is present but not a valid UUID,
 * responds with 400 VALIDATION_ERROR.
 *
 * Usage:
 *   router.get('/orgs/:orgId/employees/:id',
 *     validateUuidParams('orgId', 'id'),
 *     handler
 *   );
 */
export function validateUuidParams(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const paramName of paramNames) {
      const value = req.params[paramName];
      if (value !== undefined && (typeof value !== 'string' || !UUID_REGEX.test(value))) {
        res.status(400).json({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: `Invalid UUID format for parameter: ${paramName}`,
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }
    }
    next();
  };
}
