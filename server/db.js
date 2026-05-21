import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (pool) return pool;
  if (!config.databaseUrl) throw new Error('DATABASE_URL não configurado.');

  // Render normalmente é IPv4-only. Se alguém configurar o Direct Connection do Supabase
  // (que resolve para IPv6), vai dar ENETUNREACH. Melhor falhar com uma mensagem clara.
  try {
    const u = new URL(config.databaseUrl);
    const host = String(u.hostname || '');
    if (host.startsWith('db.') && host.endsWith('.supabase.co')) {
      throw new Error(
        'DATABASE_URL parece ser Direct Connection (IPv6). Em hosts IPv4-only (ex: Render), use o Session Pooler (aws-*.pooler.supabase.com) e atualize o DATABASE_URL.'
      );
    }
  } catch {
    // ignore parse errors (pg aceita alguns formatos). Se der ruim, vai falhar no connect.
  }

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
