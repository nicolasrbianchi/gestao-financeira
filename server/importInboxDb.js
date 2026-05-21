import { query } from './db.js';
import { logger } from './logger.js';

export async function listPendingImports(ctx = {}) {
  const requestId = ctx.requestId;
  const { rows } = await query(
    `select id, provider, external_id, occurred_at, description, account_hint, amount, currency, status, created_at
       from import_inbox
      where status='pending'
      order by occurred_at desc nulls last, id desc`
  );
  logger.debug('import_inbox_listed', { requestId, count: rows.length });
  return rows.map((r) => ({
    id: Number(r.id),
    provider: String(r.provider),
    externalId: String(r.external_id),
    occurredAt: r.occurred_at ? new Date(r.occurred_at).toISOString() : null,
    description: String(r.description || ''),
    accountHint: String(r.account_hint || ''),
    amount: Number(r.amount || 0),
    currency: String(r.currency || 'BRL'),
    status: String(r.status || 'pending'),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }));
}

export async function rejectImport(id, ctx = {}) {
  const requestId = ctx.requestId;
  const importId = Number(id || 0);
  if (!importId) throw new Error('id inválido.');
  const { rowCount } = await query(
    `update import_inbox set status='rejected', updated_at=now() where id=$1 and status='pending'`,
    [importId]
  );
  if (!rowCount) throw new Error('Import não encontrado (ou já processado).');
  logger.info('import_inbox_rejected', { requestId, id: importId });
  return { ok: true, id: importId };
}

export async function approveImport(id, transactionId, ctx = {}) {
  const requestId = ctx.requestId;
  const importId = Number(id || 0);
  const txId = Number(transactionId || 0);
  if (!importId) throw new Error('id inválido.');
  if (!txId) throw new Error('transactionId inválido.');

  const { rowCount } = await query(
    `update import_inbox
        set status='approved', approved_transaction_id=$2, updated_at=now()
      where id=$1 and status='pending'`,
    [importId, txId]
  );
  if (!rowCount) throw new Error('Import não encontrado (ou já processado).');
  logger.info('import_inbox_approved', { requestId, id: importId, transactionId: txId });
  return { ok: true, id: importId, transactionId: txId };
}

