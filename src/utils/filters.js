export const defaultFilters = () => ({
  // Importante: para enxergar "saldo real do momento" (carteira),
  // o filtro padrão não deve cortar o histórico (senão o saldo reinicia todo mês).
  // Deixamos o início em branco (sem limite inferior) e mantemos o fim como hoje.
  startDate: '',
  endDate: new Date().toISOString().slice(0, 10),
  category: '', subcategory: '', account: '', type: '', status: '', search: '',
});

export const mtdFilters = () => ({
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  category: '', subcategory: '', account: '', type: '', status: '', search: '',
});

function fmt(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export const filterChip = (f) => {
  const period = f.startDate
    ? `${fmt(f.startDate)} até ${fmt(f.endDate)}`
    : f.endDate
      ? `Até ${fmt(f.endDate)}`
      : '';
  return [period, f.account, f.category].filter(Boolean).join(' · ');
};
