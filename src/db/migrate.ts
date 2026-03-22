import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool, testConnection } from './db.client';

async function migrate() {
  try {
    await testConnection();

    const migrationFile = path.join(process.cwd(), 'src', 'db', 'migrations', '001_initial.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    await pool.query(sql);
    console.log('✓ Migration completed successfully');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('✗ Migration failed:', error.message || error);
    console.error(error);
    process.exit(1);
  }
}

migrate();
