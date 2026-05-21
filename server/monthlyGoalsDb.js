import { query } from './db.js';
import { parseMoneyBR } from './normalize.js';

function normalizeMonth(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  // aceita YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return '';
}

function normalizeValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = parseMoneyBR(value);
  return parsed == null || !Number.isFinite(parsed) ? null : parsed;
}

export async function listMonthlyGoals() {
  const { rows } = await query(
    'select month, value from monthly_goals order by month asc'
  );
  return rows.map((r) => ({ month: String(r.month), value: Number(r.value || 0) }));
}

export async function upsertMonthlyGoal({ month, value }) {
  const m = normalizeMonth(month);
  if (!m) throw new Error('Mês inválido. Use o formato YYYY-MM.');
  const v = normalizeValue(value);
  if (v == null || v < 0) throw new Error('Valor inválido.');

  const { rows } = await query(
    `insert into monthly_goals (month, value)
     values ($1, $2)
     on conflict (month) do update set value=excluded.value
     returning month, value`,
    [m, v]
  );
  return { month: String(rows[0].month), value: Number(rows[0].value || 0) };
}

export async function deleteMonthlyGoal(month) {
  const m = normalizeMonth(month);
  if (!m) throw new Error('Mês inválido. Use o formato YYYY-MM.');
  await query('delete from monthly_goals where month=$1', [m]);
  return { ok: true };
}

