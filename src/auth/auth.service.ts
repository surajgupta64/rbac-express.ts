import bcrypt from 'bcrypt';
import { query } from '../db/db.client';
import { usersRepository } from '../users/users.repository';
import { tokenService } from './token.service';
import { AppError } from '../core/middleware/error.handler';
import { ERROR_CODES } from '../core/constants/errors.constants';
import { PLATFORM_ROLES } from '../core/rbac/roles.constants';

const MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
const WINDOW_MINUTES = parseInt(process.env.LOGIN_WINDOW_MINUTES || '15', 10);
const JWT_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const LOCKOUT_MINUTES = parseInt(
  process.env.LOCKOUT_DURATION_MINUTES || '30',
  10,
);

export const authService = {
  /**
   * Login with email + password.
   * Includes rate limiting, lockout, bcrypt verification, and token issuance.
   */
  async login(
    email: string,
    password: string,
    ip: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: { id: string; email: string; name: string; role: string; level: string; orgId: string | null; departmentId: string | null } }> {
    // 1. Check rate limit (Postgres-based)
    const recentAttempts = await query(
      `SELECT COUNT(*) as count FROM login_attempts
       WHERE email = $1 AND ip = $2 AND success = false
       AND attempted_at > NOW() - INTERVAL '${WINDOW_MINUTES} minutes'`,
      [email, ip],
    );

    if (parseInt(recentAttempts.rows[0].count, 10) >= MAX_ATTEMPTS) {
      // Log the blocked attempt
      await this.logAttempt(email, ip, false);
      throw new AppError(429, ERROR_CODES.RATE_LIMITED, 'Too many login attempts. Try again later.');
    }

    // 2. Find user
    const user = await usersRepository.findByEmail(email);
    if (!user) {
      await this.logAttempt(email, ip, false);
      throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // 3. Check active
    if (!user.is_active) {
      await this.logAttempt(email, ip, false);
      throw new AppError(401, ERROR_CODES.ACCOUNT_INACTIVE, 'Account is deactivated');
    }

    // 4. Check locked
    if (user.is_locked) {
      if (user.locked_until && new Date() < user.locked_until) {
        await this.logAttempt(email, ip, false);
        throw new AppError(401, ERROR_CODES.ACCOUNT_LOCKED, 'Account is locked. Try again later.');
      }
      // Lockout expired — unlock
      await usersRepository.unlockUser(user.id);
    }

    // 5. Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      await this.logAttempt(email, ip, false);

      // Check if we should lock the account
      const failedCount = await query(
        `SELECT COUNT(*) as count FROM login_attempts
         WHERE email = $1 AND ip = $2 AND success = false
         AND attempted_at > NOW() - INTERVAL '${WINDOW_MINUTES} minutes'`,
        [email, ip],
      );

      if (parseInt(failedCount.rows[0].count, 10) >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await usersRepository.lockUser(user.id, lockedUntil);
      }

      throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // 6. Success — issue tokens
    await this.logAttempt(email, ip, true);

    const accessToken = tokenService.signAccessToken(user);
    const refreshToken = tokenService.generateRefreshToken();
    await tokenService.storeRefreshToken(user.id, refreshToken);

    const level = PLATFORM_ROLES.includes(user.role) ? 'platform' : 'org';

    return {
      accessToken,
      refreshToken,
      expiresIn: parseExpiryToSeconds(JWT_EXPIRY),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        level,
        orgId: user.org_id,
        departmentId: user.department_id,
      },
    };
  },

  /**
   * Rotate refresh token: revoke old, issue new pair.
   */
  async refresh(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: { id: string; email: string; name: string; role: string; level: string; orgId: string | null; departmentId: string | null } }> {
    // 1. Validate refresh token
    const tokenData = await tokenService.validateRefreshToken(rawRefreshToken);
    if (!tokenData) {
      throw new AppError(401, ERROR_CODES.INVALID_REFRESH_TOKEN, 'Invalid or expired refresh token');
    }

    // 2. Fetch user
    const user = await usersRepository.findById(tokenData.userId);
    if (!user || !user.is_active) {
      throw new AppError(401, ERROR_CODES.ACCOUNT_INACTIVE, 'Account is deactivated');
    }
    if (user.is_locked && user.locked_until && new Date() < user.locked_until) {
      throw new AppError(401, ERROR_CODES.ACCOUNT_LOCKED, 'Account is locked');
    }

    // 3. Revoke old token
    await tokenService.revokeRefreshToken(rawRefreshToken);

    // 4. Issue new pair
    const accessToken = tokenService.signAccessToken(user);
    const newRefreshToken = tokenService.generateRefreshToken();
    await tokenService.storeRefreshToken(user.id, newRefreshToken);

    const level = PLATFORM_ROLES.includes(user.role) ? 'platform' : 'org';

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: parseExpiryToSeconds(JWT_EXPIRY),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        level,
        orgId: user.org_id,
        departmentId: user.department_id,
      },
    };
  },

  /**
   * Logout: blacklist access token, revoke refresh token.
   */
  async logout(
    accessToken: string,
    refreshToken: string,
    tokenExp: number,
  ): Promise<void> {
    // Blacklist the access token until it expires naturally
    const expiresAt = new Date(tokenExp * 1000);
    await tokenService.blacklistAccessToken(accessToken, expiresAt);

    // Revoke refresh token
    if (refreshToken) {
      await tokenService.revokeRefreshToken(refreshToken);
    }
  },

  /**
   * Change password for the current user.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'User not found');
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Current password is incorrect');
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hash = await bcrypt.hash(newPassword, rounds);
    await usersRepository.updatePassword(userId, hash);

    // Revoke all existing refresh tokens (force re-login on all devices)
    await tokenService.revokeAllForUser(userId);
  },

  async logAttempt(
    email: string,
    ip: string,
    success: boolean,
  ): Promise<void> {
    await query(
      'INSERT INTO login_attempts (email, ip, success) VALUES ($1, $2, $3)',
      [email, ip, success],
    );
  },
};

/**
 * Parse JWT expiry string (e.g. '15m', '3h', '7d') to seconds.
 */
function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 900; // fallback 15 min

  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 900;
  }
}
