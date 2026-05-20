import React from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Filter,
  PiggyBank,
  Settings2,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { money } from '../utils/format';
import { mtdFilters, filterChip } from '../utils/filters';

function cardValue(cards = [], key) {
  return cards.find((card) => card.key === key)?.value ?? 0;
}

function LoadingSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='loading-state'>Carregando dashboard…</div>
      <div className='h-44 animate-pulse rounded-5xl bg-white/70' />
      <div className='grid grid-cols-2 gap-3'>{[1, 2].map((item) => <div key={item} className='h-24 animate-pulse rounded-3xl bg-white/70' />)}</div>
    </div>
  );
}

export default function Home({ data, loading, filters, setFilters, onOpenFilters, onOpenMore, onGoTransactions }) {
  if (loading && !data) return <LoadingSkeleton />;

  const summaryCards = data?.summaryCards || [];
  const charts = data?.charts || {};
  const recentTransactions = data?.recentTransactions || [];
  const meta = data?.meta || {};
  const accountBreakdown = data?.accountBreakdown || [];
  const totalBalance = cardValue(summaryCards, 'saldoDisponivel');
  const reserves = cardValue(summaryCards, 'reservas');
  const income = cardValue(summaryCards, 'receitas');
  const expense = Math.abs(cardValue(summaryCards, 'despesas'));
  const series = (charts.dailySeries || []).slice(-7).map((item) => ({
    day: item.date?.slice(5) || '',
    balance:
      item.runningSaldoDisponivel ??
      ((item.receitas || 0) + (item.saldo || 0) + (item.reservasSaida || 0) - (item.despesas || 0) - (item.reservasEntrada || 0))
  }));
  const transactions = recentTransactions.slice(0, 5);
  const goalPercent = meta.usedPercent == null ? null : Math.round(meta.usedPercent * 100);
  const goalRemaining = meta.value ? meta.remaining || 0 : null;

  return (
    <div className='space-y-5'>
      <header className='flex items-center justify-between gap-3 px-1 pt-1'>
        <div className='min-w-0'>
          <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Resumo financeiro</p>
          <h1 className='truncate text-2xl font-bold text-slate-900'>Minha carteira</h1>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <button
            type='button'
            onClick={onOpenFilters}
            className='grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-600 shadow-soft transition active:scale-95'
            aria-label='Abrir filtros'
          >
            <Filter size={18} />
          </button>
          <button
            type='button'
            onClick={onOpenMore}
            className='grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-600 shadow-soft transition active:scale-95'
            aria-label='Configurações'
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      <section className='flex items-center justify-between gap-3 rounded-3xl bg-white/70 px-4 py-3 shadow-soft'>
        <div className='flex min-w-0 items-center gap-2'>
          <CalendarDays size={16} className='shrink-0 text-indigo-500' />
          <p className='truncate text-xs font-semibold text-slate-500'>{filterChip(filters) || 'Período atual'}</p>
        </div>
        <button type='button' onClick={() => setFilters?.(mtdFilters())} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600'>MTD</button>
      </section>

      <section className='min-w-0 rounded-5xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-5 text-white shadow-soft'>
        <p className='text-sm text-slate-300'>Saldo disponível</p>
        <h2 className='mt-2 text-[2.35rem] font-extrabold leading-tight tracking-tight tabular-nums'>{money(totalBalance)}</h2>
        <div className='mt-5 grid grid-cols-2 gap-3 rounded-3xl bg-white/10 p-4'>
          <div className='min-w-0'>
            <p className='text-xs text-slate-300'>Despesas vs meta</p>
            <p className='mt-1 flex items-center gap-1 text-sm font-semibold text-rose-200 tabular-nums'><TrendingDown size={15} /> {money(expense)}</p>
          </div>
          <div className='min-w-0 text-right'>
            <p className='text-xs text-slate-300'>{meta.value ? `Meta ${meta.month || ''}` : 'Meta do mês'}</p>
            <p className={`mt-1 text-sm font-semibold tabular-nums ${goalRemaining != null && goalRemaining < 0 ? 'text-rose-200' : 'text-emerald-200'}`}>
              {meta.value ? `${goalPercent}% · ${money(goalRemaining)}` : 'Sem meta'}
            </p>
          </div>
        </div>
      </section>

      <section className='grid grid-cols-3 gap-3'>
        <article className='min-w-0 rounded-4xl bg-white p-4 shadow-soft'>
          <ArrowUpRight className='text-emerald-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Receitas</p>
          <p className='mt-1 text-lg font-bold tabular-nums'>{money(income)}</p>
        </article>
        <article className='min-w-0 rounded-4xl bg-white p-4 shadow-soft'>
          <TrendingDown className='text-rose-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Despesas</p>
          <p className='mt-1 text-lg font-bold tabular-nums'>{money(expense)}</p>
        </article>
        <article className='min-w-0 rounded-4xl bg-white p-4 shadow-soft'>
          <PiggyBank className='text-indigo-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Reserva</p>
          <p className='mt-1 text-lg font-bold tabular-nums'>{money(reserves)}</p>
        </article>
      </section>

      {accountBreakdown.length > 0 && (
        <section className='rounded-4xl bg-white p-5 shadow-soft'>
          <div className='mb-4'>
            <h3 className='text-base font-semibold text-slate-900'>Por conta/canal</h3>
            <p className='text-xs text-slate-500'>Transferências não contam como receita/despesa, mas afetam o saldo.</p>
          </div>
          <div className='space-y-3'>
            {accountBreakdown.map((account) => (
              <article key={account.account} className='rounded-3xl bg-slate-50 p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-bold text-slate-800'>{account.account}</p>
                    <p className='mt-1 text-xs text-slate-500'>Reserva: {money(account.reservaAtual || 0)}</p>
                  </div>
                  <p className='max-w-[8rem] break-words text-right text-sm font-extrabold text-slate-900'>{money(account.saldoDisponivel || 0)}</p>
                </div>
                <div className='mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500'>
                  <span>Entrou: {money((account.receitas || 0) + (account.transferenciasEntrada || 0))}</span>
                  <span>Saiu: {money((account.despesas || 0) + (account.transferenciasSaida || 0))}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className='rounded-4xl bg-white p-5 shadow-soft'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h3 className='text-base font-semibold text-slate-900'>Meta do mês</h3>
            <p className='text-xs text-slate-500'>{meta.month || 'Período atual'} · {meta.status || 'Sem status'}</p>
          </div>
          <p className={`shrink-0 text-right text-sm font-bold ${(meta.remaining ?? 0) < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
            {meta.value ? money(meta.remaining || 0) : '—'}
          </p>
        </div>
        <div className='progress mt-4'><span className={goalPercent > 100 ? '!bg-rose-500' : goalPercent >= 80 ? '!bg-amber-500' : ''} style={{ width: `${Math.min(goalPercent || 0, 100)}%` }} /></div>
        <div className='mt-3 flex justify-between text-xs text-slate-500'>
          <span>Gasto: {money(meta.spent || expense)}</span>
          <span>Meta: {meta.value ? money(meta.value) : 'não definida'}</span>
        </div>
      </section>

      <section className='rounded-4xl bg-white p-5 shadow-soft'>
        <div className='mb-4 flex items-center justify-between gap-3'>
          <div>
            <p className='text-sm font-semibold text-slate-900'>Atividade recente</p>
            <p className='text-xs text-slate-500'>Saldo disponível ao longo do período (sem transferências)</p>
          </div>
          <div className='shrink-0 text-right text-xs'>
            <p className='font-semibold text-emerald-600'>+{money(income)}</p>
            <p className='font-semibold text-rose-500'>-{money(expense)}</p>
          </div>
        </div>
        <div className='h-36'>
          {series.length ? (
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={series} margin={{ left: 4, right: 4, top: 6, bottom: 0 }}>
                <XAxis dataKey='day' axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip formatter={(value) => money(value)} />
                <Line type='monotone' dataKey='balance' stroke='#f2d58b' strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className='grid h-full place-items-center text-sm text-slate-400'>Sem dados no período.</div>
          )}
        </div>
      </section>

      <section className='rounded-4xl bg-white p-5 shadow-soft'>
        <div className='mb-4 flex items-center justify-between gap-3'>
          <h3 className='text-base font-semibold text-slate-900'>Transações recentes</h3>
          <button type='button' onClick={onGoTransactions} className='text-xs font-semibold text-indigo-600'>Ver mais</button>
        </div>
        {transactions.length ? (
          <section className='space-y-2.5'>
            {transactions.map((transaction, index) => {
              const isIncome = transaction.type === 'Receita' || transaction.type === 'Saldo' || (transaction.type === 'Reserva' && transaction.reserve === 'Saida');
              const toneByType = {
                Receita: 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20',
                Despesa: 'text-rose-400 bg-rose-500/10 border-rose-400/20',
                Reserva: 'text-amber-300 bg-amber-500/10 border-amber-300/20',
                Saldo: 'text-[#f2d58b] bg-[rgba(214,178,94,0.12)] border-[rgba(214,178,94,0.22)]'
              };
              const amountColorByType = {
                Receita: 'text-emerald-400',
                Despesa: 'text-rose-400',
                Reserva: 'text-amber-300',
                Saldo: 'text-[#f2d58b]'
              };
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
                      <p className='mt-1 flex items-center gap-1 truncate text-[11px] text-slate-500'>
                        <CalendarDays size={12} /> {transaction.displayDate || transaction.date || 'Sem data'} · {transaction.account || 'Sem conta'}
                      </p>
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
          <div className='empty-state shadow-none'>Nenhuma transação encontrada neste período.</div>
        )}
      </section>
    </div>
  );
}
