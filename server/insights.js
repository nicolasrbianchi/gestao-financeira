import { normalizeStringKey } from './normalize.js';

export function buildInsights(transactions, totals, groups) {
  const insights = [];
  const expenseTx = transactions.filter((t) => normalizeStringKey(t.type) === 'despesa');
  const maxCategory = (groups.despesasPorCategoria || [])[0];
  if (maxCategory) insights.push({ id: 'top-category', title: 'Maior categoria de despesa', description: `${maxCategory.name} lidera os gastos no período.`, type: 'info', value: maxCategory.value });

  const maxAccount = (groups.despesasPorConta || [])[0];
  if (maxAccount) insights.push({ id: 'top-account', title: 'Conta/canal com mais despesa', description: `${maxAccount.name} concentrou maior saída financeira.`, type: 'warning', value: maxAccount.value });

  const uniqueDays = new Set(expenseTx.map((t) => t.date)).size || 1;
  const avgDaily = totals.despesas / uniqueDays;
  insights.push({ id: 'avg-daily', title: 'Média diária de despesa', description: 'Despesa média por dia com movimentação.', type: 'info', value: avgDaily });

  const topTx = [...transactions].sort((a, b) => b.amount - a.amount)[0];
  if (topTx) insights.push({ id: 'top-tx', title: 'Maior transação do período', description: `${topTx.name} (${topTx.displayDate}).`, type: 'success', value: topTx.amount });

  const ess = expenseTx.filter((t) => normalizeStringKey(t.subcategory) === 'essencial').reduce((a, t) => a + t.amount, 0);
  const extra = expenseTx.filter((t) => normalizeStringKey(t.subcategory) === 'extra').reduce((a, t) => a + t.amount, 0);
  if (ess + extra > 0) insights.push({ id: 'ess-vs-extra', title: 'Essencial vs Extra', description: 'Distribuição por subcategoria de despesas.', type: ess >= extra ? 'success' : 'warning', value: `${((ess / (ess + extra)) * 100).toFixed(1)}% Essencial / ${((extra / (ess + extra)) * 100).toFixed(1)}% Extra` });

  const lateCount = transactions.filter((t) => normalizeStringKey(t.status).includes('atraso')).length;
  if (lateCount) insights.push({ id: 'late', title: 'Atenção para atrasos', description: `Há ${lateCount} transações em atraso.`, type: 'danger', value: lateCount, actionLabel: 'Revisar pagamentos' });

  const installments = transactions.filter((t) => t.installment).length;
  if (installments) insights.push({ id: 'installments', title: 'Transações parceladas detectadas', description: `${installments} lançamentos com parcela preenchida.`, type: 'warning', value: installments });

  if (totals.reservasSaida > totals.reservasEntrada) insights.push({ id: 'reserve-out', title: 'Saída de reservas acima da entrada', description: 'Suas reservas estão reduzindo no período.', type: 'danger', value: totals.reservasSaida - totals.reservasEntrada });

  const transfer = transactions.filter((t) => normalizeStringKey(t.category) === 'transferencia entre contas').reduce((a, t) => a + t.amount, 0);
  if (transfer > 0) insights.push({ id: 'transfer', title: 'Transferências entre contas', description: 'Movimentações internas identificadas.', type: 'info', value: transfer });

  return insights;
}
