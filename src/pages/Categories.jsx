import React from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { ArrowDownRight, Filter, Landmark, Layers3, Target, Tags } from 'lucide-react';
import { money } from '../utils/format';
import { filterChip } from '../utils/filters';

const COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4', '#f43f5e', '#a3e635', '#facc15'];

function totalOf(items = []) {
  return items.reduce((sum, item) => sum + Math.abs(item.value || 0), 0);
}

function PercentList({ title, icon: Icon, items = [], total, onSelect, selected }) {
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
            const active = selected && selected === item.name;
            return (
              <button key={item.name || index} type='button' onClick={() => onSelect?.(item.name)} className={`w-full rounded-3xl p-0 text-left transition active:scale-[0.99] ${active ? 'ring-2 ring-indigo-400/50' : ''}`}>
                <div className='mb-2 flex min-w-0 items-center justify-between gap-3'>
                  <p className='min-w-0 truncate text-sm font-semibold text-slate-800'>{item.name || 'Sem preenchimento'}</p>
                  <p className='shrink-0 text-xs font-bold text-slate-500'>{percent.toFixed(1)}%</p>
                </div>
                <div className='progress'><span style={{ width: `${Math.min(percent, 100)}%`, background: COLORS[index % COLORS.length] }} /></div>
                <p className='mt-1 text-xs font-bold text-slate-500'>{money(item.value || 0)}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className='empty-state shadow-none'>Nada para mostrar neste período.</div>
      )}
    </section>
  );
}

export default function Categories({ data, loading, filters = {}, setFilters, onOpenFilters }) {
  const byCategory = data?.byCategory || [];
  const bySubcategory = data?.bySubcategory || [];
  const byAccount = data?.byAccount || [];
  const expensesByCategory = data?.expensesByCategory || [];
  const expensesBySubcategory = data?.expensesBySubcategory || [];
  const expensesByAccount = data?.expensesByAccount || [];
  const meta = data?.meta || {};
  const expenseTotal = totalOf(expensesByCategory);
  const allCategoryTotal = totalOf(byCategory);
  const topExpense = expensesByCategory[0];
  const topAccount = expensesByAccount[0];
  const goalPercent = meta.usedPercent == null ? null : Math.round(meta.usedPercent * 100);
  const remaining = meta.value ? meta.remaining || 0 : null;

  const applyFilter = (key, value) => {
    if (!setFilters || !value) return;
    setFilters({ ...filters, [key]: filters[key] === value ? '' : value });
  };

  if (loading && !data) return <div className='loading-state'>Carregando categorias…</div>;

  return (
    <div className='space-y-4'>
      <header className='flex items-start justify-between gap-3 px-1'>
        <div className='min-w-0'>
          <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Análise</p>
          <h1 className='text-2xl font-bold text-slate-900'>Categorias</h1>
          <p className='mt-1 truncate text-sm text-slate-500'>{filterChip(filters) || 'Despesas reais, metas e canais.'}</p>
        </div>
        <button type='button' onClick={onOpenFilters} className='grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-600 shadow-soft' aria-label='Filtrar categorias'>
          <Filter size={18} />
        </button>
      </header>

      {loading && data && <div className='rounded-3xl bg-indigo-50 p-3 text-center text-xs font-semibold text-indigo-600'>Atualizando…</div>}

      <section className='rounded-4xl bg-white p-5 shadow-soft'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.16em] text-slate-400'>Meta x gasto</p>
            <h2 className='mt-1 text-xl font-extrabold text-slate-900'>{meta.value ? `${goalPercent}% usado` : 'Sem meta definida'}</h2>
            <p className='mt-1 text-sm text-slate-500'>{meta.month || 'Período'} · {meta.status || 'Sem status'}</p>
          </div>
          <span className={`grid h-11 w-11 place-items-center rounded-2xl ${remaining != null && remaining < 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}><Target size={19} /></span>
        </div>
        <div className='progress mt-4'><span className={goalPercent > 100 ? '!bg-rose-500' : goalPercent >= 80 ? '!bg-amber-500' : ''} style={{ width: `${Math.min(goalPercent || 0, 100)}%` }} /></div>
        <div className='mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500'>
          <div><p>Gasto</p><b className='text-slate-900'>{money(meta.spent || expenseTotal)}</b></div>
          <div><p>Meta</p><b className='text-slate-900'>{meta.value ? money(meta.value) : '—'}</b></div>
          <div><p>{remaining != null && remaining < 0 ? 'Passou' : 'Resta'}</p><b className={remaining != null && remaining < 0 ? 'text-rose-500' : 'text-emerald-500'}>{remaining == null ? '—' : money(Math.abs(remaining))}</b></div>
        </div>
      </section>

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
            <p className='text-sm text-slate-500'>{expensesByCategory.length ? 'Toque em uma categoria para filtrar.' : 'Sem despesas no período.'}</p>
          </div>
          {topAccount && <button type='button' onClick={() => applyFilter('account', topAccount.name)} className='badge'>Canal top: {topAccount.name}</button>}
        </div>
        <div className='grid grid-cols-1 gap-4'>
          <div className='h-[190px]'>
            {expensesByCategory.length ? (
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie data={expensesByCategory.slice(0, 7)} dataKey='value' nameKey='name' innerRadius={50} outerRadius={82} paddingAngle={3} onClick={(entry) => applyFilter('category', entry?.name)}>
                    {expensesByCategory.slice(0, 7).map((entry, index) => <Cell key={entry.name || index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => money(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className='grid h-full place-items-center text-sm text-slate-400'>Sem gráfico disponível.</div>
            )}
          </div>
          <div className='h-[150px]'>
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

      <PercentList title='Despesas por categoria' icon={Tags} items={expensesByCategory} total={expenseTotal} selected={filters.category} onSelect={(value) => applyFilter('category', value)} />
      <PercentList title='Essencial vs Extra' icon={Layers3} items={expensesBySubcategory.length ? expensesBySubcategory : bySubcategory} total={totalOf(expensesBySubcategory.length ? expensesBySubcategory : bySubcategory)} selected={filters.subcategory} onSelect={(value) => applyFilter('subcategory', value)} />
      <PercentList title='Por conta/canal' icon={Landmark} items={expensesByAccount.length ? expensesByAccount : byAccount} total={totalOf(expensesByAccount.length ? expensesByAccount : byAccount)} selected={filters.account} onSelect={(value) => applyFilter('account', value)} />

      {byCategory.length > expensesByCategory.length && (
        <PercentList title='Categorias gerais' icon={Tags} items={byCategory} total={allCategoryTotal} selected={filters.category} onSelect={(value) => applyFilter('category', value)} />
      )}
    </div>
  );
}
