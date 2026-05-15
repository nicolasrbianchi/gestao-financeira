export function buildInsights(tx, summaryCards) {
  const totalsByCategory = {};

  tx.filter((t) => t.type === 'Despesa').forEach((t) => {
    const key = t.category || 'Sem categoria';
    totalsByCategory[key] = (totalsByCategory[key] || 0) + t.amount;
  });

  const [topCategory, topValue] =
    Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1])[0] || ['Sem dados', 0];

  return [
    {
      title: 'Maior categoria do período',
      description: `${topCategory} concentrou os gastos.`,
      type: 'info',
      value: topValue,
    },
    {
      title: 'Saldo do período',
      description: 'Receitas - despesas - reservas líquidas.',
      type: summaryCards.saldo >= 0 ? 'success' : 'warning',
      value: summaryCards.saldo,
    },
    {
      title: 'Total de despesas',
      description: 'Total de despesas filtradas.',
      type: 'warning',
      value: summaryCards.despesas,
    },
  ];
}
