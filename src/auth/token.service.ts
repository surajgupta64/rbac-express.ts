import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '../db/db.client';
import { User } from '../users/users.types';
import { DEFAULT_PERMISSIONS } from '../core/rbac/permissions';
import { PLATFORM_ROLES } from '../core/rbac/roles.constants';

const PRIVATE_KEY = fs.readFileSync(
  path.join(process.cwd(), 'keys', 'private.key'),
  'utf8',
);

export const tokenService = {
  /**
   * Sign an RS256 access token with all claims baked in.
   * Permissions are embedded so microservices need zero DB calls.
   */
  signAccessToken(user: User): string {
    const level = PLATFORM_ROLES.includes(user.role) ? 'platform' : 'org';
    const permissions = DEFAULT_PERMISSIONS[user.role] || {};
    const canImpersonate = user.role !== 'superadmin_team';

    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        level,
        orgId: user.org_id,
        departmentId: user.department_id,
        permissions,
        canImpersonate,
      },
      PRIVATE_KEY,
      {
        algorithm: 'RS256' as const,
        expiresIn: (process.env.JWT_ACCESS_EXPIRY || '15m') as string & jwt.SignOptions['expiresIn'],
        issuer: process.env.JWT_ISSUER || 'davandee-auth-service',
        audience: process.env.JWT_AUDIENCE || 'davandee-platform',
      } satisfies jwt.SignOptions,
    );
  },

  /**
   * Generate an opaque refresh token (64 random bytes, hex-encoded).
   * The SHA-256 hash is stored in the database — never the raw token.
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  },

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  },

  /**
   * Store refresh token hash in the database.
   * Revokes all previous tokens for this user (one active token per user).
   */
  async storeRefreshToken(userId: string, rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const expiryDays = parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || '7', 10);
    const expiresAt = new Date(
      Date.now() + expiryDays * 24 * 60 * 60 * 1000,
    );

    // Revoke all previous refresh tokens for this user
    await query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false',
      [userId],
    );

    // Insert new refresh token
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt],
    );
  },

  /**
   * Validate a refresh token: must exist, not revoked, not expired.
   * Returns the user_id if valid.
   */
  async validateRefreshToken(
    rawToken: string,
  ): Promise<{ userId: string } | null> {
    const tokenHash = this.hashToken(rawToken);

    const result = await query(
      `SELECT user_id FROM refresh_tokens
       WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );

    if (result.rows.length === 0) return null;
    return { userId: result.rows[0].user_id };
  },

  /**
   * Revoke a specific refresh token by its raw value.
   */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await query(
      'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1',
      [tokenHash],
    );
  },

  /**
   * Revoke all refresh tokens for a user.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
      [userId],
    );
  },

  /**
   * Blacklist an access token in PostgreSQL.
   * The token is stored as a SHA-256 hash with an expiry time.
   * Expired blacklist entries are cleaned up by the DB or a scheduled job.
   */
  async blacklistAccessToken(
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const tokenHash = this.hashToken(token);
    await query(
      'INSERT INTO token_blacklist (token_hash, expires_at) VALUES ($1, $2) ON CONFLICT (token_hash) DO NOTHING',
      [tokenHash, expiresAt],
    );
  },
};
