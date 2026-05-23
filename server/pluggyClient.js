import { logger } from './logger.js';

const API_BASE = 'https://api.pluggy.ai';

let apiKeyCache = {
  key: null,
  expiresAtMs: 0,
};

function nowMs() {
  return Date.now();
}

function requireEnv(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new Error(`${name} não configurado.`);
  return v;
}

export async function getApiKey({ requestId } = {}) {
  const bufferMs = 2 * 60 * 1000;
  if (apiKeyCache.key && apiKeyCache.expiresAtMs - bufferMs > nowMs()) return apiKeyCache.key;

  const clientId = requireEnv('PLUGGY_CLIENT_ID');
  const clientSecret = requireEnv('PLUGGY_CLIENT_SECRET');

  const res = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn('pluggy_auth_failed', { requestId, status: res.status, body: text?.slice?.(0, 500) });
    throw new Error('Falha ao autenticar no Pluggy.');
  }

  const data = await res.json();
  const apiKey = String(data?.apiKey || data?.accessToken || '').trim();
  if (!apiKey) throw new Error('Pluggy auth sem apiKey.');

  apiKeyCache = {
    key: apiKey,
    // docs: expira em ~2h
    expiresAtMs: nowMs() + 2 * 60 * 60 * 1000,
  };

  return apiKey;
}

async function pluggyFetch(pathOrUrl, { requestId, method = 'GET', body } = {}) {
  const apiKey = await getApiKey({ requestId });
  const url = String(pathOrUrl).startsWith('http') ? String(pathOrUrl) : `${API_BASE}${pathOrUrl}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn('pluggy_request_failed', { requestId, url, method, status: res.status, body: text?.slice?.(0, 500) });
    throw new Error('Falha ao consultar Pluggy.');
  }

  return res.json();
}

export async function getItem({ requestId, itemId } = {}) {
  if (!itemId) throw new Error('itemId obrigatório.');
  const data = await pluggyFetch(`/items/${encodeURIComponent(String(itemId))}`, { requestId, method: 'GET' });
  return data;
}

export async function createConnectToken({ requestId, options = {} } = {}) {
  const payload = { ...options };
  const data = await pluggyFetch('/connect_token', { requestId, method: 'POST', body: payload });
  const token = String(data?.accessToken || data?.connectToken || '').trim();
  if (!token) throw new Error('Falha ao criar connect token.');
  return token;
}

export async function listAccounts({ requestId, itemId }) {
  if (!itemId) throw new Error('itemId obrigatório.');
  const qs = new URLSearchParams({ itemId: String(itemId) });
  const data = await pluggyFetch(`/accounts?${qs.toString()}`, { requestId });
  // normalmente vem como array ou { results }
  const results = Array.isArray(data) ? data : (data?.results || []);
  return results;
}

export async function listTransactionsByUrl({ requestId, url }) {
  if (!url) throw new Error('url obrigatório.');
  // Segurança básica: só aceita api.pluggy.ai
  const u = new URL(url);
  if (u.hostname !== 'api.pluggy.ai') throw new Error('URL inválida.');

  const out = [];
  let nextUrl = u.toString();
  let safety = 0;
  while (nextUrl && safety < 100) {
    safety += 1;
    const data = await pluggyFetch(nextUrl, { requestId });
    const results = Array.isArray(data) ? data : (data?.results || []);
    out.push(...results);

    const next = String(data?.next || '').trim();
    if (!next) break;
    // next vem como query string (ex: ?accountId=...&after=...)
    nextUrl = next.startsWith('http') ? next : `${API_BASE}/transactions${next}`;
  }

  return out;
}

export async function listTransactionsByAccount({ requestId, accountId, createdAtFrom } = {}) {
  if (!accountId) throw new Error('accountId obrigatório.');
  const baseQs = new URLSearchParams({ accountId: String(accountId) });
  if (createdAtFrom) baseQs.set('createdAtFrom', String(createdAtFrom));

  const out = [];
  let nextUrl = `${API_BASE}/v2/transactions?${baseQs.toString()}`;
  let safety = 0;
  while (nextUrl && safety < 200) {
    safety += 1;
    const data = await pluggyFetch(nextUrl, { requestId });
    const results = Array.isArray(data) ? data : (data?.results || []);
    out.push(...results);

    const next = String(data?.next || '').trim();
    if (!next) break;
    // next vem como query string (ex: ?accountId=...&after=...)
    // Importante: o `next` pode não preservar filtros (ex: createdAtFrom), então re-anexamos.
    const u = next.startsWith('http') ? new URL(next) : new URL(`${API_BASE}/v2/transactions${next}`);
    if (createdAtFrom && !u.searchParams.has('createdAtFrom')) u.searchParams.set('createdAtFrom', String(createdAtFrom));
    nextUrl = u.toString();
  }

  return out;
}

export async function listTransactionsByIds({ requestId, ids = [] } = {}) {
  const clean = ids.map((x) => String(x).trim()).filter(Boolean);
  if (!clean.length) return [];
  // /transactions aceita ids (docs: recomendado p/ updated)
  const qs = new URLSearchParams();
  for (const id of clean.slice(0, 500)) qs.append('ids', id);
  const data = await pluggyFetch(`/transactions?${qs.toString()}`, { requestId });
  const results = Array.isArray(data) ? data : (data?.results || []);
  return results;
}

export async function updateItem({ requestId, itemId, credentials } = {}) {
  if (!itemId) throw new Error('itemId obrigatório.');
  // PATCH /items/{id} dispara uma nova sincronização; credentials é opcional.
  const body = credentials && typeof credentials === 'object' ? credentials : {};
  const data = await pluggyFetch(`/items/${encodeURIComponent(String(itemId))}`, { requestId, method: 'PATCH', body });
  return data;
}
