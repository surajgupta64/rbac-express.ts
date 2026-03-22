import { query } from '../db/db.client';
import { User } from './users.types';

export const usersRepository = {
  async findByEmail(email: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [
      email,
    ]);
    return result.rows[0] || null;
  },

  async findById(id: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [
      id,
    ]);
    return result.rows[0] || null;
  },

  async lockUser(id: string, lockedUntil: Date): Promise<void> {
    await query(
      'UPDATE users SET is_locked = true, locked_until = $2, updated_at = NOW() WHERE id = $1',
      [id, lockedUntil],
    );
  },

  async unlockUser(id: string): Promise<void> {
    await query(
      'UPDATE users SET is_locked = false, locked_until = NULL, updated_at = NOW() WHERE id = $1',
      [id],
    );
  },

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await query(
      'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
      [id, passwordHash],
    );
  },
};
