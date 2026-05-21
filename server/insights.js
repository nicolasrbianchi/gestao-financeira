import { normalizeStringKey } from './normalize.js';

export function buildInsights(transactions, totals, groups) {
  const insights = [];
  const expenseTx = transactions.filter((t) => normalizeStringKey(t.type) === 'despesa' && normalizeStringKey(t.category) !== 'transferencia entre contas');
  const maxCategory = (groups.despesasPorCategoria || [])[0];
  if (maxCategory) insights.push({ id: 'top-category', title: 'Maior categoria de despesa', description: `${maxCategory.name} lidera os gastos no período.`, type: 'info', value: maxCategory.value });

  // Concentração: quanto do gasto está nas top categorias.
  const totalExpenses = totals?.despesas || 0;
  if (totalExpenses > 0 && Array.isArray(groups?.despesasPorCategoria) && groups.despesasPorCategoria.length) {
    const top1 = groups.despesasPorCategoria[0]?.value || 0;
    const top3 = groups.despesasPorCategoria.slice(0, 3).reduce((a, c) => a + (c.value || 0), 0);
    const pct1 = (top1 / totalExpenses) * 100;
    const pct3 = (top3 / totalExpenses) * 100;
    insights.push({
      id: 'concentration',
      title: 'Concentração de gastos',
      description: `Top 1 = ${pct1.toFixed(1)}% · Top 3 = ${pct3.toFixed(1)}% das despesas.`,
      type: pct3 >= 70 ? 'warning' : 'info',
      value: { pctTop1: pct1, pctTop3: pct3 },
    });
  }

  const maxAccount = (groups.despesasPorConta || [])[0];
  if (maxAccount) insights.push({ id: 'top-account', title: 'Conta/canal com mais despesa', description: `${maxAccount.name} concentrou maior saída financeira.`, type: 'warning', value: maxAccount.value });

  const uniqueDays = new Set(expenseTx.map((t) => t.date)).size || 1;
  const avgDaily = totals.despesas / uniqueDays;
  insights.push({ id: 'avg-daily', title: 'Média diária de despesa', description: 'Despesa média por dia com movimentação.', type: 'info', value: avgDaily });

  // Dia mais caro
  if (expenseTx.length) {
    const byDay = expenseTx.reduce((acc, t) => {
      const key = t.date || 'Sem data';
      acc[key] = (acc[key] || 0) + (t.amount || 0);
      return acc;
    }, {});
    const topDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    if (topDay) {
      insights.push({
        id: 'top-day',
        title: 'Dia com mais despesas',
        description: `Maior saída em ${topDay[0]}.`,
        type: 'warning',
        value: { date: topDay[0], amount: topDay[1] },
      });
    }
  }

  const topTx = [...transactions].sort((a, b) => b.amount - a.amount)[0];
  if (topTx) insights.push({ id: 'top-tx', title: 'Maior transação do período', description: `${topTx.name} (${topTx.displayDate}).`, type: 'success', value: topTx.amount });

  // Recorrências (mesmo nome aparecendo várias vezes)
  const byName = expenseTx.reduce((acc, t) => {
    const key = normalizeStringKey(t.name);
    if (!key) return acc;
    if (!acc[key]) acc[key] = { name: t.name, count: 0, total: 0 };
    acc[key].count += 1;
    acc[key].total += t.amount || 0;
    return acc;
  }, {});
  const recurring = Object.values(byName).filter((x) => x.count >= 3).sort((a, b) => b.total - a.total).slice(0, 3);
  if (recurring.length) {
    insights.push({
      id: 'recurring',
      title: 'Possíveis recorrências',
      description: `${recurring.map((r) => `${r.name} (${r.count}x)`).join(' · ')}`,
      type: 'info',
      value: recurring,
    });
  }

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
