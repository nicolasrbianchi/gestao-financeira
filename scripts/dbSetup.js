import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return String(v).toLowerCase() === 'true';
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não configurado.');

  const useSsl = envBool('DATABASE_SSL', true);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  if (!sql.trim()) throw new Error('schema.sql está vazio.');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    console.log('✅ schema.sql aplicado com sucesso');
  } catch (e) {
    try { await client.query('rollback'); } catch {}
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ Falha ao aplicar schema.sql:', e?.message || String(e));
  process.exit(1);
});

