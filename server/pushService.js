import webpush from 'web-push';
import { logger } from './logger.js';
import { listSubscriptions, deleteSubscription } from './pushDb.js';

function requireEnv(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new Error(`${name} não configurado.`);
  return v;
}

let configured = false;
function configure() {
  if (configured) return;
  const subject = String(process.env.WEB_PUSH_SUBJECT || 'mailto:push@nicco.local').trim();
  const publicKey = requireEnv('WEB_PUSH_PUBLIC_KEY');
  const privateKey = requireEnv('WEB_PUSH_PRIVATE_KEY');
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// Anti-spam simples (por instância)
const lastSentAtByKey = new Map();
function allowSend(key, cooldownMs = 2 * 60 * 1000) {
  const now = Date.now();
  const last = lastSentAtByKey.get(key) || 0;
  if (last && now - last < cooldownMs) return false;
  lastSentAtByKey.set(key, now);
  return true;
}

export async function sendPushToAll({ title, body, url = '/', tag = 'nicco', badge = null, requestId } = {}) {
  configure();

  const payload = {
    title: String(title || 'Nicco Finance'),
    body: String(body || ''),
    url: String(url || '/'),
    tag: String(tag || 'nicco'),
    // badge: number (best-effort) — usado pelo Service Worker para atualizar o ícone
    badge: Number.isFinite(Number(badge)) ? Number(badge) : undefined,
    sentAt: new Date().toISOString(),
  };

  const subs = await listSubscriptions({ limit: 300 });
  if (!subs.length) return { ok: true, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify(payload));
        sent += 1;
      } catch (e) {
        failed += 1;
        const statusCode = e?.statusCode || e?.status || null;
        logger.warn('push_send_failed', { requestId, endpoint: s.endpoint, statusCode, error: e?.message || String(e) });
        // subscription expirada/inválida
        if (statusCode === 404 || statusCode === 410) {
          try { await deleteSubscription({ endpoint: s.endpoint, requestId }); } catch {}
        }
      }
    })
  );

  logger.info('push_broadcast_finished', { requestId, sent, failed });
  return { ok: true, sent, failed };
}

export async function maybeSendPush({ key, cooldownMs, title, body, url, tag, badge, requestId } = {}) {
  try {
    if (!allowSend(String(key || 'default'), Number(cooldownMs) || 2 * 60 * 1000)) return { ok: true, skipped: true };
    return await sendPushToAll({ title, body, url, tag, badge, requestId });
  } catch (e) {
    logger.warn('push_broadcast_skipped', { requestId, error: e?.message || String(e) });
    return { ok: false, error: e?.message || String(e) };
  }
}
