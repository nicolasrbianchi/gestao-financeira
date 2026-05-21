import express from 'express';
import { requireAuth } from './auth.js';
import * as client from './appsScriptClient.js';
import { normalizeTransactions, parseMoneyBR } from './normalize.js';
import { filterTx, buildDashboard } from './analytics.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { openAiText } from './openaiClient.js';
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
router.post('/auth/logout', (req, res) => {
  // cookie-session: limpar sessão no cookie
  req.session = null;
  logger.info('auth_logout', { requestId: req.requestId });
  res.json({ ok: true });
});

router.use(requireAuth);

const loadNormalizedTx = async (req) => {
  const raw = await client.getTransactions({ requestId: req.requestId });
  return normalizeTransactions(raw.transactions || [], { requestId: req.requestId });
};

// Para saldo "real" (carteira), queremos considerar todo o histórico até o endDate,
// mas mantendo filtros não-temporais (conta/tipo/status/etc.) quando informados.
const buildToDateQuery = (query = {}) => ({
  ...query,
  startDate: '',
});

router.get('/health', async (req, res, next) => {
  try {
    const appsScript = await client.health({ requestId: req.requestId });
    logger.info('health_checked', { requestId: req.requestId, appsScriptOk: !!appsScript?.ok });
    res.json({ ok: true, status: 'up', nodeEnv: process.env.NODE_ENV || 'development', uptime: process.uptime(), app: appInfo, appsScript: { ok: !!appsScript?.ok, mock: !!appsScript?.mock }, metadata: { ok: true }, timestamp: new Date().toISOString() });
  } catch (e) { next(e); }
});
router.get('/metadata', async (req, res, next) => { try { const d = await client.getMetadata({ requestId: req.requestId }); logger.info('metadata_loaded', { requestId: req.requestId, categories: d.categories?.length || 0 }); res.json(d); } catch (e) { next(e); } });

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
