const OFFLINE_QUEUE_KEY = 'gf_offline_queue_v1';

function loadQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveQueue(items) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    // ignore
  }
}

function isOnline() {
  try { return navigator.onLine !== false; } catch { return true; }
}

function shouldQueue(path, method) {
  const m = String(method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD') return false;
  // Por enquanto, só garantimos offline-queue para Transações.
  return String(path || '').startsWith('/transactions');
}

function enqueueOffline(path, opts) {
  const method = String(opts?.method || 'POST').toUpperCase();
  const body = opts?.body ?? null;

  const item = {
    id: `${Date.now()}:${Math.random().toString(16).slice(2)}`,
    at: Date.now(),
    path,
    method,
    body,
  };

  const q = loadQueue();

  // dedupe simples: última escrita vence para o mesmo path (ex: PUT /transactions/:id)
  const dedup = q.filter((it) => !(it?.path === path && it?.method === method));
  saveQueue([...dedup, item]);

  try { window.dispatchEvent(new Event('gf_offline_queue_changed')); } catch { /* ignore */ }
  return item;
}

async function apiFetch(path, opts = {}) {
  const r = await fetch(`/api${path}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const text = await r.text();
  let d = {};
  try {
    d = text ? JSON.parse(text) : {};
  } catch {
    d = { ok: false, error: 'Resposta inválida da API (não-JSON).', _raw: text?.slice?.(0, 300) };
  }
  if (!r.ok) {
    const code = d.requestId ? ` Código: ${d.requestId}` : '';
    throw new Error(`${d.error || 'Erro na API'}${code}`);
  }
  return d;
}

export async function api(path, opts = {}) {
  const method = String(opts?.method || 'GET').toUpperCase();

  // Se for mutação de transações e estiver offline, enfileira.
  if (!isOnline() && shouldQueue(path, method)) {
    enqueueOffline(path, opts);
    return { ok: true, queued: true };
  }

  try {
    return await apiFetch(path, opts);
  } catch (err) {
    // Network error: enfileira e deixa seguir (não perde a ação).
    const msg = String(err?.message || '');
    const network = msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch');
    if (network && shouldQueue(path, method)) {
      enqueueOffline(path, opts);
      return { ok: true, queued: true };
    }
    throw err;
  }
}

export async function flushOfflineQueue() {
  if (!isOnline()) return { processed: 0, remaining: loadQueue().length, ok: false };
  const q = loadQueue();
  if (!q.length) return { processed: 0, remaining: 0, ok: true };

  let processed = 0;
  const keep = [];

  for (const item of q) {
    try {
      await apiFetch(item.path, {
        method: item.method,
        body: item.body ?? undefined,
      });
      processed += 1;
    } catch {
      // se falhar, mantém a fila a partir daqui (evita reorder e loops)
      keep.push(item);
    }
  }

  saveQueue(keep);
  try { window.dispatchEvent(new Event('gf_offline_queue_flushed')); } catch { /* ignore */ }
  return { processed, remaining: keep.length, ok: keep.length === 0 };
}
export const withQuery = (path, params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  return `${path}?${q.toString()}`;
};
