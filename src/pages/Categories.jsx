import React, { useMemo } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Label } from 'recharts';
import { ArrowDownRight, Landmark, Layers3, Tags } from 'lucide-react';
import { money } from '../utils/format';

// Paleta premium (sem roxo neon). Primeiro tom = champagne do app.
const COLORS = ['#f2d58b', '#d6b25e', '#22c55e', '#fb7185', '#06b6d4', '#f59e0b', '#a3a3a3', '#efe2c9'];

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
                <div className='progress'><span style={{ width: `${Math.min(percent, 100)}%`, background: COLORS[index % COLORS.length] }} /></div>
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
  const insights = data?.insights || [];
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

  const dayWithMostExpense = useMemo(() => {
    const items = (dailySeries || []).filter(Boolean);
    if (!items.length) return null;
    const best = items
      .map((d) => ({ date: d.date, value: Number(d.despesas || 0) }))
      .sort((a, b) => b.value - a.value)[0];
    return best?.value ? best : null;
  }, [dailySeries]);

  const top3Share = useMemo(() => {
    if (!expenseTotal) return null;
    const top3 = expensesByCategory.slice(0, 3).reduce((a, c) => a + Math.abs(c.value || 0), 0);
    return top3 ? (top3 / expenseTotal) * 100 : null;
  }, [expenseTotal, expensesByCategory]);

  const insightTone = (type) => {
    if (type === 'danger') return { ring: 'ring-rose-400/20', icon: 'text-rose-300', title: 'text-slate-100', desc: 'text-slate-300' };
    if (type === 'warning') return { ring: 'ring-amber-300/20', icon: 'text-amber-200', title: 'text-slate-100', desc: 'text-slate-300' };
    if (type === 'success') return { ring: 'ring-emerald-400/20', icon: 'text-emerald-200', title: 'text-slate-100', desc: 'text-slate-300' };
    return { ring: 'ring-white/10', icon: 'text-[#f2d58b]', title: 'text-slate-100', desc: 'text-slate-300' };
  };

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
                    {expensesByCategory.slice(0, 8).map((entry, index) => <Cell key={entry.name || index} fill={COLORS[index % COLORS.length]} />)}
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
                  <div className='progress'><span style={{ width: `${Math.min(percent, 100)}%`, background: COLORS[index % COLORS.length] }} /></div>
                  <p className='mt-1 text-xs font-bold text-slate-500'>{money(item.value || 0)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

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

      {insights.length > 0 && (
        <section className='rounded-4xl bg-white p-5 shadow-soft'>
          <div className='mb-3 flex items-center justify-between gap-3'>
            <div>
              <h2 className='text-base font-bold text-slate-900'>Insights</h2>
              <p className='text-xs text-slate-500'>Leituras automáticas do período.</p>
            </div>
            <span className='grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-indigo-500'><Tags size={18} /></span>
          </div>
          <div className='space-y-3'>
            {insights.slice(0, 8).map((it, idx) => {
              const tone = insightTone(it?.type);
              const value = it?.value;
              const rightValue = typeof value === 'number'
                ? money(value)
                : typeof value === 'string'
                  ? value
                  : value?.amount
                    ? money(value.amount)
                    : null;

              return (
                <article key={it?.id || idx} className={`rounded-3xl bg-white/5 p-4 ring-1 ${tone.ring}`}>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <p className={`text-sm font-extrabold ${tone.title}`}>{it?.title || 'Insight'}</p>
                      {it?.description && <p className={`mt-1 text-xs ${tone.desc}`}>{it.description}</p>}
                    </div>
                    {rightValue && <p className='shrink-0 text-xs font-extrabold text-slate-100'>{rightValue}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Blocos extras (mais info rápida) */}
      <section className='grid grid-cols-2 gap-3'>
        <article className='rounded-4xl bg-white p-4 shadow-soft'>
          <ArrowDownRight className='text-rose-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Despesas reais</p>
          <p className='mt-1 break-words text-xl font-bold'>{money(expenseTotal)}</p>
        </article>
        <article className='rounded-4xl bg-white p-4 shadow-soft'>
          <Tags className='text-indigo-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Concentração (Top 3)</p>
          <p className='mt-1 break-words text-xl font-bold'>{top3Share == null ? '—' : `${top3Share.toFixed(1)}%`}</p>
        </article>
      </section>

      {dayWithMostExpense && (
        <section className='rounded-4xl bg-white p-5 shadow-soft'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <h2 className='text-base font-bold text-slate-900'>Dia mais caro</h2>
              <p className='text-xs text-slate-500'>{dayWithMostExpense.date}</p>
            </div>
            <p className='text-sm font-extrabold text-rose-200'>-{money(dayWithMostExpense.value)}</p>
          </div>
        </section>
      )}
    </div>
  );
}
