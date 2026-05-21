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

export async function dbSetup() {
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
    // Evita corrida entre múltiplas instâncias (Render pode subir mais de 1)
    // Lock global (constante) só pra proteger migrations simples via schema.sql.
    await client.query('select pg_advisory_lock($1::bigint) as locked', ['78011223344556677']);

    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    console.log('✅ schema.sql aplicado com sucesso');
  } catch (e) {
    try { await client.query('rollback'); } catch {}
    throw e;
  } finally {
    try { await client.query('select pg_advisory_unlock($1::bigint)', ['78011223344556677']); } catch {}
    client.release();
    await pool.end();
  }
}

// Executável via `node scripts/dbSetup.js`
if (process.argv[1] && process.argv[1].includes('scripts/dbSetup.js')) {
  dbSetup().catch((e) => {
    console.error('❌ Falha ao aplicar schema.sql:', e?.message || String(e));
    process.exit(1);
  });
}
