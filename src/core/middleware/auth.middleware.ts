import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { query } from '../../db/db.client';
import { ERROR_CODES } from '../constants/errors.constants';
import { Role } from '../rbac/roles.constants';

const PUBLIC_KEY = fs.readFileSync(
  path.join(process.cwd(), 'keys', 'public.key'),
  'utf8',
);

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  level: 'platform' | 'org';
  orgId: string | null;
  departmentId: string | null;
  permissions: Record<string, string[]>;
  canImpersonate: boolean;
  iat: number;
  exp: number;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      statusCode: 401,
      error: ERROR_CODES.MISSING_TOKEN,
      message: 'Authorization header required (Bearer <token>)',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Check blacklist in Postgres
    const blacklisted = await query(
      'SELECT 1 FROM token_blacklist WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1',
      [hashToken(token)],
    );
    if (blacklisted.rows.length > 0) {
      res.status(401).json({
        statusCode: 401,
        error: ERROR_CODES.REVOKED_TOKEN,
        message: 'Token has been revoked',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }
    const payload = jwt.verify(token, PUBLIC_KEY, {
      algorithms: ['RS256'],
      issuer: process.env.JWT_ISSUER || 'davandee-auth-service',
      audience: process.env.JWT_AUDIENCE || 'davandee-platform',
    }) as JwtPayload;

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      level: payload.level,
      orgId: payload.orgId ?? null,
      departmentId: payload.departmentId ?? null,
      permissions: payload.permissions,
      canImpersonate: payload.canImpersonate,
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        statusCode: 401,
        error: ERROR_CODES.EXPIRED_TOKEN,
        message: 'Token has expired',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
      res.status(401).json({
        statusCode: 401,
        error: ERROR_CODES.INVALID_TOKEN,
        message: 'Token is invalid',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }
    // Forward unexpected errors (DB errors, etc.) to the global error handler
    next(err);
  }
}

function hashToken(token: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}
