export function normalizeStringKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const toIsoDate = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export function parseDateBR(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { date: toIsoDate(value), displayDate: UtilitiesDisplay(value) };
  }

  if (typeof value === 'number') {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (Number.isNaN(d.getTime())) return null;
    return { date: toIsoDate(d), displayDate: UtilitiesDisplay(d) };
  }

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    return { date: s, displayDate: `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` };
  }

  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    return { date: iso, displayDate: `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}` };
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return { date: toIsoDate(parsed), displayDate: UtilitiesDisplay(parsed) };
}

function UtilitiesDisplay(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function parseMoneyBR(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const cleaned = raw.replace(/\s|R\$/gi, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

const getField = (row, variants) => {
  for (const key of variants) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return '';
};

export function normalizeTransactions(rows = []) {
  return rows
    .map((raw, index) => {
      const parsedDate = parseDateBR(getField(raw, ['Data', 'data']));
      const amount = parseMoneyBR(getField(raw, ['Valor', 'valor', 'amount']));
      const name = String(getField(raw, ['Nome', 'nome', 'name']) || '').trim();
      const type = String(getField(raw, ['Tipo', 'tipo', 'type']) || '').trim();

      const reserve = String(getField(raw, ['Reserva', 'reserva', 'reserve']) || '').trim();

      return {
        sheetRowNumber: Number(raw.sheetRowNumber) || index + 2,
        date: parsedDate?.date || '',
        displayDate: parsedDate?.displayDate || '',
        name,
        type,
        reserve,
        reserveKey: normalizeStringKey(reserve),
        account: String(getField(raw, ['Conta/Canal', 'conta', 'account']) || '').trim(),
        category: String(getField(raw, ['Categoria', 'categoria', 'category']) || '').trim(),
        subcategory: String(getField(raw, ['Subcategoria', 'subcategoria', 'subcategory']) || '').trim(),
        paymentMethod: String(getField(raw, ['Forma', 'forma', 'paymentMethod']) || '').trim(),
        amount: amount ?? NaN,
        status: String(getField(raw, ['Status', 'status']) || '').trim(),
        installment: String(getField(raw, ['Parcela', 'parcela', 'installment']) || '').trim(),
        notes: String(getField(raw, ['Obs', 'obs', 'notes']) || '').trim(),
        raw,
      };
    })
    .filter((t) => t.date && t.name && t.type && Number.isFinite(t.amount));
}
