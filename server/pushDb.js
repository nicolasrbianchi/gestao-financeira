import { query } from './db.js';
import { logger } from './logger.js';

export async function upsertSubscription({ subscription, userAgent = '', requestId } = {}) {
  const endpoint = String(subscription?.endpoint || '').trim();
  if (!endpoint) throw new Error('subscription.endpoint obrigatório.');

  const { rows } = await query(
    `insert into push_subscriptions (endpoint, subscription, user_agent)
     values ($1, $2::jsonb, $3)
     on conflict (endpoint) do update
       set subscription=excluded.subscription,
           user_agent=excluded.user_agent,
           updated_at=now()
     returning id, endpoint, created_at, updated_at`,
    [endpoint, JSON.stringify(subscription || {}), String(userAgent || '')]
  );

  logger.info('push_subscription_upserted', { requestId, endpoint });
  const r = rows[0];
  return { id: Number(r.id), endpoint: String(r.endpoint), createdAt: r.created_at, updatedAt: r.updated_at };
}

export async function deleteSubscription({ endpoint, requestId } = {}) {
  const e = String(endpoint || '').trim();
  if (!e) return { ok: true, deleted: 0 };
  const { rowCount } = await query(`delete from push_subscriptions where endpoint=$1`, [e]);
  logger.info('push_subscription_deleted', { requestId, endpoint: e, deleted: rowCount || 0 });
  return { ok: true, deleted: rowCount || 0 };
}

export async function listSubscriptions({ limit = 200 } = {}) {
  const lim = Number(limit) || 200;
  const { rows } = await query(
    `select id, endpoint, subscription
       from push_subscriptions
      order by updated_at desc
      limit $1`,
    [lim]
  );
  return rows.map((r) => ({ id: Number(r.id), endpoint: String(r.endpoint), subscription: r.subscription }));
}

