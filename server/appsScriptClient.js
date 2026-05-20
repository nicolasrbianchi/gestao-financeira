import { config } from './config.js';
import { logger } from './logger.js';

const shouldUseMock = !config.isProd && config.useMockData;
let lastAppsScriptCall = null;

// Cache in-memory (zero-cost) para reduzir latência do Apps Script.
// - Útil porque o Apps Script é o gargalo e as telas fazem leituras repetidas.
// - TTL curto para não ficar "desatualizado" por muito tempo.
const CACHE_TTL_MS = Number(process.env.APPS_SCRIPT_CACHE_TTL_MS || 45_000);
const cache = {
  transactions: { value: null, at: 0, inFlight: null },
  metadata: { value: null, at: 0, inFlight: null },
};

function isFresh(entry) {
  if (!CACHE_TTL_MS) return false;
  return entry.value && Date.now() - entry.at < CACHE_TTL_MS;
}

async function cachedCall(cacheKey, loader, context = {}) {
  const entry = cache[cacheKey];
  const force = context?.force === true || context?.noCache === true;
  if (!force && isFresh(entry)) {
    logger.debug('apps_script_cache_hit', { requestId: context.requestId, cacheKey, ageMs: Date.now() - entry.at });
    return entry.value;
  }

  if (!force && entry.inFlight) {
    logger.debug('apps_script_cache_join', { requestId: context.requestId, cacheKey });
    return entry.inFlight;
  }

  entry.inFlight = (async () => {
    try {
      const value = await loader();
      entry.value = value;
      entry.at = Date.now();
      return value;
    } finally {
      entry.inFlight = null;
    }
  })();

  return entry.inFlight;
}

const mockResponse = (action) => {
  if (action === 'health') return { ok: true, mock: true, timestamp: new Date().toISOString() };
  if (action === 'metadata') return { ok: true, types: ['Receita', 'Despesa', 'Reserva', 'Saldo'], reserves: ['Entrada', 'Saida'], accounts: [], categories: ['Transferencia entre contas'], subcategories: ['Essencial', 'Extra'], paymentMethods: ['Débito', 'Crédito', 'Pix', 'Boleto', 'Depósito'], statuses: [], monthlyGoals: {} };
  if (action === 'transactions') return { ok: true, transactions: [] };
  if (action === 'add') return { ok: true, mock: true };
  return { ok: true, mock: true };
};

export async function callAppsScript(action, params = {}, context = {}) {
  const start = Date.now();
  const requestId = context.requestId;
  if (shouldUseMock) {
    const data = mockResponse(action);
    lastAppsScriptCall = { action, ok: true, durationMs: Date.now() - start, at: new Date().toISOString() };
    logger.debug('apps_script_call_completed', { requestId, action, durationMs: lastAppsScriptCall.durationMs, ok: true, mock: true });
    return data;
  }

  if (!config.appsScriptUrl) throw new Error(config.isProd ? 'APPS_SCRIPT_URL ausente em produção.' : 'APPS_SCRIPT_URL não configurada.');

  const url = new URL(config.appsScriptUrl);
  url.searchParams.set('action', action);
  url.searchParams.set('token', config.appsScriptToken || '');
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && url.searchParams.set(k, String(v)));

  logger.debug('apps_script_call_started', { requestId, action, paramKeys: Object.keys(params || {}) });

  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) throw new Error(`Apps Script respondeu HTTP ${response.status}.`);
    const data = await response.json();
    if (data?.ok === false) throw new Error(data.error || 'Erro retornado pelo Apps Script.');

    const durationMs = Date.now() - start;
    const transactionCount = Array.isArray(data?.transactions) ? data.transactions.length : undefined;
    lastAppsScriptCall = { action, ok: true, durationMs, at: new Date().toISOString(), transactionCount };
    logger.debug('apps_script_call_completed', { requestId, action, durationMs, ok: true, transactionCount, responseKeys: Object.keys(data || {}) });
    return data;
  } catch (error) {
    const durationMs = Date.now() - start;
    lastAppsScriptCall = { action, ok: false, durationMs, at: new Date().toISOString() };
    logger.error('apps_script_call_failed', { requestId, action, durationMs, error: error.message });
    throw error.message.includes('Apps Script') ? error : new Error('Falha de rede ao chamar Apps Script.');
  }
}

export async function getTransactions(ctx = {}) {
  return cachedCall('transactions', () => callAppsScript('transactions', {}, ctx), ctx);
}

export async function getMetadata(ctx = {}) {
  return cachedCall('metadata', () => callAppsScript('metadata', {}, ctx), ctx);
}

export const addTransaction = (payload, ctx) => callAppsScript('add', payload, { ...(ctx || {}), force: true });
export const health = (ctx) => callAppsScript('health', {}, { ...(ctx || {}), force: true });
export const getLastAppsScriptCall = () => lastAppsScriptCall;
