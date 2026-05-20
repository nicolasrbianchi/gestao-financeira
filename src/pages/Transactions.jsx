import React from 'react';
import { CalendarDays, CreditCard, Filter, Landmark, Search, Tags } from 'lucide-react';
import { money } from '../utils/format';
import { filterChip } from '../utils/filters';

const toneByType = {
  Receita: 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20',
  Despesa: 'text-rose-400 bg-rose-500/10 border-rose-400/20',
  Reserva: 'text-indigo-300 bg-indigo-500/10 border-indigo-300/20',
  Saldo: 'text-sky-300 bg-sky-500/10 border-sky-300/20'
};

export default function Transactions({ data, loading, filters, setFilters, onOpenFilters }) {
  const transactions = data?.transactions || [];
  const summary = data?.summary || { totalAmount: 0, count: transactions.length };

  if (loading && !data) return <div className='loading-state'>Carregando transações…</div>;

  return (
    <div className='space-y-4'>
      <header className='px-1'>
        <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Lançamentos</p>
        <h1 className='text-2xl font-bold text-slate-900'>Transações</h1>
        <p className='mt-1 text-sm text-slate-500'>{filterChip(filters) || 'Todos os registros'}</p>
      </header>

      <section className='rounded-4xl bg-white p-4 shadow-soft'>
        <div className='flex items-center gap-2'>
          <label className='relative flex-1'>
            <Search className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' size={16} />
            <input
              className='pl-9'
              placeholder='Buscar por nome'
              value={filters.search || ''}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            />
          </label>
          <button type='button' onClick={onOpenFilters} className='grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white'>
            <Filter size={18} />
          </button>
        </div>
      </section>

      <section className='grid grid-cols-2 gap-3'>
        <article className='min-w-0 rounded-4xl bg-white p-4 shadow-soft'>
          <p className='text-xs text-slate-500'>Total filtrado</p>
          <p className='mt-1 break-words text-xl font-bold'>{money(summary.totalAmount || 0)}</p>
        </article>
        <article className='min-w-0 rounded-4xl bg-white p-4 shadow-soft'>
          <p className='text-xs text-slate-500'>Itens</p>
          <p className='mt-1 text-xl font-bold'>{summary.count ?? transactions.length}</p>
        </article>
      </section>

      {loading && data && <div className='rounded-3xl bg-indigo-50 p-3 text-center text-xs font-semibold text-indigo-600'>Atualizando…</div>}

      {transactions.length ? (
        <section className='space-y-3'>
          {transactions.map((transaction, index) => {
            const isIncome = transaction.type === 'Receita' || transaction.type === 'Saldo' || (transaction.type === 'Reserva' && transaction.reserve === 'Saida');
            const tone = toneByType[transaction.type] || 'text-slate-300 bg-slate-500/10 border-slate-300/20';
            return (
              <article key={`${transaction.sheetRowNumber || index}-${transaction.name || index}`} className='card'>
                <div className='flex min-w-0 items-start justify-between gap-3'>
                  <div className='min-w-0 flex-1'>
                    <div className='mb-2 flex flex-wrap items-center gap-2'>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone}`}>{transaction.type || 'Sem tipo'}</span>
                      {transaction.reserve && <span className='badge'>Reserva: {transaction.reserve}</span>}
                      {transaction.status && <span className='badge'>{transaction.status}</span>}
                    </div>
                    <h2 className='truncate text-base font-bold text-slate-900'>{transaction.name || 'Sem nome'}</h2>
                    <p className='mt-1 flex items-center gap-1 text-xs text-slate-500'><CalendarDays size={13} /> {transaction.displayDate || transaction.date || 'Sem data'}</p>
                  </div>
                  <p className={`max-w-[8.5rem] shrink-0 break-words text-right text-lg font-extrabold ${isIncome ? 'pos' : 'neg'}`}>
                    {isIncome ? '+' : '-'}{money(Math.abs(transaction.amount || 0))}
                  </p>
                </div>

                <div className='mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500'>
                  <div className='min-w-0 rounded-2xl bg-slate-50 p-3'>
                    <p className='mb-1 flex items-center gap-1 font-semibold text-slate-400'><Landmark size={13} /> Conta</p>
                    <p className='truncate font-bold text-slate-800'>{transaction.account || 'Sem conta'}</p>
                  </div>
                  <div className='min-w-0 rounded-2xl bg-slate-50 p-3'>
                    <p className='mb-1 flex items-center gap-1 font-semibold text-slate-400'><Tags size={13} /> Categoria</p>
                    <p className='truncate font-bold text-slate-800'>{transaction.category || 'Sem categoria'}</p>
                  </div>
                  {(transaction.subcategory || transaction.paymentMethod || transaction.installment) && (
                    <div className='col-span-2 flex flex-wrap gap-2 pt-1'>
                      {transaction.subcategory && <span className='badge'>{transaction.subcategory}</span>}
                      {transaction.paymentMethod && <span className='badge'><CreditCard size={12} className='inline' /> {transaction.paymentMethod}</span>}
                      {transaction.installment && <span className='badge'>Parcela {transaction.installment}</span>}
                    </div>
                  )}
                </div>
                {transaction.notes && <p className='mt-3 break-words rounded-2xl bg-slate-50 p-3 text-xs text-slate-400'>{transaction.notes}</p>}
              </article>
            );
          })}
        </section>
      ) : (
        <div className='empty-state'>Nenhuma transação encontrada com os filtros atuais.</div>
      )}
    </div>
  );
}
