import { config } from './config.js';

const shouldUseMock = !config.isProd && config.useMockData;

const mockResponse = (action) => {
  if (action === 'health') return { ok: true, mock: true, timestamp: new Date().toISOString() };
  if (action === 'metadata') return { ok: true, types: [], reserves: [], accounts: [], categories: [], subcategories: [], paymentMethods: [], statuses: [] };
  if (action === 'transactions') return { ok: true, transactions: [] };
  if (action === 'add') return { ok: true, mock: true };
  return { ok: true, mock: true };
};

async function callAppsScript(action, params = {}) {
  if (shouldUseMock) return mockResponse(action);

  if (!config.appsScriptUrl) {
    throw new Error(config.isProd ? 'APPS_SCRIPT_URL ausente em produção.' : 'APPS_SCRIPT_URL não configurada.');
  }

  const url = new URL(config.appsScriptUrl);
  url.searchParams.set('action', action);
  url.searchParams.set('token', config.appsScriptToken || '');
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  let response;
  try {
    response = await fetch(url, { method: 'GET' });
  } catch (error) {
    console.error('[appsScriptClient] network error', { action, message: error.message });
    throw new Error('Falha de rede ao chamar Apps Script.');
  }

  if (!response.ok) {
    console.error('[appsScriptClient] http error', { action, status: response.status });
    throw new Error(`Apps Script respondeu HTTP ${response.status}.`);
  }

  const data = await response.json();
  if (data?.ok === false) {
    console.error('[appsScriptClient] appscript error', { action, error: data.error || 'unknown' });
    throw new Error(data.error || 'Erro retornado pelo Apps Script.');
  }

  return data;
}

export const getTransactions = () => callAppsScript('transactions');
export const getMetadata = () => callAppsScript('metadata');
export const addTransaction = (payload) => callAppsScript('add', payload);
export const health = () => callAppsScript('health');
