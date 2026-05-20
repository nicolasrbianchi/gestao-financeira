import { buildInsights } from './insights.js';
import { normalizeStringKey } from './normalize.js';
import { logger } from './logger.js';

const TRANSFER_CATEGORY_KEY = 'transferencia entre contas';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const typeKey = (tx) => normalizeStringKey(tx.type);
const reserveKey = (tx) => normalizeStringKey(tx.reserve);
const categoryKey = (tx) => normalizeStringKey(tx.category);

export function isTransfer(tx) {
  return categoryKey(tx) === TRANSFER_CATEGORY_KEY;
}

const isType = (tx, type) => typeKey(tx) === type;
const isRealIncome = (tx) => isType(tx, 'receita') && !isTransfer(tx);
const isRealExpense = (tx) => isType(tx, 'despesa') && !isTransfer(tx);
const isTransferIn = (tx) => isType(tx, 'receita') && isTransfer(tx);
const isTransferOut = (tx) => isType(tx, 'despesa') && isTransfer(tx);
const isBalance = (tx) => isType(tx, 'saldo');
const isReserveIn = (tx) => isType(tx, 'reserva') && reserveKey(tx) === 'entrada';
const isReserveOut = (tx) => isType(tx, 'reserva') && reserveKey(tx).startsWith('saida');
const sum = (items) => items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

export function filterTx(transactions, f = {}, context = {}) {
  const filtered = transactions.filter((t) => (!f.startDate || t.date >= f.startDate) && (!f.endDate || t.date <= f.endDate) && (!f.category || t.category === f.category) && (!f.subcategory || t.subcategory === f.subcategory) && (!f.account || t.account === f.account) && (!f.type || t.type === f.type) && (!f.status || t.status === f.status) && (!f.search || normalizeStringKey(t.name).includes(normalizeStringKey(f.search))));
  logger.debug('transactions_filter_completed', { requestId: context.requestId, sourceCount: transactions.length, filteredCount: filtered.length, filters: { ...f, search: f.search ? '[SET]' : '' } });
  return filtered;
}

const groupBy = (items, getter) => Object.entries(items.reduce((acc, item) => { const key = getter(item) || 'Sem preenchimento'; acc[key] = (acc[key] || 0) + item.amount; return acc; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

function toDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function inferGoalMonth(filters = {}) {
  const start = toDate(filters.startDate) || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 12));
  const end = toDate(filters.endDate) || new Date();
  const safeStart = start <= end ? start : end;
  const safeEnd = start <= end ? end : start;
  const monthDays = new Map();

  let cursor = new Date(Date.UTC(safeStart.getUTCFullYear(), safeStart.getUTCMonth(), 1, 12));
  const lastMonth = new Date(Date.UTC(safeEnd.getUTCFullYear(), safeEnd.getUTCMonth(), 1, 12));

  while (cursor <= lastMonth) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const rangeStart = new Date(Date.UTC(year, month, 1, 12));
    const rangeEnd = new Date(Date.UTC(year, month, daysInMonth(year, month), 12));
    const overlapStart = safeStart > rangeStart ? safeStart : rangeStart;
    const overlapEnd = safeEnd < rangeEnd ? safeEnd : rangeEnd;
    const days = Math.max(0, Math.floor((overlapEnd - overlapStart) / ONE_DAY_MS) + 1);
    monthDays.set(monthKey(cursor), days);
    cursor = new Date(Date.UTC(year, month + 1, 1, 12));
  }

  return [...monthDays.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] || monthKey(safeEnd);
}

function normalizeGoals(monthlyGoals) {
  if (!monthlyGoals) return {};
  if (Array.isArray(monthlyGoals)) return Object.fromEntries(monthlyGoals.map((item) => [item.month, Number(item.value || item.goal || 0)]).filter(([key, value]) => key && Number.isFinite(value)));
  return Object.fromEntries(Object.entries(monthlyGoals).map(([key, value]) => [key, Number(value || 0)]).filter(([, value]) => Number.isFinite(value)));
}

function buildGoal(realExpenses, filters, monthlyGoals) {
  const targetMonth = inferGoalMonth(filters);
  const goals = normalizeGoals(monthlyGoals);
  const value = goals[targetMonth] || 0;
  const remaining = value ? value - realExpenses : null;
  const usedPercent = value ? realExpenses / value : null;
  const status = !value ? 'Sem meta' : usedPercent > 1 ? 'Passou da meta' : usedPercent >= 0.8 ? 'Atenção' : 'Sob controle';
  return { month: targetMonth, value, spent: realExpenses, remaining, usedPercent, status };
}

function buildAccountBreakdown(transactions) {
  const map = new Map();
  const keyOf = (account) => account || 'Sem conta';
  const orderKey = (tx) => `${tx.date || ''}#${String(tx.sheetRowNumber || 0).padStart(8, '0')}`;

  const byAccount = transactions.reduce((acc, tx) => {
    const key = keyOf(tx.account);
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  for (const [accountKey, items] of Object.entries(byAccount)) {
    const sorted = items.slice().sort((a, b) => orderKey(a).localeCompare(orderKey(b)));

    // Regra (importante): "Saldo" funciona como SNAPSHOT.
    // Pegamos o último Saldo e calculamos o resto a partir dele, evitando somar histórico + snapshot (duplo-count).
    const lastSaldo = [...sorted].reverse().find((t) => isBalance(t));
    const cutoff = lastSaldo ? orderKey(lastSaldo) : null;
    const stream = cutoff ? sorted.filter((t) => orderKey(t) > cutoff) : sorted;

    const row = {
      account: accountKey,
      saldoInicial: lastSaldo ? Number(lastSaldo.amount) || 0 : 0,
      receitas: 0,
      transferenciasEntrada: 0,
      despesas: 0,
      transferenciasSaida: 0,
      reservasEntrada: 0,
      reservasSaida: 0,
      saldoDisponivel: 0,
      reservaAtual: 0,
      _saldoSnapshotAt: lastSaldo ? lastSaldo.date : null,
    };

    for (const tx of stream) {
      const amount = Number(tx.amount) || 0;
      if (isRealIncome(tx)) row.receitas += amount;
      if (isTransferIn(tx)) row.transferenciasEntrada += amount;
      if (isRealExpense(tx)) row.despesas += amount;
      if (isTransferOut(tx)) row.transferenciasSaida += amount;
      if (isReserveIn(tx)) row.reservasEntrada += amount;
      if (isReserveOut(tx)) row.reservasSaida += amount;
    }

    row.reservaAtual = row.reservasEntrada - row.reservasSaida;
    row.saldoDisponivel = row.saldoInicial + row.receitas + row.transferenciasEntrada + row.reservasSaida - row.despesas - row.transferenciasSaida - row.reservasEntrada;
    map.set(accountKey, row);
  }

  return [...map.values()].sort((a, b) => b.saldoDisponivel - a.saldoDisponivel);
}

export function buildDashboard(transactions, context = {}) {
  const toDate = Array.isArray(context.toDateTransactions) ? context.toDateTransactions : transactions;

  const receitas = sum(transactions.filter(isRealIncome));
  const transferenciasEntrada = sum(transactions.filter(isTransferIn));
  const saldoInicial = sum(transactions.filter(isBalance));
  const totalDespesas = sum(transactions.filter(isRealExpense));
  const transferenciasSaida = sum(transactions.filter(isTransferOut));
  const reservasEntrada = sum(transactions.filter(isReserveIn));
  const reservasSaida = sum(transactions.filter(isReserveOut));
  const reservaAtual = reservasEntrada - reservasSaida;

  // Regra: transferências entre contas NÃO contam como receita/despesa real,
  // mas afetam o caixa disponível (movimentação entre canais).
  // Então no saldo disponível global elas entram como: +transferIn - transferOut.
  // Saldo deve refletir "carteira" (histórico completo até o endDate),
  // não apenas o período filtrado da análise.
  const accountBreakdown = buildAccountBreakdown(toDate);

  // Saldo disponível (carteira) deve ser a soma dos saldos por conta/canal.
  // Isso permite o uso de "Saldo" como snapshot de reconciliação (último Saldo por conta).
  const saldoDisponivel = sum(accountBreakdown.map((a) => ({ amount: a.saldoDisponivel })));

  // Debug/uso futuro: mantendo os agregados antigos do "toDate".
  const receitasToDate = sum(toDate.filter(isRealIncome));
  const transferenciasEntradaToDate = sum(toDate.filter(isTransferIn));
  const saldoInicialToDate = sum(toDate.filter(isBalance));
  const despesasToDate = sum(toDate.filter(isRealExpense));
  const transferenciasSaidaToDate = sum(toDate.filter(isTransferOut));
  const reservasEntradaToDate = sum(toDate.filter(isReserveIn));
  const reservasSaidaToDate = sum(toDate.filter(isReserveOut));
  const reservaAtualToDate = reservasEntradaToDate - reservasSaidaToDate;
  const meta = buildGoal(totalDespesas, context.filters, context.monthlyGoals);

  const totalPorTipo = groupBy(transactions, (t) => t.type);
  const totalPorStatus = groupBy(transactions, (t) => t.status);
  const totalPorConta = groupBy(transactions, (t) => t.account);
  const realExpenseTransactions = transactions.filter(isRealExpense);
  const categoryTransactions = transactions.filter((t) => isRealExpense(t) || isRealIncome(t));
  const totalPorCategoria = groupBy(categoryTransactions, (t) => t.category);
  const totalPorSubcategoria = groupBy(categoryTransactions, (t) => t.subcategory);
  const despesasPorCategoria = groupBy(realExpenseTransactions, (t) => t.category);
  const despesasPorSubcategoria = groupBy(realExpenseTransactions, (t) => t.subcategory);
  const despesasPorConta = groupBy(realExpenseTransactions, (t) => t.account);
  // accountBreakdown calculado acima (snapshot-aware)

  const dailyMap = {};
  for (const t of transactions) {
    if (!dailyMap[t.date]) dailyMap[t.date] = { date: t.date, receitas: 0, despesas: 0, reservasEntrada: 0, reservasSaida: 0, saldo: 0 };
    if (isRealIncome(t)) dailyMap[t.date].receitas += t.amount;
    if (isRealExpense(t)) dailyMap[t.date].despesas += t.amount;
    if (isReserveIn(t)) dailyMap[t.date].reservasEntrada += t.amount;
    if (isReserveOut(t)) dailyMap[t.date].reservasSaida += t.amount;
    if (isBalance(t)) dailyMap[t.date].saldo += t.amount;
  }
  const serieDiariaRaw = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // `dailySeries` é usado no gráfico da Home: queremos o saldo disponível acumulado ao longo dos dias.
  // Fórmula: saldo += (receitas + saldo + reservasSaida) - (despesas + reservasEntrada)
  let running = 0;
  const serieDiaria = serieDiariaRaw.map((day) => {
    const delta = (day.receitas || 0) + (day.saldo || 0) + (day.reservasSaida || 0) - (day.despesas || 0) - (day.reservasEntrada || 0);
    running += delta;
    return { ...day, delta, runningSaldoDisponivel: running };
  });

  const recentTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.sheetRowNumber - a.sheetRowNumber).slice(0, 10);
  const topTransactions = [...realExpenseTransactions].sort((a, b) => b.amount - a.amount).slice(0, 10);

  const totals = {
    receitas,
    despesas: totalDespesas,
    saldoInicial,
    transferenciasEntrada,
    transferenciasSaida,
    reservasEntrada,
    reservasSaida,
    reservaAtual,
    // Carteira (até hoje)
    saldoDisponivel,
    saldoOperacional: saldoDisponivel,
    saldoComReservas: saldoDisponivel,
    // (debug/uso futuro)
    _toDate: {
      receitas: receitasToDate,
      despesas: despesasToDate,
      saldoInicial: saldoInicialToDate,
      transferenciasEntrada: transferenciasEntradaToDate,
      transferenciasSaida: transferenciasSaidaToDate,
      reservasEntrada: reservasEntradaToDate,
      reservasSaida: reservasSaidaToDate,
      reservaAtual: reservaAtualToDate,
    },
  };
  const groups = { despesasPorCategoria, despesasPorSubcategoria, despesasPorConta };

  logger.debug('dashboard_build_completed', { requestId: context.requestId, transactionCount: transactions.length, goalMonth: meta.month, goalValue: meta.value, accountCount: accountBreakdown.length, insightsCount: buildInsights(transactions, totals, groups).length });
  return {
    summaryCards: [
      { key: 'saldoDisponivel', title: 'Saldo disponível', value: saldoDisponivel, tone: saldoDisponivel >= 0 ? 'success' : 'danger', helper: 'Receitas + saldo ± transferências ± reservas - despesas' },
      { key: 'receitas', title: 'Receitas reais', value: receitas, tone: 'success', helper: 'Sem transferências entre contas' },
      { key: 'despesas', title: 'Despesas reais', value: totalDespesas, tone: 'danger', helper: 'Usadas na meta do mês' },
      { key: 'reservas', title: 'Reservas', value: reservaAtual, tone: 'info', helper: 'Entradas - saídas de reserva' },
      { key: 'saldoInicial', title: 'Saldo lançado', value: saldoInicial, tone: 'info', helper: 'Sobra carregada no período' },
    ],
    totals,
    meta,
    accountBreakdown,
    charts: {
      incomeExpense: [{ name: 'Receitas', value: receitas }, { name: 'Despesas', value: totalDespesas }],
      expensesByCategory: despesasPorCategoria,
      expensesBySubcategory: despesasPorSubcategoria,
      expensesByAccount: despesasPorConta,
      dailySeries: serieDiaria,
      totalsByType: totalPorTipo,
      totalsByStatus: totalPorStatus,
    },
    totalPorTipo,
    totalPorStatus,
    totalPorConta,
    totalPorCategoria,
    totalPorSubcategoria,
    despesasPorCategoria,
    despesasPorSubcategoria,
    despesasPorConta,
    recentTransactions,
    topTransactions,
    insights: buildInsights(transactions, totals, groups),
  };
}
