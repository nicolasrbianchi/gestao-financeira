const excelToDate = (v) => {
  if (!v) return null;

  // Excel serial date
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }

  const s = String(v);

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // dd/mm/yyyy
  const p = s.split('/');
  if (p.length === 3) {
    return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }

  return null;
};

export const parseMoney = (value) =>
  Number(String(value ?? '0').replace(/\s|R\$/g, '').replace(/\./g, '').replace(',', '.')) || 0;

export function normalizeTransactions(rows = []) {
  return rows
    .map((r, i) => ({
      sheetRowNumber: r.sheetRowNumber || i + 2,
      date: excelToDate(r.Data || r.data),
      name: r.Nome || r.nome || '',
      type: r.Tipo || r.tipo || '',
      reserve: r.Reserva || r.reserva || '',
      account: r['Conta/Canal'] || r.conta || '',
      category: r.Categoria || r.categoria || '',
      subcategory: r.Subcategoria || r.subcategoria || '',
      paymentMethod: r.Forma || r.forma || '',
      amount: parseMoney(r.Valor || r.valor),
      status: r.Status || r.status || '',
      installment: r.Parcela || r.parcela || '',
      notes: r.Obs || r.obs || '',
    }))
    .filter((t) => t.date && t.name && t.amount > 0);
}
