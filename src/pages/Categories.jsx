import React from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { money } from '../utils/format';

export default function Categories({ data, loading }) {
  const byCategory = data?.byCategory || [];
  const expensesByCategory = data?.expensesByCategory || [];
  const total = byCategory.reduce((sum, category) => sum + Math.abs(category.value || 0), 0);

  if (loading && !data) return <div className='loading-state'>Carregando categorias…</div>;

  return (
    <div className='space-y-4'>
      <header className='px-1'>
        <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Análise</p>
        <h1 className='text-2xl font-bold text-slate-900'>Categorias</h1>
        <p className='mt-1 text-sm text-slate-500'>Entenda para onde o dinheiro está indo.</p>
      </header>

      {loading && data && <div className='rounded-3xl bg-indigo-50 p-3 text-center text-xs font-semibold text-indigo-600'>Atualizando…</div>}

      <section className='card h'>
        <div className='mb-4'>
          <h2 className='text-base font-bold text-slate-900'>Despesas por categoria</h2>
          <p className='text-sm text-slate-500'>{expensesByCategory.length ? 'Maiores saídas no período.' : 'Sem despesas no período.'}</p>
        </div>
        <div className='h-[220px]'>
          {expensesByCategory.length ? (
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={expensesByCategory.slice(0, 8)} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                <XAxis dataKey='name' axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} interval={0} tickFormatter={(value) => String(value).slice(0, 8)} />
                <Tooltip formatter={(value) => money(value)} />
                <Bar dataKey='value' fill='#f43f5e' radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className='grid h-full place-items-center text-sm text-slate-400'>Sem gráfico disponível.</div>
          )}
        </div>
      </section>

      {byCategory.length ? (
        <section className='space-y-3'>
          {byCategory.map((category) => {
            const percent = total ? (Math.abs(category.value || 0) / total) * 100 : 0;
            return (
              <article className='card' key={category.name || 'sem-categoria'}>
                <div className='flex min-w-0 items-center justify-between gap-3'>
                  <p className='min-w-0 truncate font-semibold text-slate-800'>{category.name || 'Sem categoria'}</p>
                  <b className='shrink-0 text-sm text-slate-600'>{percent.toFixed(1)}%</b>
                </div>
                <div className='progress mt-3'><span style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                <p className='mt-3 break-words text-sm font-bold text-slate-900'>{money(category.value || 0)}</p>
              </article>
            );
          })}
        </section>
      ) : (
        <div className='empty-state'>Sem dados de categorias para o período selecionado.</div>
      )}
    </div>
  );
}
