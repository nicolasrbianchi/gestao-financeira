import express from 'express';
import { requireAuth } from './auth.js';
import * as client from './dataClient.js';
import { normalizeTransactions, parseMoneyBR } from './normalize.js';
import { filterTx, buildDashboard } from './analytics.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { query } from './db.js';
import { openAiText } from './openaiClient.js';
import { listCategories, createCategory, updateCategory } from './categoriesDb.js';
import { listSubcategories, createSubcategory, updateSubcategory } from './subcategoriesDb.js';
import { listAccounts as listManagedAccounts, createAccount, updateAccount } from './accountsDb.js';
import { listMonthlyGoals, upsertMonthlyGoal, deleteMonthlyGoal } from './monthlyGoalsDb.js';
import { buildExportPayload, buildTransactionsCsv, buildInboxCsv } from './exporter.js';
import { listPendingImports, rejectImport, approveImport } from './importInboxDb.js';
import { createConnectToken, listAccounts, listTransactionsByUrl, listTransactionsByIds, listTransactionsByAccount, getItem as pluggyGetItem } from './pluggyClient.js';
import { upsertPluggyItem, listPluggyItems, touchPluggyItemWebhook, touchPluggyItemSync, touchPluggyItemFetch, getPluggyItem, insertImportsFromPluggy, setPluggyItemIgnoreBefore } from './pluggyDb.js';
import pkg from '../package.json' with { type: 'json' };

export const router = express.Router();

// Mantém o serviço “quente” no Render free (sem auth, sem dependências).
// Use com um monitor externo (UptimeRobot / cron / etc.).
router.get(['/ping', '/wakeup'], (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(204).end();
});

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
router.post('/auth/logout', (req, res) => {
  // cookie-session: limpar sessão no cookie
  req.session = null;
  logger.info('auth_logout', { requestId: req.requestId });
  res.json({ ok: true });
});

// Webhook Pluggy (sem auth). Protegido por token simples opcional.
router.post('/pluggy/webhook', (req, res) => {
  const token = String(req.query.token || '').trim();
  const expected = String(process.env.PLUGGY_WEBHOOK_TOKEN || '').trim();
  if (expected && token !== expected) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // ACK rápido (Pluggy pode retry se não receber 2xx)
  res.status(204).end();

  const payload = req.body || {};
  const requestId = req.requestId;
  void (async () => {
    try {
      const event = String(payload.event || '').trim();
      const itemId = String(payload.itemId || payload.id || '').trim();

      logger.info('pluggy_webhook_received', {
        requestId,
        event: event || '[empty]',
        itemId: itemId || null,
        accountId: payload.accountId || null,
        hasCreatedLink: !!payload.createdTransactionsLink,
        txIdsCount: Array.isArray(payload.transactionIds) ? payload.transactionIds.length : 0,
      });

      if (itemId) await touchPluggyItemWebhook({ itemId, requestId });

      if (event === 'item/created' || event === 'item/updated') {
        // Garante que o item exista na nossa base.
        if (itemId) await upsertPluggyItem({ itemId, clientUserId: String(payload.clientUserId || ''), requestId });
        // Observabilidade: o auto-sync diário do Pluggy (ou update manual no MeuPluggy) dispara item/updated.
        // Marcamos last_sync_at para termos um "último sync observado" mesmo quando não vem transação no webhook.
        if (event === 'item/updated' && itemId) await touchPluggyItemSync({ itemId, requestId });
        return;
      }

      if (event === 'transactions/created') {
        const link = String(payload.createdTransactionsLink || '').trim();
        if (!itemId || !link) {
          logger.warn('pluggy_webhook_missing_created_link', { requestId, itemId: itemId || null });
          return;
        }

        const item = await getPluggyItem({ itemId });
        if (!item?.enabled) return;

        // accountHint best-effort
        let accountHint = '';
        try {
          const accounts = await listAccounts({ requestId, itemId });
          const accId = String(payload.accountId || '').trim();
          const acc = accounts.find((a) => String(a?.id || '') === accId);
          accountHint = String(acc?.name || acc?.number || acc?.type || accId || '');
        } catch {
          accountHint = String(payload.accountId || '').trim();
        }

        const tx = await listTransactionsByUrl({ requestId, url: link });
        await insertImportsFromPluggy({ requestId, itemId, accountHint, transactions: tx, ignoreBefore: item.ignoreBefore });
        await touchPluggyItemSync({ itemId, requestId });
        return;
      }

      if (event === 'transactions/updated') {
        // best-effort: puxa detalhes dos ids e insere na inbox se não existir.
        const ids = Array.isArray(payload.transactionIds) ? payload.transactionIds : [];
        if (!itemId || !ids.length) {
          logger.warn('pluggy_webhook_missing_updated_ids', { requestId, itemId: itemId || null });
          return;
        }
        const item = await getPluggyItem({ itemId });
        if (!item?.enabled) return;
        const tx = await listTransactionsByIds({ requestId, ids });
        await insertImportsFromPluggy({ requestId, itemId, accountHint: String(payload.accountId || ''), transactions: tx, ignoreBefore: item.ignoreBefore });
        await touchPluggyItemSync({ itemId, requestId });
      }
    } catch (e) {
      logger.error('pluggy_webhook_failed', { requestId, error: e?.message || String(e) });
    }
  })();
});

router.use(requireAuth);

const loadNormalizedTx = async (req) => {
  const data = await client.getTransactions({ requestId: req.requestId });

  // dataSource=db já vem normalizado; appsScript ainda pode vir raw (mas o dataClient já normaliza).
  const tx = Array.isArray(data?.transactions) ? data.transactions : [];
  // Garantia extra (não custa): se vierem transações raw do Apps Script por algum motivo, normaliza.
  const maybeRaw = tx.length && typeof tx[0] === 'object' && 'Data' in tx[0];
  return maybeRaw ? normalizeTransactions(tx, { requestId: req.requestId }) : tx;
};

// Para saldo "real" (carteira), queremos considerar todo o histórico até o endDate,
// mas mantendo filtros não-temporais (conta/tipo/status/etc.) quando informados.
const buildToDateQuery = (query = {}) => ({
  ...query,
  startDate: '',
});

router.get('/health', async (req, res, next) => {
  try {
    const dataSource = String(config.dataSource || 'appsScript').toLowerCase();
    const health = await client.health({ requestId: req.requestId });
    logger.info('health_checked', { requestId: req.requestId, dataSource, ok: !!health?.ok });

    res.json({
      ok: true,
      status: 'up',
      nodeEnv: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      app: appInfo,
      dataSource,
      data: { ok: !!health?.ok, mock: !!health?.mock },
      timestamp: new Date().toISOString(),
    });
  } catch (e) { next(e); }
});
router.get('/metadata', async (req, res, next) => { try { const d = await client.getMetadata({ requestId: req.requestId }); logger.info('metadata_loaded', { requestId: req.requestId, categories: d.categories?.length || 0 }); res.json(d); } catch (e) { next(e); } });

// Gestão de categorias/subcategorias (DB-only). Quando DATA_SOURCE!=db, devolve 409.
function assertDbSource(req, res) {
  if (String(config.dataSource || '').toLowerCase() !== 'db') {
    res.status(409).json({ ok: false, error: 'Recurso disponível apenas quando DATA_SOURCE=db.', requestId: req.requestId });
    return false;
  }
  return true;
}

router.get('/categories/manage', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const categories = await listCategories({ includeInactive });
    res.json({ ok: true, categories });
  } catch (e) { next(e); }
});

router.post('/categories/manage', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const created = await createCategory({ name: req.body?.name });
    res.json({ ok: true, category: created });
  } catch (e) { next(e); }
});

router.put('/categories/manage/:id', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const updated = await updateCategory(req.params.id, { name: req.body?.name, isActive: req.body?.isActive });
    res.json({ ok: true, category: updated });
  } catch (e) { next(e); }
});

router.get('/subcategories/manage', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const subcategories = await listSubcategories({ includeInactive });
    res.json({ ok: true, subcategories });
  } catch (e) { next(e); }
});

router.post('/subcategories/manage', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const created = await createSubcategory({ name: req.body?.name });
    res.json({ ok: true, subcategory: created });
  } catch (e) { next(e); }
});

router.put('/subcategories/manage/:id', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const updated = await updateSubcategory(req.params.id, { name: req.body?.name, isActive: req.body?.isActive });
    res.json({ ok: true, subcategory: updated });
  } catch (e) { next(e); }
});

// Gestão de contas/canais (DB-only)
router.get('/accounts/manage', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const accounts = await listManagedAccounts({ includeInactive });
    res.json({ ok: true, accounts });
  } catch (e) { next(e); }
});

router.post('/accounts/manage', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const account = await createAccount({ name: req.body?.name });
    res.json({ ok: true, account });
  } catch (e) { next(e); }
});

router.put('/accounts/manage/:id', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const account = await updateAccount(req.params.id, { name: req.body?.name, isActive: req.body?.isActive });
    res.json({ ok: true, account });
  } catch (e) { next(e); }
});

// Seed inicial: cria accounts a partir do histórico de transactions (sem duplicar case-insensitive).
router.post('/accounts/manage/seed', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    // Insere todas as contas distintas que já existem em transactions.
    // Evita duplicatas por lower(name).
    const { rows } = await query(
      `with distinct_accounts as (
         select distinct account as name
           from transactions
          where account is not null and account <> ''
       ),
       to_insert as (
         select d.name
           from distinct_accounts d
           left join accounts a on lower(a.name) = lower(d.name)
          where a.id is null
       )
       insert into accounts (name)
       select name from to_insert
       returning id, name, is_active as "isActive"`
    );
    res.json({ ok: true, inserted: rows.length, accounts: rows });
  } catch (e) { next(e); }
});

// Metas mensais (DB-only)
router.get('/monthly-goals/manage', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const goals = await listMonthlyGoals();
    res.json({ ok: true, goals });
  } catch (e) { next(e); }
});

router.post('/monthly-goals/manage', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const goal = await upsertMonthlyGoal({ month: req.body?.month, value: req.body?.value });
    res.json({ ok: true, goal });
  } catch (e) { next(e); }
});

router.delete('/monthly-goals/manage/:month', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    await deleteMonthlyGoal(req.params.month);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Bootstrap: reduz roundtrips no 1º carregamento (dashboard + metadata em uma chamada)
router.get('/bootstrap', async (req, res, next) => {
  try {
    const [normalized, metadata] = await Promise.all([
      loadNormalizedTx(req),
      client.getMetadata({ requestId: req.requestId }).catch((error) => {
        logger.warn('bootstrap_metadata_failed', { requestId: req.requestId, error: error.message });
        return {};
      }),
    ]);

    const tx = filterTx(normalized, req.query, { requestId: req.requestId });
    const txToDate = filterTx(normalized, buildToDateQuery(req.query), { requestId: req.requestId });
    const dashboard = buildDashboard(tx, { requestId: req.requestId, filters: req.query, monthlyGoals: metadata.monthlyGoals, toDateTransactions: txToDate, chartDays: 8 });

    logger.info('bootstrap_requested', { requestId: req.requestId, txCount: tx.length, txCountToDate: txToDate.length });
    res.json({ ok: true, metadata, dashboard });
  } catch (e) {
    next(e);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const [normalized, metadata] = await Promise.all([
      loadNormalizedTx(req),
      client.getMetadata({ requestId: req.requestId }).catch((error) => {
        logger.warn('dashboard_metadata_failed', { requestId: req.requestId, error: error.message });
        return {};
      }),
    ]);

    const tx = filterTx(normalized, req.query, { requestId: req.requestId });
    const txToDate = filterTx(normalized, buildToDateQuery(req.query), { requestId: req.requestId });

    logger.info('dashboard_requested', { requestId: req.requestId, count: tx.length, countToDate: txToDate.length });
    res.json({ ok: true, ...(buildDashboard(tx, { requestId: req.requestId, filters: req.query, monthlyGoals: metadata.monthlyGoals, toDateTransactions: txToDate, chartDays: 8 })) });
  } catch (e) {
    next(e);
  }
});
router.get('/transactions', async (req, res, next) => {
  try {
    const normalized = await loadNormalizedTx(req);
    const transactions = filterTx(normalized, req.query, { requestId: req.requestId }).sort((a, b) => b.date.localeCompare(a.date) || b.sheetRowNumber - a.sheetRowNumber);
    const summary = { count: transactions.length, totalAmount: transactions.reduce((a, t) => a + t.amount, 0) };
    logger.info('transactions_listed', { requestId: req.requestId, count: summary.count });
    res.json({ ok: true, summary, transactions });
  } catch (e) { next(e); }
});
router.get('/categories', async (req, res, next) => {
  try {
    const [normalized, metadata] = await Promise.all([
      loadNormalizedTx(req),
      client.getMetadata({ requestId: req.requestId }).catch((error) => {
        logger.warn('categories_metadata_failed', { requestId: req.requestId, error: error.message });
        return {};
      }),
    ]);

    const tx = filterTx(normalized, req.query, { requestId: req.requestId });
    const txToDate = filterTx(normalized, buildToDateQuery(req.query), { requestId: req.requestId });
    const dashboard = buildDashboard(tx, { requestId: req.requestId, filters: req.query, monthlyGoals: metadata.monthlyGoals, toDateTransactions: txToDate, chartDays: 8 });
    logger.info('categories_loaded', { requestId: req.requestId, count: dashboard.totalPorCategoria.length, countToDate: txToDate.length });
    res.json({
      ok: true,
      meta: dashboard.meta,
      accountBreakdown: dashboard.accountBreakdown,
      byCategory: dashboard.totalPorCategoria,
      bySubcategory: dashboard.totalPorSubcategoria,
      byAccount: dashboard.totalPorConta,
      expensesByCategory: dashboard.despesasPorCategoria,
      expensesBySubcategory: dashboard.despesasPorSubcategoria,
      expensesByAccount: dashboard.despesasPorConta,
      topTransactions: dashboard.topTransactions,
      insights: dashboard.insights,
      charts: { dailySeries: dashboard.charts?.dailySeries || [] },
    });
  } catch (e) {
    next(e);
  }
});

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

// Inbox de importação (DB-only)
router.get('/imports/pending', async (req, res, next) => {
  try {
    if (String(config.dataSource || '').toLowerCase() !== 'db') {
      return res.status(409).json({ ok: false, error: 'Recurso disponível apenas quando DATA_SOURCE=db.', requestId: req.requestId });
    }
    const items = await listPendingImports({ requestId: req.requestId });
    res.json({ ok: true, items });
  } catch (e) { next(e); }
});

router.post('/imports/:id/approve', async (req, res, next) => {
  try {
    if (String(config.dataSource || '').toLowerCase() !== 'db') {
      return res.status(409).json({ ok: false, error: 'Recurso disponível apenas quando DATA_SOURCE=db.', requestId: req.requestId });
    }

    // Reusa validação/criação do /transactions.
    const p = req.body || {};
    if (!p.data || !p.tipo || !p.conta) return res.status(400).json({ ok: false, error: 'Preencha data, tipo e conta/canal.', requestId: req.requestId });
    if (p.tipo !== 'Saldo' && !p.nome) return res.status(400).json({ ok: false, error: 'Preencha o nome da transação.', requestId: req.requestId });
    if (p.tipo === 'Reserva' && !p.reserva) return res.status(400).json({ ok: false, error: 'Reserva obrigatória para tipo Reserva.', requestId: req.requestId });
    if (['Receita', 'Despesa'].includes(p.tipo) && (!p.categoria || !p.subcategoria || !p.forma)) return res.status(400).json({ ok: false, error: 'Receita e Despesa exigem categoria, classificação e forma.', requestId: req.requestId });
    if (p.tipo === 'Saldo' && !p.categoria) return res.status(400).json({ ok: false, error: 'Saldo exige categoria.', requestId: req.requestId });
    const amount = parseMoneyBR(p.valor);
    if (!amount || amount <= 0) return res.status(400).json({ ok: false, error: 'Valor inválido.', requestId: req.requestId });

    const payload = { ...p, nome: p.nome || `Saldo ${p.conta}`, valor: amount };
    const result = await client.addTransaction(payload, { requestId: req.requestId });

    const txId = Number(result?.row || result?.id || 0);
    if (!txId) throw new Error('Falha ao criar transação.');
    const importId = Number(req.params.id || 0);
    await approveImport(importId, txId, { requestId: req.requestId });

    res.json({ ok: true, data: { importId, transactionId: txId } });
  } catch (e) { next(e); }
});

router.post('/imports/:id/reject', async (req, res, next) => {
  try {
    if (String(config.dataSource || '').toLowerCase() !== 'db') {
      return res.status(409).json({ ok: false, error: 'Recurso disponível apenas quando DATA_SOURCE=db.', requestId: req.requestId });
    }
    const importId = Number(req.params.id || 0);
    const result = await rejectImport(importId, { requestId: req.requestId });
    res.json({ ok: true, data: result });
  } catch (e) { next(e); }
});

// Pluggy / MeuPluggy (DB-only)
router.post('/pluggy/connect-token', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;

    const baseUrl = String(process.env.PLUGGY_WEBHOOK_URL || '').trim() || `${req.protocol}://${req.get('host')}/api/pluggy/webhook`;
    const token = String(process.env.PLUGGY_WEBHOOK_TOKEN || '').trim();
    const webhookUrl = token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;

    const itemId = String(req.body?.itemId || '').trim();

    const connectToken = await createConnectToken({
      requestId: req.requestId,
      options: {
        webhookUrl,
        clientUserId: 'nicco',
        avoidDuplicates: true,
        ...(itemId ? { itemId } : {}),
      },
    });

    res.json({ ok: true, accessToken: connectToken, connectToken });
  } catch (e) { next(e); }
});

router.post('/pluggy/items', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const itemId = String(req.body?.itemId || '').trim();
    if (!itemId) return res.status(400).json({ ok: false, error: 'itemId obrigatório.', requestId: req.requestId });

    // Por padrão, limitamos o histórico inicial para evitar inundar a inbox.
    // OBS: createdAtFrom no Pluggy é "quando o Pluggy criou" a transação (sync), então em conexões novas pode vir tudo.
    // Usamos ignoreBefore (baseado no occurredAt/date) como corte real.
    const initialDays = Number(process.env.PLUGGY_INITIAL_IMPORT_DAYS || 3);
    const ignoreBefore = new Date(Date.now() - Math.max(0, initialDays) * 24 * 60 * 60 * 1000).toISOString();
    const item = await upsertPluggyItem({ itemId, clientUserId: 'nicco', requestId: req.requestId, ignoreBefore });
    res.json({ ok: true, item });
  } catch (e) { next(e); }
});

// Utilitário: ajusta ignoreBefore de todos os itens Pluggy para "agora - N dias".
router.post('/pluggy/items/ignore-before/last-days', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const days = Number(req.body?.days ?? 2);
    if (!Number.isFinite(days) || days < 0 || days > 365) {
      return res.status(400).json({ ok: false, error: 'days inválido.', requestId: req.requestId });
    }

    const ignoreBefore = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const items = await listPluggyItems({ requestId: req.requestId });
    const enabled = items.filter((i) => i.enabled);
    for (const it of enabled) {
      await setPluggyItemIgnoreBefore({ itemId: it.itemId, ignoreBefore, requestId: req.requestId });
    }
    res.json({ ok: true, data: { days, ignoreBefore, items: enabled.length } });
  } catch (e) {
    next(e);
  }
});

// Utilitário: remove pendências antigas da inbox (Pluggy) para evitar listas enormes.
router.post('/imports/prune', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const days = Number(req.body?.days ?? 2);
    const onlyPending = req.body?.onlyPending !== false;
    if (!Number.isFinite(days) || days < 0 || days > 365) {
      return res.status(400).json({ ok: false, error: 'days inválido.', requestId: req.requestId });
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { rowCount } = await query(
      onlyPending
        ? `delete from import_inbox where provider='pluggy' and status='pending' and occurred_at < $1::timestamptz`
        : `delete from import_inbox where provider='pluggy' and occurred_at < $1::timestamptz`,
      [cutoff]
    );

    logger.info('import_inbox_pruned', { requestId: req.requestId, provider: 'pluggy', days, onlyPending, deleted: rowCount });
    res.json({ ok: true, data: { days, onlyPending, cutoff, deleted: rowCount } });
  } catch (e) {
    next(e);
  }
});

router.get('/pluggy/items', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const items = await listPluggyItems({ requestId: req.requestId });
    res.json({ ok: true, items: items.filter((i) => i.enabled) });
  } catch (e) { next(e); }
});

// Debug/observability: consulta status do Item diretamente no Pluggy.
router.get('/pluggy/items/:itemId', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    const itemId = String(req.params.itemId || '').trim();
    if (!itemId) return res.status(400).json({ ok: false, error: 'itemId obrigatório.', requestId: req.requestId });
    const data = await pluggyGetItem({ requestId: req.requestId, itemId });
    res.json({ ok: true, item: data });
  } catch (e) {
    next(e);
  }
});

// MVP: buscar transações manualmente (últimas 24h por createdAtFrom) e jogar na inbox.
// Premissa: o usuário atualiza/sincroniza no MeuPluggy e o Nicco só puxa os dados via API.
router.post('/pluggy/fetch-transactions', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;

    const overlapMs = Number(process.env.PLUGGY_FETCH_OVERLAP_MS || 5 * 60 * 1000);
    const normalMinIntervalMs = Number(process.env.PLUGGY_FETCH_MIN_INTERVAL_MS || 3 * 60 * 1000);
    const burst = req.body?.burst === true;
    const minIntervalMs = burst ? 30 * 1000 : normalMinIntervalMs;
    const nowIso = new Date().toISOString();

    logger.info('pluggy_manual_fetch_started', { requestId: req.requestId, mode: 'cursor', overlapMs, minIntervalMs, burst });

    const items = await listPluggyItems({ requestId: req.requestId });
    const enabled = items.filter((i) => i.enabled);
    if (!enabled.length) {
      logger.info('pluggy_manual_fetch_finished', { requestId: req.requestId, items: 0, accounts: 0, seen: 0, inserted: 0, updated: 0 });
      return res.json({ ok: true, data: { items: 0, accounts: 0, seen: 0, inserted: 0, updated: 0 } });
    }

    let totalAccounts = 0;
    let totalSeen = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let skippedItems = 0;

    for (const it of enabled) {
      const lastFetchAt = it.lastFetchAt ? new Date(it.lastFetchAt) : null;
      if (lastFetchAt && !Number.isNaN(lastFetchAt.getTime()) && Date.now() - lastFetchAt.getTime() < minIntervalMs) {
        skippedItems += 1;
        logger.debug('pluggy_manual_fetch_item_skipped', { requestId: req.requestId, itemId: it.itemId, lastFetchAt: it.lastFetchAt, minIntervalMs });
        continue;
      }

      const createdAtFrom = lastFetchAt && !Number.isNaN(lastFetchAt.getTime())
        ? new Date(lastFetchAt.getTime() - overlapMs).toISOString()
        : nowIso; // primeira vez: começa "daqui pra frente"

      logger.info('pluggy_manual_fetch_item_started', { requestId: req.requestId, itemId: it.itemId, createdAtFrom, lastFetchAt: it.lastFetchAt || null });

      let accounts = [];
      let itemErrors = 0;
      try {
        logger.debug('pluggy_manual_fetch_list_accounts_started', { requestId: req.requestId, itemId: it.itemId });
        accounts = await listAccounts({ requestId: req.requestId, itemId: it.itemId });
        logger.debug('pluggy_manual_fetch_list_accounts_finished', { requestId: req.requestId, itemId: it.itemId, accounts: accounts.length });
      } catch (e) {
        itemErrors += 1;
        logger.warn('pluggy_manual_fetch_list_accounts_failed', {
          requestId: req.requestId,
          itemId: it.itemId,
          status: e?.status || null,
          pluggyRequestId: e?.pluggyRequestId || null,
          error: e?.message || String(e),
        });
        continue;
      }

      totalAccounts += accounts.length;

      for (const acc of accounts) {
        const accountId = String(acc?.id || '').trim();
        if (!accountId) continue;

        const accountHint = String(acc?.name || acc?.number || acc?.type || accountId || '').trim();

        let tx = [];
        try {
          logger.debug('pluggy_manual_fetch_list_transactions_started', { requestId: req.requestId, itemId: it.itemId, accountId, createdAtFrom });
          tx = await listTransactionsByAccount({ requestId: req.requestId, accountId, createdAtFrom });
          logger.debug('pluggy_manual_fetch_list_transactions_finished', { requestId: req.requestId, itemId: it.itemId, accountId, count: tx.length });
        } catch (e) {
          itemErrors += 1;
          logger.warn('pluggy_manual_fetch_list_transactions_failed', {
            requestId: req.requestId,
            itemId: it.itemId,
            accountId,
            status: e?.status || null,
            pluggyRequestId: e?.pluggyRequestId || null,
            error: e?.message || String(e),
          });
          continue;
        }

        const r = await insertImportsFromPluggy({ requestId: req.requestId, itemId: it.itemId, accountHint, transactions: tx, ignoreBefore: it.ignoreBefore });
        totalSeen += r.seen || 0;
        totalInserted += r.inserted || 0;
        totalUpdated += r.updated || 0;
      }

      // Só avança o cursor se conseguimos processar o item sem erros.
      if (!itemErrors) {
        await touchPluggyItemFetch({ itemId: it.itemId, requestId: req.requestId });
      } else {
        logger.warn('pluggy_manual_fetch_item_partial_failure', { requestId: req.requestId, itemId: it.itemId, errors: itemErrors });
      }
    }

    logger.info('pluggy_manual_fetch_finished', {
      requestId: req.requestId,
      items: enabled.length,
      skippedItems,
      accounts: totalAccounts,
      seen: totalSeen,
      inserted: totalInserted,
      updated: totalUpdated,
    });

    res.json({
      ok: true,
      data: {
        items: enabled.length,
        skippedItems,
        accounts: totalAccounts,
        seen: totalSeen,
        inserted: totalInserted,
        updated: totalUpdated,
      },
    });
  } catch (e) {
    next(e);
  }
});

// Legado: antes tentávamos forçar update do item via API (PATCH /items), mas itens MeuPluggy não suportam.
// Mantemos a rota por compatibilidade, mas ela não executa update.
router.post('/pluggy/sync', async (req, res, next) => {
  try {
    if (!assertDbSource(req, res)) return;
    res.json({ ok: true, data: { disabled: true, reason: 'MeuPluggy: update via API desabilitado. Atualize no painel e aguarde o fetch.' } });
  } catch (e) { next(e); }
});

async function updateTransactionById(id, req, res, next) {
  try {
    const p = req.body || {};
    if (!id || id < 2) return res.status(400).json({ ok: false, error: 'id inválido.', requestId: req.requestId });

    if (!p.data || !p.tipo || !p.conta) return res.status(400).json({ ok: false, error: 'Preencha data, tipo e conta/canal.', requestId: req.requestId });
    if (p.tipo !== 'Saldo' && !p.nome) return res.status(400).json({ ok: false, error: 'Preencha o nome da transação.', requestId: req.requestId });
    if (p.tipo === 'Reserva' && !p.reserva) return res.status(400).json({ ok: false, error: 'Reserva obrigatória para tipo Reserva.', requestId: req.requestId });
    if (['Receita', 'Despesa'].includes(p.tipo) && (!p.categoria || !p.subcategoria || !p.forma)) return res.status(400).json({ ok: false, error: 'Receita e Despesa exigem categoria, subcategoria e forma.', requestId: req.requestId });
    if (p.tipo === 'Saldo' && !p.categoria) return res.status(400).json({ ok: false, error: 'Saldo exige categoria.', requestId: req.requestId });
    const amount = parseMoneyBR(p.valor);
    if (!amount || amount <= 0) {
      logger.warn('transaction_validation_failed', { requestId: req.requestId, reason: 'invalid_amount_update' });
      return res.status(400).json({ ok: false, error: 'Valor inválido.', requestId: req.requestId });
    }

    const payload = { ...p, id, row: id, sheetRowNumber: id, nome: p.nome || `Saldo ${p.conta}`, valor: amount };
    const result = await client.updateTransaction(payload, { requestId: req.requestId });
    logger.info('transaction_updated', { requestId: req.requestId, id, tipo: p.tipo, status: p.status || '' });
    res.json({ ok: true, data: result });
  } catch (e) {
    next(e);
  }
}

// Atualização por id.
// Legado: quando DATA_SOURCE=appsScript, o id é o sheetRowNumber.
router.put('/transactions/:id', (req, res, next) => updateTransactionById(Number(req.params.id || 0), req, res, next));

// Legado (compat): rota antiga por "row".
router.put('/transactions/by-row/:row', (req, res, next) => updateTransactionById(Number(req.params.row || 0), req, res, next));

async function deleteTransactionById(id, req, res, next) {
  try {
    if (String(config.dataSource || '').toLowerCase() !== 'db') {
      return res.status(409).json({ ok: false, error: 'Exclusão disponível apenas quando DATA_SOURCE=db.', requestId: req.requestId });
    }
    if (!id || id < 1) return res.status(400).json({ ok: false, error: 'id inválido.', requestId: req.requestId });
    const result = await client.deleteTransaction({ id }, { requestId: req.requestId });
    res.json({ ok: true, data: result });
  } catch (e) {
    next(e);
  }
}

router.delete('/transactions/:id', (req, res, next) => deleteTransactionById(Number(req.params.id || 0), req, res, next));
router.delete('/transactions/by-row/:row', (req, res, next) => deleteTransactionById(Number(req.params.row || 0), req, res, next));

router.get('/export/backup.json', async (req, res, next) => {
  try {
    const payload = await buildExportPayload({ requestId: req.requestId });
    const filename = `nicco-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.get('/export/transactions.csv', async (req, res, next) => {
  try {
    const csv = await buildTransactionsCsv({ requestId: req.requestId });
    const filename = `nicco-finance-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

router.get('/export/inbox.csv', async (req, res, next) => {
  try {
    const csv = await buildInboxCsv({ requestId: req.requestId });
    const filename = `nicco-finance-inbox-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

router.post('/ai/chat', async (req, res, next) => {
  try {
    const body = req.body || {};
    const userMessage = String(body.message || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    if (!userMessage) return res.status(400).json({ ok: false, error: 'Mensagem vazia.', requestId: req.requestId });

    const normalized = await loadNormalizedTx(req);
    const toDate = filterTx(normalized, { startDate: '', endDate: '', search: '' }, { requestId: req.requestId });

    // Prompt fixo + regras de negócio
    const rules = [
      'Transferência entre contas NÃO é receita/despesa real. Ela só movimenta saldo entre contas/canais.',
      'Reserva: Entrada = + (aumenta a reserva), Saída = - (reduz a reserva).',
      'Tipo=Saldo funciona como SNAPSHOT por conta/canal: o último Saldo da conta define o saldo inicial e o restante é calculado a partir dele.',
      'Valores das transações são positivos; o sinal é inferido pelo tipo (Receita +, Despesa -, Reserva depende Entrada/Saída).',
    ];

    // Dataset enxuto (mas com todos os registros) — para reduzir tokens.
    const dataset = toDate
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || (a.sheetRowNumber || 0) - (b.sheetRowNumber || 0))
      .map((t) => ({
        date: t.date,
        name: t.name,
        type: t.type,
        reserve: t.reserve,
        account: t.account,
        category: t.category,
        subcategory: t.subcategory,
        paymentMethod: t.paymentMethod,
        amount: t.amount,
        status: t.status,
        installment: t.installment,
        notes: t.notes,
        sheetRowNumber: t.sheetRowNumber,
      }));

    // Também manda um snapshot do dashboard (ajuda o modelo a responder rápido e com números macro).
    const metadata = await client.getMetadata({ requestId: req.requestId }).catch(() => ({}));
    const dashboard = buildDashboard(toDate, {
      requestId: req.requestId,
      filters: {},
      monthlyGoals: metadata.monthlyGoals,
      toDateTransactions: toDate,
      chartDays: 8,
    });

    const maxChars = Number(process.env.AI_MAX_DATASET_CHARS || 180_000);
    let datasetJson = JSON.stringify({ transactionCount: dataset.length, transactions: dataset });
    let truncatedNote = '';
    if (datasetJson.length > maxChars) {
      // Corte conservador por caracteres (evita explodir contexto). Mantém o começo e o fim.
      const headCount = Math.max(50, Math.floor(dataset.length * 0.35));
      const tailCount = Math.max(50, Math.floor(dataset.length * 0.35));
      const head = dataset.slice(0, headCount);
      const tail = dataset.slice(-tailCount);
      datasetJson = JSON.stringify({
        transactionCount: dataset.length,
        truncated: true,
        kept: { head: headCount, tail: tailCount },
        transactions_head: head,
        transactions_tail: tail,
      });
      truncatedNote = `\n\nNota: dataset truncado por limite de contexto (mantive início e fim). Total original: ${dataset.length}.`;
    }

    const systemPrompt = `Você é o Nicco IA, assistente do app Nicco Finance.\n\nRegras de negócio (obrigatórias):\n- ${rules.join('\n- ')}\n\nEstilo: responda em pt-BR, amigável e MUITO direto.\n- Comece com uma resposta em 1–3 linhas.\n- Depois, no máximo 4 bullets de insights (se fizer sentido).\n- Use **negrito** apenas com dois asteriscos (ex: **Saldo total**). Não use *asterisco simples* para formatação.\n- Se precisar de suposições, declare em 1 linha.\n- Não invente números: use apenas os dados fornecidos.`;

    const contextMessage = `Contexto do app (dashboard calculado):\n${JSON.stringify({
      meta: dashboard.meta,
      summaryCards: dashboard.summaryCards,
      accountBreakdown: dashboard.accountBreakdown,
      totalsByType: dashboard.totalPorTipo?.slice?.(0, 20),
    })}\n\nDataset de transações (toDate):\n${datasetJson}${truncatedNote}`;

    const sanitizedHistory = history
      .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }));

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextMessage },
      ...sanitizedHistory,
      { role: 'user', content: userMessage },
    ];

    const startedAt = Date.now();
    const result = await openAiText({
      apiKey: config.openAiKey,
      requestId: req.requestId,
      model: 'gpt-5.4',
      messages,
      maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 900),
    });

    logger.info('ai_chat_completed', { requestId: req.requestId, durationMs: Date.now() - startedAt, transactionCount: dataset.length, truncated: !!truncatedNote });
    res.json({ ok: true, answer: result.text, meta: { transactionCount: dataset.length, truncated: !!truncatedNote, requestId: req.requestId } });
  } catch (e) {
    next(e);
  }
});

// Insight periódico (Nicco IA)
router.get('/ai/insight', async (req, res, next) => {
  try {
    const requestId = req.requestId;
    const normalized = await loadNormalizedTx(req);

    // janela padrão: últimos 30 dias
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromIso = from.toISOString().slice(0, 10);
    const recent = normalized.filter((t) => String(t.date || '') >= fromIso);

    const sum = (arr) => arr.reduce((a, n) => a + (Number(n) || 0), 0);
    const expenses = recent.filter((t) => t.type === 'Despesa');
    const incomes = recent.filter((t) => t.type === 'Receita');

    const totalExpense = sum(expenses.map((t) => Number(t.amount || 0)));
    const totalIncome = sum(incomes.map((t) => Number(t.amount || 0)));

    const groupSum = (items, keyFn) => {
      const m = new Map();
      for (const it of items) {
        const k = String(keyFn(it) || '').trim() || 'Sem';
        m.set(k, (m.get(k) || 0) + Number(it.amount || 0));
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };

    const byCategory = groupSum(expenses, (t) => t.category || 'Sem categoria').slice(0, 5);
    const byAccount = groupSum(expenses, (t) => t.account || 'Sem conta').slice(0, 4);

    const sample = recent
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 40)
      .map((t) => ({
        date: t.date,
        name: t.name,
        type: t.type,
        account: t.account,
        category: t.category,
        paymentMethod: t.paymentMethod,
        amount: Number(t.amount || 0),
      }));

    const apiKey = process.env.OPENAI_KEY;
    if (!apiKey) return res.status(409).json({ ok: false, error: 'OPENAI_KEY não configurada.', requestId });

    const prompt = [
      'Você é o Nicco IA, assistente financeiro do usuário.',
      'Gere UM insight curto e útil em português (1 a 3 frases), baseado nos últimos 30 dias.',
      'Seja específico (cite conta/categoria) e sugira uma ação simples.',
      'Não invente dados. Se faltar dado, assuma pouco e diga isso.',
      '',
      `Resumo (30d): receita=${totalIncome.toFixed(2)} despesa=${totalExpense.toFixed(2)} transacoes=${recent.length}.`,
      `Top categorias (despesa): ${byCategory.map(([k, v]) => `${k}:${v.toFixed(2)}`).join(' | ') || '—'}`,
      `Top contas (despesa): ${byAccount.map(([k, v]) => `${k}:${v.toFixed(2)}`).join(' | ') || '—'}`,
      'Amostra de transações recentes (máx 40):',
      JSON.stringify(sample),
    ].join('\n');

    const r = await openAiText({
      apiKey,
      requestId,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Responda apenas com o insight (texto puro), sem markdown.' },
        { role: 'user', content: prompt },
      ],
      maxOutputTokens: 220,
    });

    const text = String(r?.text || '').trim();
    logger.info('ai_insight_generated', { requestId, chars: text.length, txCount: recent.length });
    res.json({ ok: true, insight: { text, windowDays: 30, generatedAt: new Date().toISOString() } });
  } catch (e) {
    next(e);
  }
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
