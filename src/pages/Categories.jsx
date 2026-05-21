import React, { useMemo } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Label } from 'recharts';
import { ArrowDownRight, Landmark, Layers3, Tags } from 'lucide-react';
import { money } from '../utils/format';

// Paleta mais separada (boa leitura em dark) + cor de marca.
const COLORS = [
  '#f2d58b', // brand champagne
  '#34d399', // emerald
  '#fb7185', // rose
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#f59e0b', // amber
  '#60a5fa', // blue
  '#f472b6', // pink
  '#f97316', // orange
  '#2dd4bf', // teal
  '#cbd5e1', // slate-300
  '#84cc16', // lime
  '#e879f9', // fuchsia
  '#d6b25e', // deeper gold
];

function hashString(value = '') {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function colorForLabel(label = '') {
  const key = String(label || '').trim().toLowerCase();
  const idx = hashString(key) % COLORS.length;
  return COLORS[idx];
}

function totalOf(items = []) {
  return items.reduce((sum, item) => sum + Math.abs(item.value || 0), 0);
}

function PercentList({ title, icon: Icon, items = [], total, onSelect }) {
  return (
    <section className='rounded-4xl bg-white p-5 shadow-soft'>
      <div className='mb-4 flex items-center justify-between'>
        <div>
          <h2 className='text-base font-bold text-slate-900'>{title}</h2>
          <p className='text-xs text-slate-500'>{items.length ? `${items.length} grupo(s)` : 'Sem dados'}</p>
        </div>
        <span className='grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-indigo-500'>{Icon && <Icon size={18} />}</span>
      </div>
      {items.length ? (
        <div className='space-y-3'>
          {items.slice(0, 8).map((item, index) => {
            const percent = total ? (Math.abs(item.value || 0) / total) * 100 : 0;
            const barColor = colorForLabel(item.name || String(index));
            return (
              <article key={item.name || index}>
                <div className='mb-2 flex min-w-0 items-center justify-between gap-3'>
                  <button
                    type='button'
                    onClick={() => onSelect?.(item?.name)}
                    className='min-w-0 truncate text-left text-sm font-semibold text-slate-800'
                    title={item.name || ''}
                  >
                    {item.name || 'Sem preenchimento'}
                  </button>
                  <p className='shrink-0 text-xs font-bold text-slate-500'>{percent.toFixed(1)}%</p>
                </div>
                <div className='progress'><span style={{ width: `${Math.min(percent, 100)}%`, background: barColor }} /></div>
                <p className='mt-1 text-xs font-bold text-slate-500'>{money(item.value || 0)}</p>
              </article>
            );
          })}
        </div>
      ) : (
        <div className='empty-state shadow-none'>Nada para mostrar neste período.</div>
      )}
    </section>
  );
}

export default function Categories({ data, loading, filters, setFilters, onGoTransactions }) {
  const byCategory = data?.byCategory || [];
  const bySubcategory = data?.bySubcategory || [];
  const byAccount = data?.byAccount || [];
  const expensesByCategory = data?.expensesByCategory || [];
  const expensesBySubcategory = data?.expensesBySubcategory || [];
  const expensesByAccount = data?.expensesByAccount || [];
  const topTransactions = data?.topTransactions || [];
  const dailySeries = data?.charts?.dailySeries || [];

  const subcategoryItems = useMemo(
    () => (expensesBySubcategory.length ? expensesBySubcategory : bySubcategory),
    [expensesBySubcategory, bySubcategory]
  );
  const accountItems = useMemo(
    () => (expensesByAccount.length ? expensesByAccount : byAccount),
    [expensesByAccount, byAccount]
  );

  const expenseTotal = totalOf(expensesByCategory);
  const topExpense = expensesByCategory[0];
  const topAccount = expensesByAccount[0];

  // (mantemos dailySeries no payload pra evoluções futuras)

  const highlights = useMemo(() => {
    const top3 = expenseTotal ? expensesByCategory.slice(0, 3).reduce((a, c) => a + Math.abs(c.value || 0), 0) : 0;
    const top3Share = expenseTotal && top3 ? (top3 / expenseTotal) * 100 : null;
    const topCat = topExpense?.name || null;
    const topCatValue = topExpense?.value || null;
    const topAcc = topAccount?.name || null;
    const topAccValue = topAccount?.value || null;
    return {
      top3Share,
      topCat,
      topCatValue,
      topAcc,
      topAccValue,
    };
  }, [expenseTotal, expensesByCategory, topExpense, topAccount]);

  if (loading && !data) return <div className='loading-state'>Carregando categorias…</div>;

  return (
    <div className='space-y-4'>
      <header className='px-1'>
        <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Análise</p>
        <h1 className='text-2xl font-bold text-slate-900'>Categorias</h1>
        <p className='mt-1 text-sm text-slate-500'>Entenda onde o dinheiro está indo.</p>
      </header>

      {loading && data && <div className='rounded-3xl bg-indigo-50 p-3 text-center text-xs font-semibold text-indigo-600'>Atualizando…</div>}

      {/* Layout mais clean: 1 card principal (donut + lista top 8). */}
      <section className='rounded-4xl bg-white p-5 shadow-soft'>
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h2 className='text-base font-bold text-slate-900'>Mapa</h2>
            <p className='text-sm text-slate-500'>{expensesByCategory.length ? 'Top categorias (despesas reais).' : 'Sem dados no período.'}</p>
          </div>
          {topAccount && <span className='badge'>Canal top: {topAccount.name}</span>}
        </div>

        <div className='grid gap-4'>
          <div className='h-[200px]'>
            {expensesByCategory.length ? (
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie data={expensesByCategory.slice(0, 8)} dataKey='value' nameKey='name' innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {expensesByCategory.slice(0, 8).map((entry, index) => (
                      <Cell key={entry.name || index} fill={colorForLabel(entry.name || String(index))} />
                    ))}
                    <Label
                      position='center'
                      content={() => (
                        <text x='50%' y='50%' textAnchor='middle' dominantBaseline='middle' fill='#e2e8f0'>
                          <tspan x='50%' dy='-0.25em' fontSize='12'>Total</tspan>
                          <tspan x='50%' dy='1.25em' fontSize='14' fontWeight='800'>
                            {money(expenseTotal || 0)}
                          </tspan>
                        </text>
                      )}
                    />
                  </Pie>
                  <Tooltip formatter={(value) => money(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className='grid h-full place-items-center text-sm text-slate-400'>Sem gráfico disponível.</div>
            )}
          </div>

          <div className='space-y-3'>
            {expensesByCategory.slice(0, 8).map((item, index) => {
              const percent = expenseTotal ? (Math.abs(item.value || 0) / expenseTotal) * 100 : 0;
              const barColor = colorForLabel(item.name || String(index));
              return (
                <article key={item.name || index}>
                  <div className='mb-2 flex min-w-0 items-center justify-between gap-3'>
                    <button
                      type='button'
                      onClick={() => {
                        if (!item?.name) return;
                        setFilters?.({ ...(filters || {}), category: item.name });
                        onGoTransactions?.();
                      }}
                      className='min-w-0 truncate text-left text-sm font-semibold text-slate-800'
                      title={item.name || ''}
                    >
                      {item.name || 'Sem preenchimento'}
                    </button>
                    <p className='shrink-0 text-xs font-bold text-slate-500'>{percent.toFixed(1)}%</p>
                  </div>
                  <div className='progress'><span style={{ width: `${Math.min(percent, 100)}%`, background: barColor }} /></div>
                  <p className='mt-1 text-xs font-bold text-slate-500'>{money(item.value || 0)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Resumo compacto (substitui insights/blocos soltos) */}
      <section className='grid grid-cols-2 gap-3'>
        <article className='rounded-4xl bg-white p-4 shadow-soft'>
          <ArrowDownRight className='text-rose-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Despesas reais</p>
          <p className='mt-1 break-words text-xl font-bold'>{money(expenseTotal)}</p>
        </article>
        <article className='rounded-4xl bg-white p-4 shadow-soft'>
          <Tags className='text-indigo-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Top 3 categorias</p>
          <p className='mt-1 break-words text-xl font-bold'>{highlights.top3Share == null ? '—' : `${highlights.top3Share.toFixed(1)}%`}</p>
        </article>
      </section>

      {(highlights.topCat || highlights.topAcc) && (
        <section className='rounded-4xl bg-white p-5 shadow-soft'>
          <div className='grid grid-cols-1 gap-3'>
            {highlights.topCat && (
              <div className='flex items-center justify-between gap-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10'>
                <div className='min-w-0'>
                  <p className='text-xs font-semibold text-slate-500'>Top categoria</p>
                  <p className='mt-1 truncate text-sm font-extrabold text-slate-100'>{highlights.topCat}</p>
                </div>
                {highlights.topCatValue != null && <p className='shrink-0 text-sm font-extrabold text-rose-200'>-{money(highlights.topCatValue)}</p>}
              </div>
            )}
            {highlights.topAcc && (
              <div className='flex items-center justify-between gap-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10'>
                <div className='min-w-0'>
                  <p className='text-xs font-semibold text-slate-500'>Top conta/canal</p>
                  <p className='mt-1 truncate text-sm font-extrabold text-slate-100'>{highlights.topAcc}</p>
                </div>
                {highlights.topAccValue != null && <p className='shrink-0 text-sm font-extrabold text-rose-200'>-{money(highlights.topAccValue)}</p>}
              </div>
            )}
          </div>
        </section>
      )}

      <PercentList
        title='Essencial vs Extra'
        icon={Layers3}
        items={subcategoryItems}
        total={totalOf(subcategoryItems)}
        onSelect={(name) => {
          if (!name) return;
          setFilters?.({ ...(filters || {}), subcategory: name });
          onGoTransactions?.();
        }}
      />
      <PercentList
        title='Contas Bancarias'
        icon={Landmark}
        items={accountItems}
        total={totalOf(accountItems)}
        onSelect={(name) => {
          if (!name) return;
          setFilters?.({ ...(filters || {}), account: name });
          onGoTransactions?.();
        }}
      />

      {topTransactions.length > 0 && (
        <section className='rounded-4xl bg-white p-5 shadow-soft'>
          <div className='mb-4 flex items-center justify-between gap-3'>
            <div>
              <h2 className='text-base font-bold text-slate-900'>Maiores despesas</h2>
              <p className='text-xs text-slate-500'>Top lançamentos por valor.</p>
            </div>
            <span className='grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-rose-500'><ArrowDownRight size={18} /></span>
          </div>
          <div className='space-y-3'>
            {topTransactions.slice(0, 8).map((t, idx) => (
              <article key={`${t.sheetRowNumber || idx}-${idx}`} className='rounded-3xl bg-white/5 p-4 ring-1 ring-white/10'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-bold text-slate-100'>{t.name || 'Sem nome'}</p>
                    <p className='mt-1 truncate text-xs text-slate-400'>{t.displayDate || t.date || ''}{t.account ? ` · ${t.account}` : ''}</p>
                    {t.category && <p className='mt-1 truncate text-xs text-slate-400'>Categoria: {t.category}</p>}
                  </div>
                  <p className='shrink-0 text-sm font-extrabold text-rose-200'>-{money(Math.abs(t.amount || 0))}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
