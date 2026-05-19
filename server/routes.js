import express from 'express';
import { requireAuth } from './auth.js';
import * as client from './appsScriptClient.js';
import { normalizeTransactions, parseMoneyBR } from './normalize.js';
import { filterTx, buildDashboard } from './analytics.js';
import { config } from './config.js';

export const router = express.Router();

router.get('/auth/status', (req, res) => res.json({ ok: true, authenticated: !!req.session?.authenticated }));
router.post('/auth/login', (req, res) => {
  const { login, password } = req.body || {};
  if (login === config.appLogin && password === config.appPassword) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
});
router.post('/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

router.use(requireAuth);

const loadTx = async (query) => {
  const raw = await client.getTransactions();
  const tx = normalizeTransactions(raw.transactions || []);
  return filterTx(tx, query);
};

router.get('/health', async (_req, res) => {
  try { res.json({ ok: true, appsScript: await client.health() }); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
router.get('/metadata', async (_req, res) => res.json(await client.getMetadata()));
router.get('/dashboard', async (req, res) => res.json({ ok: true, ...(buildDashboard(await loadTx(req.query))) }));
router.get('/transactions', async (req, res) => {
  const transactions = (await loadTx(req.query)).sort((a, b) => b.date.localeCompare(a.date) || b.sheetRowNumber - a.sheetRowNumber);
  const summary = { count: transactions.length, totalAmount: transactions.reduce((a, t) => a + t.amount, 0) };
  res.json({ ok: true, summary, transactions });
});
router.get('/categories', async (req, res) => {
  const dashboard = buildDashboard(await loadTx(req.query));
  res.json({ ok: true, byCategory: dashboard.totalPorCategoria, bySubcategory: dashboard.totalPorSubcategoria, byAccount: dashboard.totalPorConta, expensesByCategory: dashboard.despesasPorCategoria, expensesBySubcategory: dashboard.despesasPorSubcategoria, expensesByAccount: dashboard.despesasPorConta });
});

router.post('/transactions', async (req, res) => {
  const p = req.body || {};
  if (!p.data || !p.nome || !p.tipo || !p.status) return res.status(400).json({ ok: false, error: 'Campos obrigatórios ausentes.' });
  if (p.tipo === 'Reserva' && !p.reserva) return res.status(400).json({ ok: false, error: 'Reserva obrigatória para tipo Reserva.' });
  const amount = parseMoneyBR(p.valor);
  if (!amount || amount <= 0) return res.status(400).json({ ok: false, error: 'Valor inválido.' });
  const result = await client.addTransaction({ ...p, valor: amount });
  res.json({ ok: true, data: result });
});
