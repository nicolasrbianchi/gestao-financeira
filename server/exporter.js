import { config } from './config.js';
import * as client from './dataClient.js';
import { query } from './db.js';

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

  // Extras (DB only): configurações e inbox para restaurar/BI.
  const dataSource = String(config.dataSource || 'appsScript').toLowerCase();
  let importInbox = [];
  let pluggyItems = [];
  let monthlyGoals = [];
  let categories = [];
  let subcategories = [];
  let accounts = [];
  if (dataSource === 'db') {
    const [inboxRows, pluggyRows, goalsRows, categoriesRows, subcategoriesRows, accountsRows] = await Promise.all([
      query(
        `select id, provider, external_id, occurred_at, description, account_hint, amount, currency, status, approved_transaction_id, raw, created_at, updated_at
           from import_inbox
          order by occurred_at desc nulls last, id desc`
      ).catch(() => ({ rows: [] })),
      query(
        `select id, item_id::text as item_id, client_user_id, enabled, ignore_before, last_webhook_at, last_sync_at, last_fetch_at, created_at, updated_at
           from pluggy_items
          order by id desc`
      ).catch(() => ({ rows: [] })),
      query('select month, value from monthly_goals order by month asc').catch(() => ({ rows: [] })),
      query('select id, name, is_active, created_at, updated_at from categories order by lower(name) asc').catch(() => ({ rows: [] })),
      query('select id, name, is_active, created_at, updated_at from subcategories order by lower(name) asc').catch(() => ({ rows: [] })),
      query('select id, name, is_active, created_at, updated_at from accounts order by lower(name) asc').catch(() => ({ rows: [] })),
    ]);

    importInbox = (inboxRows.rows || []).map((r) => ({
      id: Number(r.id),
      provider: String(r.provider || ''),
      externalId: String(r.external_id || ''),
      occurredAt: r.occurred_at ? new Date(r.occurred_at).toISOString() : null,
      description: String(r.description || ''),
      accountHint: String(r.account_hint || ''),
      amount: Number(r.amount || 0),
      currency: String(r.currency || 'BRL'),
      status: String(r.status || 'pending'),
      approvedTransactionId: r.approved_transaction_id != null ? Number(r.approved_transaction_id) : null,
      raw: r.raw || {},
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    }));

    pluggyItems = (pluggyRows.rows || []).map((r) => ({
      id: Number(r.id),
      itemId: String(r.item_id),
      clientUserId: String(r.client_user_id || ''),
      enabled: !!r.enabled,
      ignoreBefore: r.ignore_before ? new Date(r.ignore_before).toISOString() : null,
      lastWebhookAt: r.last_webhook_at ? new Date(r.last_webhook_at).toISOString() : null,
      lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null,
      lastFetchAt: r.last_fetch_at ? new Date(r.last_fetch_at).toISOString() : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    }));

    monthlyGoals = (goalsRows.rows || []).map((r) => ({ month: String(r.month), value: Number(r.value || 0) }));
    categories = (categoriesRows.rows || []).map((r) => ({ id: Number(r.id), name: String(r.name), isActive: !!r.is_active, createdAt: r.created_at ? new Date(r.created_at).toISOString() : null, updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null }));
    subcategories = (subcategoriesRows.rows || []).map((r) => ({ id: Number(r.id), name: String(r.name), isActive: !!r.is_active, createdAt: r.created_at ? new Date(r.created_at).toISOString() : null, updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null }));
    accounts = (accountsRows.rows || []).map((r) => ({ id: Number(r.id), name: String(r.name), isActive: !!r.is_active, createdAt: r.created_at ? new Date(r.created_at).toISOString() : null, updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null }));
  }

  return {
    ok: true,
    exportedAt: new Date().toISOString(),
    dataSource: String(config.dataSource || 'appsScript'),
    metadata,
    transactions: tx.transactions || [],
    importInbox,
    pluggyItems,
    monthlyGoals,
    categories,
    subcategories,
    accounts,
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

export async function buildInboxCsv(ctx = {}) {
  const dataSource = String(config.dataSource || 'appsScript').toLowerCase();
  if (dataSource !== 'db') return 'id,provider,externalId,status\n';

  const { rows } = await query(
    `select id, provider, external_id, status, occurred_at, description, account_hint, amount, currency, approved_transaction_id
       from import_inbox
      order by occurred_at desc nulls last, id desc`
  );

  const header = [
    'id',
    'provider',
    'externalId',
    'status',
    'occurredAt',
    'description',
    'accountHint',
    'amount',
    'currency',
    'approvedTransactionId',
  ];

  const lines = [header.join(',')];
  for (const r of rows) {
    const line = [
      Number(r.id),
      String(r.provider || ''),
      String(r.external_id || ''),
      String(r.status || ''),
      r.occurred_at ? new Date(r.occurred_at).toISOString() : '',
      String(r.description || ''),
      String(r.account_hint || ''),
      r.amount ?? '',
      String(r.currency || 'BRL'),
      r.approved_transaction_id ?? '',
    ].map(csvEscape).join(',');
    lines.push(line);
  }

  return lines.join('\n');
}
