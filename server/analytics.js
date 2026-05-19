import { buildInsights } from './insights.js';
import { normalizeStringKey } from './normalize.js';
import { logger } from './logger.js';

export function filterTx(transactions, f = {}, context = {}) {
  const filtered = transactions.filter((t) => (!f.startDate || t.date >= f.startDate) && (!f.endDate || t.date <= f.endDate) && (!f.category || t.category === f.category) && (!f.subcategory || t.subcategory === f.subcategory) && (!f.account || t.account === f.account) && (!f.type || t.type === f.type) && (!f.status || t.status === f.status) && (!f.search || normalizeStringKey(t.name).includes(normalizeStringKey(f.search))));
  logger.debug('transactions_filter_completed', { requestId: context.requestId, sourceCount: transactions.length, filteredCount: filtered.length, filters: { ...f, search: f.search ? "[SET]" : "" } });
  return filtered;
}

const groupBy = (items, getter) => Object.entries(items.reduce((acc, item) => { const key = getter(item) || 'Sem preenchimento'; acc[key] = (acc[key] || 0) + item.amount; return acc; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

export function buildDashboard(transactions, context = {}) {
  const receitas = transactions.filter((t) => normalizeStringKey(t.type) === 'receita').reduce((a, t) => a + t.amount, 0);
  const totalDespesas = transactions.filter((t) => normalizeStringKey(t.type) === 'despesa').reduce((a, t) => a + t.amount, 0);
  const reservasEntrada = transactions.filter((t) => normalizeStringKey(t.type) === 'reserva' && normalizeStringKey(t.reserve) === 'entrada').reduce((a, t) => a + t.amount, 0);
  const reservasSaida = transactions.filter((t) => normalizeStringKey(t.type) === 'reserva' && normalizeStringKey(t.reserve).startsWith('saida')).reduce((a, t) => a + t.amount, 0);
  const saldoOperacional = receitas - totalDespesas;
  const saldoComReservas = receitas - totalDespesas + reservasEntrada - reservasSaida;

  const totalPorTipo = groupBy(transactions, (t) => t.type);
  const totalPorStatus = groupBy(transactions, (t) => t.status);
  const totalPorConta = groupBy(transactions, (t) => t.account);
  const totalPorCategoria = groupBy(transactions, (t) => t.category);
  const totalPorSubcategoria = groupBy(transactions, (t) => t.subcategory);
  const expenseTransactions = transactions.filter((t) => normalizeStringKey(t.type) === 'despesa');
  const despesasPorCategoria = groupBy(expenseTransactions, (t) => t.category);
  const despesasPorSubcategoria = groupBy(expenseTransactions, (t) => t.subcategory);
  const despesasPorConta = groupBy(expenseTransactions, (t) => t.account);

  const dailyMap = {};
  for (const t of transactions) {
    if (!dailyMap[t.date]) dailyMap[t.date] = { date: t.date, receitas: 0, despesas: 0, reservas: 0 };
    const type = normalizeStringKey(t.type);
    if (type === 'receita') dailyMap[t.date].receitas += t.amount;
    if (type === 'despesa') dailyMap[t.date].despesas += t.amount;
    if (type === 'reserva') dailyMap[t.date].reservas += t.amount;
  }
  const serieDiaria = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  const recentTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.sheetRowNumber - a.sheetRowNumber).slice(0, 10);
  const topTransactions = [...transactions].sort((a, b) => b.amount - a.amount).slice(0, 10);

  const totals = { receitas, despesas: totalDespesas, reservasEntrada, reservasSaida, saldoOperacional, saldoComReservas };
  const groups = { despesasPorCategoria, despesasPorSubcategoria, despesasPorConta };

  logger.debug('dashboard_build_completed', { requestId: context.requestId, transactionCount: transactions.length, insightsCount: buildInsights(transactions, totals, groups).length });
  return {
    summaryCards: [
      { key: 'receitas', title: 'Receitas', value: receitas, tone: 'success', helper: 'Entradas no período' },
      { key: 'despesas', title: 'Despesas', value: totalDespesas, tone: 'danger', helper: 'Saídas no período' },
      { key: 'saldoOperacional', title: 'Saldo Operacional', value: saldoOperacional, tone: saldoOperacional >= 0 ? 'success' : 'danger', helper: 'Receitas - Despesas' },
      { key: 'reservas', title: 'Reservas', value: reservasEntrada - reservasSaida, tone: 'info', helper: 'Entradas - saídas de reserva' },
    ],
    totals,
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
