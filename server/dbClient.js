import { query } from './db.js';
import { logger } from './logger.js';
import { normalizeStringKey, parseMoneyBR, parseDateBR } from './normalize.js';
import { createCategory } from './categoriesDb.js';
import { createSubcategory } from './subcategoriesDb.js';

const TYPES_FALLBACK = ['Receita', 'Despesa', 'Reserva', 'Saldo'];
const RESERVES_FALLBACK = ['Entrada', 'Saida'];
const PAYMENT_METHODS_FALLBACK = ['Débito', 'Crédito', 'Pix', 'Boleto', 'Depósito'];
const CATEGORIES_FALLBACK = ['Transferencia entre contas'];
const SUBCATEGORIES_FALLBACK = ['Essencial', 'Extra'];

function toIsoFromFormDate(value) {
  // UI manda YYYY-MM-DD
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = parseDateBR(s);
  return parsed?.date || null;
}

function rowToTx(row) {
  // amount no banco é NUMERIC; driver retorna string.
  const amount = row.amount == null ? NaN : Number(row.amount);
  const dateIso = row.date;
  const displayDate = dateIso ? `${dateIso.slice(8, 10)}/${dateIso.slice(5, 7)}/${dateIso.slice(0, 4)}` : '';
  const id = Number(row.id);
  return {
    id,
    row: id,
    sheetRowNumber: id,
    date: dateIso,
    displayDate,
    name: row.name || 'Sem nome',
    type: row.type || '',
    reserve: row.reserve || '',
    reserveKey: normalizeStringKey(row.reserve || ''),
    account: row.account || '',
    category: row.category_name || '',
    categoryId: row.category_id != null ? Number(row.category_id) : null,
    subcategory: row.subcategory_name || '',
    subcategoryId: row.subcategory_id != null ? Number(row.subcategory_id) : null,
    paymentMethod: row.payment_method || '',
    amount: Number.isFinite(amount) ? Math.abs(amount) : NaN,
    status: row.status || '',
    installment: row.installment || '',
    notes: row.notes || '',
  };
}

async function ensureCategoryId(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  const created = await createCategory({ name: n });
  return Number(created.id);
}

async function ensureSubcategoryId(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  const created = await createSubcategory({ name: n });
  return Number(created.id);
}

export async function health(ctx = {}) {
  const started = Date.now();
  const requestId = ctx.requestId;
  await query('select 1 as ok');
  logger.debug('db_health_ok', { requestId, durationMs: Date.now() - started });
  return { ok: true };
}

export async function getTransactions(ctx = {}) {
  const started = Date.now();
  const requestId = ctx.requestId;

  const { rows } = await query(
    `select t.id, t.date, t.name, t.type, t.reserve, t.account,
            t.category_id, c.name as category_name,
            t.subcategory_id, s.name as subcategory_name,
            t.payment_method, t.amount, t.status, t.installment, t.notes
       from transactions t
       left join categories c on c.id = t.category_id
       left join subcategories s on s.id = t.subcategory_id
      order by t.date desc, t.id desc`
  );
  const transactions = rows.map(rowToTx).filter((t) => t.date && t.type && Number.isFinite(t.amount) && t.amount > 0);
  logger.debug('db_transactions_loaded', { requestId, count: transactions.length, durationMs: Date.now() - started });
  return { ok: true, transactions };
}

export async function getMetadata(ctx = {}) {
  const started = Date.now();
  const requestId = ctx.requestId;

  const distinct = async (column) => {
    const { rows } = await query(`select distinct ${column} as v from transactions where ${column} is not null and ${column} <> '' order by 1 asc`);
    return rows.map((r) => String(r.v));
  };

  const [types, reserves, accounts, paymentMethods, statuses, goals, categoriesRows, subcategoriesRows] = await Promise.all([
    distinct('type'),
    distinct('reserve'),
    distinct('account'),
    distinct('payment_method'),
    distinct('status'),
    query('select month, value from monthly_goals order by month asc').catch(() => ({ rows: [] })),
    query('select id, name, is_active from categories order by lower(name) asc').catch(() => ({ rows: [] })),
    query('select id, name, is_active from subcategories order by lower(name) asc').catch(() => ({ rows: [] })),
  ]);

  const monthlyGoals = Object.fromEntries((goals.rows || []).map((r) => [String(r.month), Number(r.value || 0)]).filter(([k, v]) => k && Number.isFinite(v)));

  const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];
  const merge = (a, b) => uniq([...(a || []), ...(b || [])]);

  const out = {
    ok: true,
    types: merge(types, TYPES_FALLBACK),
    reserves: merge(reserves, RESERVES_FALLBACK),
    accounts: uniq(accounts),
    // Mantém compat (arrays de string) e adiciona listas gerenciáveis (com id).
    categories: merge((categoriesRows.rows || []).map((r) => r.name), CATEGORIES_FALLBACK),
    categoriesList: (categoriesRows.rows || []).map((r) => ({ id: Number(r.id), name: String(r.name), isActive: !!r.is_active })),
    subcategories: merge((subcategoriesRows.rows || []).map((r) => r.name), SUBCATEGORIES_FALLBACK),
    subcategoriesList: (subcategoriesRows.rows || []).map((r) => ({ id: Number(r.id), name: String(r.name), isActive: !!r.is_active })),
    paymentMethods: merge(paymentMethods, PAYMENT_METHODS_FALLBACK),
    statuses: uniq(statuses),
    monthlyGoals,
  };

  logger.debug('db_metadata_loaded', { requestId, durationMs: Date.now() - started, counts: { types: out.types.length, accounts: out.accounts.length, categories: out.categories.length } });
  return out;
}

export async function addTransaction(payload, ctx = {}) {
  const requestId = ctx.requestId;
  const date = toIsoFromFormDate(payload.data || payload.date);
  const type = String(payload.tipo || payload.type || '').trim();
  const reserve = String(payload.reserva || payload.reserve || '').trim();
  const account = String(payload.conta || payload.account || '').trim();
  const category = String(payload.categoria || payload.category || '').trim();
  const subcategory = String(payload.subcategoria || payload.subcategory || '').trim();
  const paymentMethod = String(payload.forma || payload.paymentMethod || '').trim();
  const status = String(payload.status || '').trim();
  const installment = String(payload.parcela || payload.installment || '').trim();
  const notes = String(payload.obs || payload.notes || '').trim();
  const name = String(payload.nome || payload.name || '').trim();
  const amount = parseMoneyBR(payload.valor !== undefined ? payload.valor : payload.amount);

  if (!date) throw new Error('Data inválida.');
  if (!type) throw new Error('Tipo obrigatório.');
  if (!account) throw new Error('Conta/Canal obrigatório.');
  if (type !== 'Saldo' && !name) throw new Error('Nome obrigatório.');
  if (!amount || amount <= 0) throw new Error('Valor inválido.');

  const categoryId = await ensureCategoryId(category);
  const subcategoryId = await ensureSubcategoryId(subcategory);

  const { rows } = await query(
    `insert into transactions (date, name, type, reserve, account, category_id, subcategory_id, payment_method, amount, status, installment, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning id`,
    [date, name, type, reserve, account, categoryId, subcategoryId, paymentMethod, amount, status, installment, notes]
  );

  logger.info('db_transaction_created', { requestId, id: rows[0]?.id, type });
  return { ok: true, row: Number(rows[0]?.id) };
}

export async function updateTransaction(payload, ctx = {}) {
  const requestId = ctx.requestId;
  const id = Number(payload.row || payload.sheetRowNumber || payload.id || 0);
  if (!id) throw new Error('id inválido.');

  const date = toIsoFromFormDate(payload.data || payload.date);
  const type = String(payload.tipo || payload.type || '').trim();
  const reserve = String(payload.reserva || payload.reserve || '').trim();
  const account = String(payload.conta || payload.account || '').trim();
  const category = String(payload.categoria || payload.category || '').trim();
  const subcategory = String(payload.subcategoria || payload.subcategory || '').trim();
  const paymentMethod = String(payload.forma || payload.paymentMethod || '').trim();
  const status = String(payload.status || '').trim();
  const installment = String(payload.parcela || payload.installment || '').trim();
  const notes = String(payload.obs || payload.notes || '').trim();
  const name = String(payload.nome || payload.name || '').trim();
  const amount = parseMoneyBR(payload.valor !== undefined ? payload.valor : payload.amount);

  if (!date) throw new Error('Data inválida.');
  if (!type) throw new Error('Tipo obrigatório.');
  if (!account) throw new Error('Conta/Canal obrigatório.');
  if (type !== 'Saldo' && !name) throw new Error('Nome obrigatório.');
  if (!amount || amount <= 0) throw new Error('Valor inválido.');

  const categoryId = await ensureCategoryId(category);
  const subcategoryId = await ensureSubcategoryId(subcategory);

  await query(
    `update transactions
       set date=$2, name=$3, type=$4, reserve=$5, account=$6, category_id=$7, subcategory_id=$8, payment_method=$9,
           amount=$10, status=$11, installment=$12, notes=$13, updated_at=now()
     where id=$1`,
    [id, date, name, type, reserve, account, categoryId, subcategoryId, paymentMethod, amount, status, installment, notes]
  );

  logger.info('db_transaction_updated', { requestId, id, type });
  return { ok: true, row: id };
}
