export const defaultFilters = () => ({
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  category: '', subcategory: '', account: '', type: '', status: '', search: '',
});
export const filterChip = (f) => [f.startDate && `${f.startDate.slice(8,10)}/${f.startDate.slice(5,7)}/${f.startDate.slice(0,4)} até ${f.endDate.slice(8,10)}/${f.endDate.slice(5,7)}/${f.endDate.slice(0,4)}`, f.account, f.category].filter(Boolean).join(' · ');
