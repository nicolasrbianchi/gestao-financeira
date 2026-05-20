import React from 'react';
import { CalendarDays, Filter, Search } from 'lucide-react';
import { money } from '../utils/format';
import { filterChip } from '../utils/filters';

const toneByType = {
  Receita: 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20',
  Despesa: 'text-rose-400 bg-rose-500/10 border-rose-400/20',
  Reserva: 'text-amber-300 bg-amber-500/10 border-amber-300/20',
  Saldo: 'text-[#e7dcc6] bg-[rgba(205,187,147,0.12)] border-[rgba(205,187,147,0.22)]'
};

const amountColorByType = {
  Receita: 'text-emerald-400',
  Despesa: 'text-rose-400',
  Reserva: 'text-amber-300',
  Saldo: 'text-[#e7dcc6]'
};

export default function Transactions({ data, loading, filters, setFilters, onOpenFilters }) {
  const transactions = data?.transactions || [];
  const summary = data?.summary || { totalAmount: 0, count: transactions.length };
  const period = filterChip(filters) || 'Todos os registros';

  if (loading && !data) return <div className='loading-state'>Carregando transações…</div>;

  return (
    <div className='space-y-4'>
      <header className='px-1'>
        <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Lançamentos</p>
        <h1 className='text-2xl font-bold text-slate-900'>Transações</h1>
      </header>

      <section className='rounded-4xl bg-white p-4 shadow-soft'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='truncate text-xs font-semibold text-slate-500'>{period}</p>
            <p className='mt-1 break-words text-2xl font-extrabold text-slate-900'>{money(summary.totalAmount || 0)}</p>
          </div>
          <button type='button' onClick={onOpenFilters} className='grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white' aria-label='Filtrar transações'>
            <Filter size={18} />
          </button>
        </div>

        <div className='mt-4 flex items-center gap-2'>
          <label className='relative flex-1'>
            <Search className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' size={16} />
            <input
              className='pl-9'
              placeholder='Buscar por nome'
              value={filters.search || ''}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            />
          </label>
          <div className='grid h-12 min-w-14 place-items-center rounded-2xl bg-slate-50 px-3 text-center'>
            <div>
              <p className='text-sm font-extrabold text-slate-900'>{summary.count ?? transactions.length}</p>
              <p className='-mt-0.5 text-[10px] font-semibold text-slate-500'>itens</p>
            </div>
          </div>
        </div>
      </section>

      {loading && data && <div className='rounded-3xl bg-indigo-50 p-3 text-center text-xs font-semibold text-indigo-600'>Atualizando…</div>}

      {transactions.length ? (
        <section className='space-y-2.5'>
          {transactions.map((transaction, index) => {
            const isIncome = transaction.type === 'Receita' || transaction.type === 'Saldo' || (transaction.type === 'Reserva' && transaction.reserve === 'Saida');
            const tone = toneByType[transaction.type] || 'text-slate-300 bg-slate-500/10 border-slate-300/20';
            const amountTone = amountColorByType[transaction.type] || (isIncome ? 'pos' : 'neg');
            return (
              <article key={`${transaction.sheetRowNumber || index}-${transaction.name || index}`} className='rounded-3xl bg-white p-3 shadow-soft'>
                <div className='flex min-w-0 items-start justify-between gap-3'>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2'>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone}`}>{transaction.type || 'Sem tipo'}</span>
                      <p className='truncate text-sm font-bold text-slate-900'>{transaction.name || 'Sem nome'}</p>
                    </div>
                    <p className='mt-1 flex items-center gap-1 truncate text-[11px] text-slate-500'><CalendarDays size={12} /> {transaction.displayDate || transaction.date || 'Sem data'} · {transaction.account || 'Sem conta'}</p>
                  </div>
                  <p className={`max-w-[8rem] shrink-0 break-words text-right text-sm font-extrabold ${amountTone}`}>
                    {isIncome ? '+' : '-'}{money(Math.abs(transaction.amount || 0))}
                  </p>
                </div>

                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5 text-[11px]'>
                  {transaction.category && <span className='badge'>{transaction.category}</span>}
                  {transaction.subcategory && <span className='badge'>{transaction.subcategory}</span>}
                  {transaction.paymentMethod && <span className='badge'>{transaction.paymentMethod}</span>}
                  {transaction.reserve && <span className='badge'>Reserva: {transaction.reserve}</span>}
                  {transaction.installment && <span className='badge'>{transaction.installment}</span>}
                </div>
                {transaction.notes && <p className='mt-2 truncate text-[11px] text-slate-400'>{transaction.notes}</p>}
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
