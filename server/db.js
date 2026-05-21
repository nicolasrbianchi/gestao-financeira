import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (pool) return pool;
  if (!config.databaseUrl) throw new Error('DATABASE_URL não configurado.');

  pool = new Pool({
    connectionString: config.databaseUrl,
    // Supabase normalmente exige SSL.
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.DB_POOL_CONN_TIMEOUT_MS || 10_000),
  });

  return pool;
}

export async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

