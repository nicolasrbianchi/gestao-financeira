import { query } from './db.js';
import { logger } from './logger.js';

export async function upsertPluggyItem({ itemId, clientUserId = '', ignoreBefore = null, requestId } = {}) {
  if (!itemId) throw new Error('itemId obrigatório.');
  const ignore = ignoreBefore ? new Date(ignoreBefore) : new Date();
  if (Number.isNaN(ignore.getTime())) throw new Error('ignoreBefore inválido.');

  const { rows } = await query(
    `insert into pluggy_items (item_id, client_user_id, ignore_before, enabled)
     values ($1::uuid, $2, $3::timestamptz, true)
     on conflict (item_id) do update
       set client_user_id = excluded.client_user_id,
           updated_at = now()
     returning id, item_id, ignore_before, enabled, created_at, updated_at`,
    [String(itemId), String(clientUserId || ''), ignore.toISOString()]
  );

  const r = rows[0];
  logger.info('pluggy_item_upserted', { requestId, itemId: String(itemId) });
  return {
    id: Number(r.id),
    itemId: String(r.item_id),
    ignoreBefore: new Date(r.ignore_before).toISOString(),
    enabled: !!r.enabled,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

export async function setPluggyItemIgnoreBefore({ itemId, ignoreBefore, requestId } = {}) {
  if (!itemId) throw new Error('itemId obrigatório.');
  const d = new Date(ignoreBefore);
  if (Number.isNaN(d.getTime())) throw new Error('ignoreBefore inválido.');
  const { rowCount } = await query(
    `update pluggy_items set ignore_before=$2::timestamptz, updated_at=now() where item_id=$1::uuid`,
    [String(itemId), d.toISOString()]
  );
  if (!rowCount) throw new Error('Item não encontrado.');
  logger.info('pluggy_item_ignore_before_updated', { requestId, itemId: String(itemId) });
  return { ok: true };
}

export async function listPluggyItems({ requestId } = {}) {
  const { rows } = await query(
    `select id, item_id, client_user_id, enabled, ignore_before, last_webhook_at, last_sync_at, created_at, updated_at
       from pluggy_items
      order by id desc`
  );
  logger.debug('pluggy_items_listed', { requestId, count: rows.length });
  return rows.map((r) => ({
    id: Number(r.id),
    itemId: String(r.item_id),
    clientUserId: String(r.client_user_id || ''),
    enabled: !!r.enabled,
    ignoreBefore: r.ignore_before ? new Date(r.ignore_before).toISOString() : null,
    lastWebhookAt: r.last_webhook_at ? new Date(r.last_webhook_at).toISOString() : null,
    lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  }));
}

export async function touchPluggyItemWebhook({ itemId, requestId } = {}) {
  if (!itemId) return;
  await query(`update pluggy_items set last_webhook_at=now(), updated_at=now() where item_id=$1::uuid`, [String(itemId)]);
  logger.debug('pluggy_item_webhook_touched', { requestId, itemId: String(itemId) });
}

export async function touchPluggyItemSync({ itemId, requestId } = {}) {
  if (!itemId) return;
  await query(`update pluggy_items set last_sync_at=now(), updated_at=now() where item_id=$1::uuid`, [String(itemId)]);
  logger.debug('pluggy_item_sync_touched', { requestId, itemId: String(itemId) });
}

export async function getPluggyItem({ itemId } = {}) {
  if (!itemId) throw new Error('itemId obrigatório.');
  const { rows } = await query(
    `select id, item_id, client_user_id, enabled, ignore_before, last_webhook_at, last_sync_at
       from pluggy_items
      where item_id=$1::uuid
      limit 1`,
    [String(itemId)]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    itemId: String(r.item_id),
    clientUserId: String(r.client_user_id || ''),
    enabled: !!r.enabled,
    ignoreBefore: r.ignore_before ? new Date(r.ignore_before).toISOString() : null,
    lastWebhookAt: r.last_webhook_at ? new Date(r.last_webhook_at).toISOString() : null,
    lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null,
  };
}

export async function insertImportsFromPluggy({ requestId, itemId, accountHint = '', transactions = [], ignoreBefore = null } = {}) {
  const ignore = ignoreBefore ? new Date(ignoreBefore) : null;
  const ignoreMs = ignore && !Number.isNaN(ignore.getTime()) ? ignore.getTime() : null;

  let inserted = 0;
  for (const t of transactions) {
    const externalId = String(t?.id || '').trim();
    if (!externalId) continue;

    const occurredAt = t?.date ? new Date(t.date) : null;
    if (occurredAt && Number.isNaN(occurredAt.getTime())) continue;
    if (ignoreMs && occurredAt && occurredAt.getTime() < ignoreMs) continue;

    const description = String(t?.description || t?.descriptionRaw || '').trim();
    const currency = String(t?.currencyCode || 'BRL').trim() || 'BRL';
    const amountNum = Number(t?.amount || 0);
    const amount = Math.abs(amountNum || 0);

    const raw = {
      provider: 'pluggy',
      itemId: itemId || null,
      accountId: t?.accountId || null,
      transaction: t,
    };

    const { rowCount } = await query(
      `insert into import_inbox (provider, external_id, occurred_at, description, account_hint, amount, currency, raw, status)
       values ('pluggy', $1, $2, $3, $4, $5, $6, $7::jsonb, 'pending')
       on conflict (provider, external_id) do nothing`,
      [
        externalId,
        occurredAt ? occurredAt.toISOString() : null,
        description,
        String(accountHint || ''),
        amount,
        currency,
        JSON.stringify(raw),
      ]
    );
    inserted += rowCount ? 1 : 0;
  }

  logger.info('pluggy_imports_inserted', { requestId, itemId: itemId || null, inserted, seen: transactions.length });
  return { inserted, seen: transactions.length };
}

