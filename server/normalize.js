import { logger } from './logger.js';
export function normalizeStringKey(value = '') { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); }
const toIsoDate = (dateObj) => `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
function UtilitiesDisplay(d) { return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }
export function parseDateBR(value) { if (value == null || value === '') return null; if (value instanceof Date && !Number.isNaN(value.getTime())) return { date: toIsoDate(value), displayDate: UtilitiesDisplay(value) }; if (typeof value === 'number') { const d = new Date(Math.round((value - 25569) * 86400 * 1000)); if (Number.isNaN(d.getTime())) return null; return { date: toIsoDate(d), displayDate: UtilitiesDisplay(d) }; } const s = String(value).trim(); if (!s) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const d = new Date(`${s}T12:00:00Z`); if (Number.isNaN(d.getTime())) return null; return { date: s, displayDate: `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` }; } const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (br) { const [, dd, mm, yyyy] = br; const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`; return { date: iso, displayDate: `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}` }; } const parsed = new Date(s); if (Number.isNaN(parsed.getTime())) return null; return { date: toIsoDate(parsed), displayDate: UtilitiesDisplay(parsed) }; }
export function parseMoneyBR(value) { if (typeof value === 'number') return Number.isFinite(value) ? value : null; if (value == null) return null; const num = Number(String(value).trim().replace(/\s|R\$/gi, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(num) ? num : null; }
const getField = (row, variants) => variants.find((key) => row[key] !== undefined && row[key] !== null) ? row[variants.find((key) => row[key] !== undefined && row[key] !== null)] : '';
export function normalizeTransactions(rows = [], context = {}) {
  const fieldsDetected = new Set();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => fieldsDetected.add(k)));
  const normalized = rows
    .map((raw, index) => {
      const parsedDate = parseDateBR(getField(raw, ['Data', 'data']));
      const parsedAmount = parseMoneyBR(getField(raw, ['Valor', 'valor', 'amount']));
      const type = String(getField(raw, ['Tipo', 'tipo', 'type']) || '').trim();
      const reserve = String(getField(raw, ['Reserva', 'reserva', 'reserve']) || '').trim();
      const account = String(getField(raw, ['Conta/Canal', 'conta', 'account']) || '').trim();
      const category = String(getField(raw, ['Categoria', 'categoria', 'category']) || '').trim();

      // Importante: a UI assume `amount` positivo e decide o sinal pelo tipo.
      // Se a planilha tiver valores negativos (entradas antigas/manuais), normalizamos para absoluto.
      const amount = parsedAmount == null ? NaN : Math.abs(parsedAmount);

      let name = String(getField(raw, ['Nome', 'nome', 'name']) || '').trim();
      if (!name) {
        if (normalizeStringKey(type) === 'saldo' && account) name = `Saldo ${account}`;
        else name = 'Sem nome';
      }

      return {
        sheetRowNumber: Number(raw.sheetRowNumber) || index + 2,
        date: parsedDate?.date || '',
        displayDate: parsedDate?.displayDate || '',
        name,
        type,
        reserve,
        reserveKey: normalizeStringKey(reserve),
        account,
        category,
        subcategory: String(getField(raw, ['Subcategoria', 'subcategoria', 'subcategory']) || '').trim(),
        paymentMethod: String(getField(raw, ['Forma', 'forma', 'paymentMethod']) || '').trim(),
        amount,
        status: String(getField(raw, ['Status', 'status']) || '').trim(),
        installment: String(getField(raw, ['Parcela', 'parcela', 'installment']) || '').trim(),
        notes: String(getField(raw, ['Obs', 'obs', 'notes']) || '').trim(),
      };
    })
    .filter((t) => t.date && t.type && Number.isFinite(t.amount) && t.amount > 0);
  logger.debug('normalize_transactions_completed', { requestId: context.requestId, inputCount: rows.length, outputCount: normalized.length, fieldsDetected: [...fieldsDetected].slice(0, 30) });
  return normalized;
}
