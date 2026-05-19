import { config } from './config.js';
import { logger } from './logger.js';

const shouldUseMock = !config.isProd && config.useMockData;
let lastAppsScriptCall = null;

const mockResponse = (action) => {
  if (action === 'health') return { ok: true, mock: true, timestamp: new Date().toISOString() };
  if (action === 'metadata') return { ok: true, types: [], reserves: [], accounts: [], categories: [], subcategories: [], paymentMethods: [], statuses: [] };
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

export const getTransactions = (ctx) => callAppsScript('transactions', {}, ctx);
export const getMetadata = (ctx) => callAppsScript('metadata', {}, ctx);
export const addTransaction = (payload, ctx) => callAppsScript('add', payload, ctx);
export const health = (ctx) => callAppsScript('health', {}, ctx);
export const getLastAppsScriptCall = () => lastAppsScriptCall;
