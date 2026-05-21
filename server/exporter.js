import { config } from './config.js';
import * as client from './dataClient.js';

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/["\n,;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildExportPayload(ctx = {}) {
  const [metadata, tx] = await Promise.all([
    client.getMetadata(ctx).catch(() => ({})),
    client.getTransactions(ctx).catch(() => ({ transactions: [] })),
  ]);

  return {
    ok: true,
    exportedAt: new Date().toISOString(),
    dataSource: String(config.dataSource || 'appsScript'),
    metadata,
    transactions: tx.transactions || [],
  };
}

export async function buildTransactionsCsv(ctx = {}) {
  const tx = await client.getTransactions(ctx);
  const rows = Array.isArray(tx?.transactions) ? tx.transactions : [];

  const header = [
    'id',
    'date',
    'name',
    'type',
    'reserve',
    'account',
    'category',
    'subcategory',
    'paymentMethod',
    'amount',
    'status',
    'installment',
    'notes',
  ];

  const lines = [header.join(',')];
  for (const t of rows) {
    const id = t.id ?? t.sheetRowNumber ?? t.row ?? '';
    const line = [
      id,
      t.date || '',
      t.name || '',
      t.type || '',
      t.reserve || '',
      t.account || '',
      t.category || '',
      t.subcategory || '',
      t.paymentMethod || '',
      t.amount ?? '',
      t.status || '',
      t.installment || '',
      t.notes || '',
    ].map(csvEscape).join(',');
    lines.push(line);
  }

  return lines.join('\n');
}

