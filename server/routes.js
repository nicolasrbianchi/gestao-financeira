import express from 'express';
import { requireAuth } from './auth.js';
import * as client from './appsScriptClient.js';
import { normalizeTransactions, parseMoneyBR } from './normalize.js';
import { filterTx, buildDashboard } from './analytics.js';
import { config } from './config.js';
import { logger } from './logger.js';
import pkg from '../package.json' with { type: 'json' };

export const router = express.Router();

const appInfo = { version: pkg.version || '0.0.0', commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null };

router.get('/auth/status', (req, res) => {
  logger.info('auth_status_checked', { requestId: req.requestId, authenticated: !!req.session?.authenticated });
  res.json({ ok: true, authenticated: !!req.session?.authenticated });
});
router.post('/auth/login', (req, res) => {
  const { login, password } = req.body || {};
  if (login === config.appLogin && password === config.appPassword) {
    req.session.authenticated = true;
    logger.info('auth_login_success', { requestId: req.requestId, login: login ? '[SET]' : '[EMPTY]' });
    return res.json({ ok: true });
  }
  logger.warn('auth_login_failed', { requestId: req.requestId, login: login ? '[SET]' : '[EMPTY]' });
  return res.status(401).json({ ok: false, error: 'Credenciais inválidas', requestId: req.requestId });
});
router.post('/auth/logout', (req, res) => req.session.destroy(() => { logger.info('auth_logout', { requestId: req.requestId }); res.json({ ok: true }); }));

router.use(requireAuth);

const loadTx = async (query, req) => {
  const raw = await client.getTransactions({ requestId: req.requestId });
  const tx = normalizeTransactions(raw.transactions || [], { requestId: req.requestId });
  return filterTx(tx, query, { requestId: req.requestId });
};

router.get('/health', async (req, res, next) => {
  try {
    const appsScript = await client.health({ requestId: req.requestId });
    logger.info('health_checked', { requestId: req.requestId, appsScriptOk: !!appsScript?.ok });
    res.json({ ok: true, status: 'up', nodeEnv: process.env.NODE_ENV || 'development', uptime: process.uptime(), app: appInfo, appsScript: { ok: !!appsScript?.ok, mock: !!appsScript?.mock }, metadata: { ok: true }, timestamp: new Date().toISOString() });
  } catch (e) { next(e); }
});
router.get('/metadata', async (req, res, next) => { try { const d = await client.getMetadata({ requestId: req.requestId }); logger.info('metadata_loaded', { requestId: req.requestId, categories: d.categories?.length || 0 }); res.json(d); } catch (e) { next(e); } });
router.get('/dashboard', async (req, res, next) => { try { const [tx, metadata] = await Promise.all([loadTx(req.query, req), client.getMetadata({ requestId: req.requestId }).catch((error) => { logger.warn('dashboard_metadata_failed', { requestId: req.requestId, error: error.message }); return {}; })]); logger.info('dashboard_requested', { requestId: req.requestId, count: tx.length }); res.json({ ok: true, ...(buildDashboard(tx, { requestId: req.requestId, filters: req.query, monthlyGoals: metadata.monthlyGoals })) }); } catch (e) { next(e); } });
router.get('/transactions', async (req, res, next) => {
  try {
    const transactions = (await loadTx(req.query, req)).sort((a, b) => b.date.localeCompare(a.date) || b.sheetRowNumber - a.sheetRowNumber);
    const summary = { count: transactions.length, totalAmount: transactions.reduce((a, t) => a + t.amount, 0) };
    logger.info('transactions_listed', { requestId: req.requestId, count: summary.count });
    res.json({ ok: true, summary, transactions });
  } catch (e) { next(e); }
});
router.get('/categories', async (req, res, next) => { try { const dashboard = buildDashboard(await loadTx(req.query, req), { requestId: req.requestId, filters: req.query }); logger.info('categories_loaded', { requestId: req.requestId, count: dashboard.totalPorCategoria.length }); res.json({ ok: true, byCategory: dashboard.totalPorCategoria, bySubcategory: dashboard.totalPorSubcategoria, byAccount: dashboard.totalPorConta, expensesByCategory: dashboard.despesasPorCategoria, expensesBySubcategory: dashboard.despesasPorSubcategoria, expensesByAccount: dashboard.despesasPorConta }); } catch (e) { next(e); } });

router.post('/transactions', async (req, res, next) => {
  try {
    const p = req.body || {};
    if (!p.data || !p.tipo || !p.conta) return res.status(400).json({ ok: false, error: 'Preencha data, tipo e conta/canal.', requestId: req.requestId });
    if (p.tipo !== 'Saldo' && !p.nome) return res.status(400).json({ ok: false, error: 'Preencha o nome da transação.', requestId: req.requestId });
    if (p.tipo === 'Reserva' && !p.reserva) return res.status(400).json({ ok: false, error: 'Reserva obrigatória para tipo Reserva.', requestId: req.requestId });
    if (['Receita', 'Despesa'].includes(p.tipo) && (!p.categoria || !p.subcategoria || !p.forma)) return res.status(400).json({ ok: false, error: 'Receita e Despesa exigem categoria, subcategoria e forma.', requestId: req.requestId });
    if (p.tipo === 'Saldo' && !p.categoria) return res.status(400).json({ ok: false, error: 'Saldo exige categoria.', requestId: req.requestId });
    const amount = parseMoneyBR(p.valor);
    if (!amount || amount <= 0) { logger.warn('transaction_validation_failed', { requestId: req.requestId, reason: 'invalid_amount' }); return res.status(400).json({ ok: false, error: 'Valor inválido.', requestId: req.requestId }); }
    const payload = { ...p, nome: p.nome || `Saldo ${p.conta}`, valor: amount };
    const result = await client.addTransaction(payload, { requestId: req.requestId });
    logger.info('transaction_created', { requestId: req.requestId, tipo: p.tipo, status: p.status || '' });
    res.json({ ok: true, data: result });
  } catch (e) { next(e); }
});

if (process.env.ENABLE_DIAGNOSTICS === 'true') {
  router.get('/debug/diagnostics', async (req, res, next) => {
    try {
      const raw = await client.getTransactions({ requestId: req.requestId });
      const tx = normalizeTransactions(raw.transactions || [], { requestId: req.requestId });
      const sample = tx.slice(0, 1);
      res.json({ ok: true, transactionCount: tx.length, fieldsDetected: sample.length ? Object.keys(sample[0]) : [], metadataCounts: { categories: (await client.getMetadata({ requestId: req.requestId })).categories?.length || 0 }, lastAppsScriptCall: client.getLastAppsScriptCall(), exampleFilters: { startDate: tx[tx.length - 1]?.date, endDate: tx[0]?.date } });
    } catch (e) { next(e); }
  });
}
