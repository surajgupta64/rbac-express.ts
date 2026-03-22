import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export async function getClient() {
  return pool.connect();
}

export async function testConnection(): Promise<void> {
  const result = await pool.query('SELECT NOW()');
  console.log('✓ PostgreSQL connected:', result.rows[0].now);
}
