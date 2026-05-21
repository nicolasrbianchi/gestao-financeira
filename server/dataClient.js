import { config } from './config.js';
import { normalizeTransactions } from './normalize.js';

import * as apps from './appsScriptClient.js';
import * as db from './dbClient.js';

const source = (config.dataSource || 'appsScript').toLowerCase();

export async function getTransactions(ctx = {}) {
  if (source === 'db') {
    return db.getTransactions(ctx);
  }
  // Apps Script devolve "raw" (display values). Normalizamos aqui.
  const raw = await apps.getTransactions(ctx);
  const normalized = normalizeTransactions(raw.transactions || [], { requestId: ctx.requestId });
  return { ok: true, transactions: normalized };
}

export async function getMetadata(ctx = {}) {
  if (source === 'db') return db.getMetadata(ctx);
  return apps.getMetadata(ctx);
}

export async function addTransaction(payload, ctx = {}) {
  if (source === 'db') return db.addTransaction(payload, ctx);
  return apps.addTransaction(payload, ctx);
}

export async function updateTransaction(payload, ctx = {}) {
  if (source === 'db') return db.updateTransaction(payload, ctx);
  return apps.updateTransaction(payload, ctx);
}

export async function deleteTransaction(payload, ctx = {}) {
  if (source === 'db') return db.deleteTransaction(payload, ctx);
  throw new Error('Exclusão disponível apenas quando DATA_SOURCE=db.');
}

export async function health(ctx = {}) {
  if (source === 'db') return db.health(ctx);
  return apps.health(ctx);
}

export const getLastAppsScriptCall = () => apps.getLastAppsScriptCall?.();
