import express from 'express';

import { requireAuth } from './auth.js';
import * as client from './appsScriptClient.js';
import { normalizeTransactions } from './normalize.js';
import { filterTx, dashboard } from './analytics.js';
import { buildInsights } from './insights.js';
import { config } from './config.js';

export const router = express.Router();

// --- Auth

router.get('/auth/status', (req, res) =>
  res.json({ ok: true, authenticated: !!req.session?.authenticated })
);

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

// --- Apps Script passthrough + computed views

router.get('/health', async (req, res) => {
  try {
    const h = await client.health();
    res.json({ ok: true, appsScript: h });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/metadata', async (req, res) => res.json(await client.getMetadata()));

router.get('/dashboard', async (req, res) => {
  const raw = await client.getTransactions();
  const tx = normalizeTransactions(raw.transactions || []);

  const filtered = filterTx(tx, req.query);
  const d = dashboard(filtered);

  res.json({ ok: true, ...d, insights: buildInsights(filtered, d.summaryCards) });
});

router.get('/transactions', async (req, res) => {
  const raw = await client.getTransactions();
  const tx = normalizeTransactions(raw.transactions || []);
  res.json({ ok: true, transactions: filterTx(tx, req.query) });
});

router.get('/categories', async (req, res) => {
  const raw = await client.getTransactions();
  const tx = filterTx(normalizeTransactions(raw.transactions || []), req.query).filter(
    (t) => t.type === 'Despesa'
  );

  const totals = tx.reduce((acc, t) => {
    const key = t.category || 'Sem categoria';
    acc[key] = (acc[key] || 0) + t.amount;
    return acc;
  }, {});

  const byCategory = Object.entries(totals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  res.json({ ok: true, byCategory });
});

router.post('/transactions', async (req, res) => res.json(await client.addTransaction(req.body)));
