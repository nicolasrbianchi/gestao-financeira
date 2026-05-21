import dotenv from 'dotenv';
dotenv.config();

import { getTransactions as getAppsTransactions, getMetadata as getAppsMetadata } from '../server/appsScriptClient.js';
import { normalizeTransactions, parseMoneyBR } from '../server/normalize.js';
import { query } from '../server/db.js';
import { createCategory } from '../server/categoriesDb.js';
import { createSubcategory } from '../server/subcategoriesDb.js';

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não configurado.`);
  return v;
}

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return String(v).toLowerCase() === 'true';
}

function parseArgs(argv = []) {
  const args = new Set(argv);
  return {
    dryRun: args.has('--dry-run') || args.has('--dryrun'),
    truncate: args.has('--truncate'),
  };
}

async function upsertMonthlyGoals(monthlyGoals = {}, { dryRun } = {}) {
  const entries = Object.entries(monthlyGoals || {})
    .map(([month, value]) => [String(month).trim(), Number(value)])
    .filter(([m, v]) => m && Number.isFinite(v));

  if (!entries.length) return { count: 0 };
  if (dryRun) return { count: entries.length };

  for (const [month, value] of entries) {
    await query(
      `insert into monthly_goals (month, value)
       values ($1, $2)
       on conflict (month) do update set value=excluded.value`,
      [month, value]
    );
  }
  return { count: entries.length };
}

async function upsertTransactions(transactions = [], { dryRun } = {}) {
  if (!transactions.length) return { count: 0 };
  if (dryRun) return { count: transactions.length };

  // Em lotes para não estourar payload/limites.
  const batchSize = Number(process.env.MIGRATION_BATCH_SIZE || 250);
  let inserted = 0;

  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);

    // Multi-values insert com upsert por id.
    const values = [];
    const params = [];
    let p = 1;

    for (const t of batch) {
      values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
      params.push(
        Number(t.sheetRowNumber),
        t.date,
        t.name || 'Sem nome',
        t.type || '',
        t.reserve || '',
        t.account || '',
        t.categoryId || null,
        t.subcategoryId || null,
        t.paymentMethod || '',
        Number(t.amount),
        t.status || '',
        t.installment || '',
        t.notes || ''
      );
    }

    await query(
      `insert into transactions
        (id, date, name, type, reserve, account, category_id, subcategory_id, payment_method, amount, status, installment, notes)
       values ${values.join(',')}
       on conflict (id) do update set
         date=excluded.date,
         name=excluded.name,
         type=excluded.type,
         reserve=excluded.reserve,
         account=excluded.account,
         category_id=excluded.category_id,
         subcategory_id=excluded.subcategory_id,
         payment_method=excluded.payment_method,
         amount=excluded.amount,
         status=excluded.status,
         installment=excluded.installment,
         notes=excluded.notes,
         updated_at=now()`,
      params
    );

    inserted += batch.length;
    console.log(`... upsert batch ${i + 1}-${i + batch.length} / ${transactions.length}`);
  }

  return { count: inserted };
}

async function fixSequence({ dryRun } = {}) {
  if (dryRun) return;
  await query(
    `select setval(pg_get_serial_sequence('transactions','id'), (select coalesce(max(id), 1) from transactions), true)`
  );
}

async function main() {
  const { dryRun, truncate } = parseArgs(process.argv.slice(2));

  // Garantias mínimas de config.
  requiredEnv('DATABASE_URL');
  requiredEnv('APPS_SCRIPT_URL');

  // Quando for via Apps Script, o token pode ser vazio se o script aceitar,
  // mas no nosso caso é obrigatório.
  requiredEnv('APPS_SCRIPT_TOKEN');

  if (!envBool('DATABASE_SSL', true)) {
    console.log('ℹ️ DATABASE_SSL=false (ok se o seu Postgres aceitar sem SSL)');
  }

  console.log(`🚚 Migração Apps Script → Postgres (Supabase) ${dryRun ? '[DRY RUN]' : ''}`);

  if (truncate) {
    if (dryRun) {
      console.log('... (dry-run) truncate solicitado, ignorando');
    } else {
      console.log('⚠️ truncating tables: transactions, monthly_goals');
      await query('truncate table transactions restart identity cascade');
      await query('truncate table monthly_goals cascade');
    }
  }

  const raw = await getAppsTransactions({ requestId: 'migration' });
  const normalized = normalizeTransactions(raw.transactions || [], { requestId: 'migration' });
  const metadata = await getAppsMetadata({ requestId: 'migration' }).catch(() => ({}));

  // Migra categorias/subcategorias (tabelas gerenciáveis) e resolve ids.
  const categories = Array.from(new Set((metadata?.categories || []).map((s) => String(s || '').trim()).filter(Boolean)));
  const subcategories = Array.from(new Set((metadata?.subcategories || []).map((s) => String(s || '').trim()).filter(Boolean)));

  const categoryIdByName = new Map();
  const subcategoryIdByName = new Map();

  if (dryRun) {
    categories.forEach((n, i) => categoryIdByName.set(n, i + 1));
    subcategories.forEach((n, i) => subcategoryIdByName.set(n, i + 1));
  } else {
    for (const name of categories) {
      const c = await createCategory({ name });
      categoryIdByName.set(name, Number(c.id));
    }
    for (const name of subcategories) {
      const s = await createSubcategory({ name });
      subcategoryIdByName.set(name, Number(s.id));
    }
  }

  normalized.forEach((t) => {
    t.categoryId = t.category ? (categoryIdByName.get(String(t.category).trim()) || null) : null;
    t.subcategoryId = t.subcategory ? (subcategoryIdByName.get(String(t.subcategory).trim()) || null) : null;
  });

  // Sanidade: ids devem ser >= 2 porque vêm de sheetRowNumber.
  const bad = normalized.filter((t) => !t.sheetRowNumber || t.sheetRowNumber < 2);
  if (bad.length) throw new Error(`Encontradas ${bad.length} transações com sheetRowNumber inválido (<2).`);

  // Sanidade: amount deve ser positivo.
  const invalidAmount = normalized.filter((t) => !Number.isFinite(Number(t.amount)) || Number(t.amount) <= 0);
  if (invalidAmount.length) throw new Error(`Encontradas ${invalidAmount.length} transações com amount inválido.`);

  // monthlyGoals do Apps Script pode vir como número ou string formatada.
  const goals = metadata?.monthlyGoals || {};
  const goalsNormalized = Object.fromEntries(
    Object.entries(goals).map(([k, v]) => [k, typeof v === 'number' ? v : parseMoneyBR(v) || 0])
  );

  console.log(`... transactions: ${normalized.length}`);
  console.log(`... monthlyGoals: ${Object.keys(goalsNormalized).length}`);
  console.log(`... categories: ${categories.length}`);
  console.log(`... subcategories: ${subcategories.length}`);

  await upsertMonthlyGoals(goalsNormalized, { dryRun });
  await upsertTransactions(normalized, { dryRun });
  await fixSequence({ dryRun });

  console.log('✅ Migração concluída');
}

main().catch((e) => {
  console.error('❌ Migração falhou:', e?.message || String(e));
  process.exit(1);
});
