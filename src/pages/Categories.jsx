import React from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { ArrowDownRight, Landmark, Layers3, Tags } from 'lucide-react';
import { money } from '../utils/format';

// Paleta premium (sem roxo neon). Primeiro tom = champagne do app.
const COLORS = ['#e7dcc6', '#94a3b8', '#22c55e', '#fb7185', '#06b6d4', '#f59e0b', '#a3a3a3', '#f2d58b'];

function totalOf(items = []) {
  return items.reduce((sum, item) => sum + Math.abs(item.value || 0), 0);
}

function PercentList({ title, icon: Icon, items = [], total }) {
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
                  <p className='min-w-0 truncate text-sm font-semibold text-slate-800'>{item.name || 'Sem preenchimento'}</p>
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

export default function Categories({ data, loading }) {
  const byCategory = data?.byCategory || [];
  const bySubcategory = data?.bySubcategory || [];
  const byAccount = data?.byAccount || [];
  const expensesByCategory = data?.expensesByCategory || [];
  const expensesBySubcategory = data?.expensesBySubcategory || [];
  const expensesByAccount = data?.expensesByAccount || [];
  const expenseTotal = totalOf(expensesByCategory);
  const allCategoryTotal = totalOf(byCategory);
  const topExpense = expensesByCategory[0];
  const topAccount = expensesByAccount[0];

  if (loading && !data) return <div className='loading-state'>Carregando categorias…</div>;

  return (
    <div className='space-y-4'>
      <header className='px-1'>
        <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Análise</p>
        <h1 className='text-2xl font-bold text-slate-900'>Categorias</h1>
        <p className='mt-1 text-sm text-slate-500'>Despesas reais, natureza do dinheiro e canais.</p>
      </header>

      {loading && data && <div className='rounded-3xl bg-indigo-50 p-3 text-center text-xs font-semibold text-indigo-600'>Atualizando…</div>}

      <section className='grid grid-cols-2 gap-3'>
        <article className='rounded-4xl bg-white p-4 shadow-soft'>
          <ArrowDownRight className='text-rose-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Despesas reais</p>
          <p className='mt-1 break-words text-xl font-bold'>{money(expenseTotal)}</p>
        </article>
        <article className='rounded-4xl bg-white p-4 shadow-soft'>
          <Tags className='text-indigo-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Top categoria</p>
          <p className='mt-1 truncate text-lg font-bold'>{topExpense?.name || '—'}</p>
        </article>
      </section>

      <section className='card h'>
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h2 className='text-base font-bold text-slate-900'>Mapa de despesas</h2>
            <p className='text-sm text-slate-500'>{expensesByCategory.length ? 'Distribuição das maiores categorias.' : 'Sem despesas no período.'}</p>
          </div>
          {topAccount && <span className='badge'>Canal top: {topAccount.name}</span>}
        </div>
        <div className='grid grid-cols-1 gap-4'>
          <div className='h-[190px]'>
            {expensesByCategory.length ? (
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie data={expensesByCategory.slice(0, 7)} dataKey='value' nameKey='name' innerRadius={50} outerRadius={82} paddingAngle={3}>
                    {expensesByCategory.slice(0, 7).map((entry, index) => <Cell key={entry.name || index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => money(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className='grid h-full place-items-center text-sm text-slate-400'>Sem gráfico disponível.</div>
            )}
          </div>
          <div className='h-[160px]'>
            {expensesByCategory.length ? (
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={expensesByCategory.slice(0, 6)} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                  <XAxis dataKey='name' axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} tickFormatter={(value) => String(value).slice(0, 8)} />
                  <Tooltip formatter={(value) => money(value)} />
                  <Bar dataKey='value' radius={[10, 10, 0, 0]}>{expensesByCategory.slice(0, 6).map((entry, index) => <Cell key={entry.name || index} fill={COLORS[index % COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
      </section>

      <PercentList title='Despesas por categoria' icon={Tags} items={expensesByCategory} total={expenseTotal} />
      <PercentList title='Essencial vs Extra' icon={Layers3} items={expensesBySubcategory.length ? expensesBySubcategory : bySubcategory} total={totalOf(expensesBySubcategory.length ? expensesBySubcategory : bySubcategory)} />
      <PercentList title='Por conta/canal' icon={Landmark} items={expensesByAccount.length ? expensesByAccount : byAccount} total={totalOf(expensesByAccount.length ? expensesByAccount : byAccount)} />

      {byCategory.length > expensesByCategory.length && (
        <PercentList title='Categorias gerais' icon={Tags} items={byCategory} total={allCategoryTotal} />
      )}
    </div>
  );
}
