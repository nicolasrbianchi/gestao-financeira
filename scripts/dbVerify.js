import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db.js';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurado.');

  const checks = [
    `select 1 as ok`,
    `select count(*)::int as count from transactions`,
    `select count(*)::int as count from categories`,
    `select count(*)::int as count from subcategories`,
  ];

  for (const sql of checks) {
    const r = await query(sql);
    console.log(sql.split('\n')[0].slice(0, 60), '→', r.rows[0]);
  }

  // sanity: ids >= 2
  const bad = await query('select count(*)::int as count from transactions where id < 2');
  console.log('bad ids (<2) →', bad.rows[0]);
}

main().catch((e) => {
  console.error('❌ db:verify falhou:', e?.message || String(e));
  process.exit(1);
});

