import React, { Suspense, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  PiggyBank,
  TrendingDown,
  Wallet
} from 'lucide-react';
import { money } from '../utils/format';

const DailySeriesChart = React.lazy(() => import('../components/charts/DailySeriesChart'));

function ActivityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  return (
    <div className='rounded-2xl border border-white/10 bg-[rgba(10,10,16,0.96)] px-3 py-2 shadow-soft'>
      <div className='space-y-1'>
        <p className='text-xs font-semibold text-slate-200'>{d.label || d.day || ''}</p>
        <p className='text-xs text-slate-300'>Saldo: <span className='font-semibold text-slate-100'>{money(d.prevBalance || 0)}</span></p>
        <p className='text-xs text-slate-300'>Receita: <span className='font-semibold text-emerald-200'>+{money(d.income || 0)}</span></p>
        <p className='text-xs text-slate-300'>Despesa: <span className='font-semibold text-rose-200'>-{money(d.expense || 0)}</span></p>
        <p className='text-xs text-slate-300'>Balanço: <span className='font-semibold text-[#f2d58b]'>{money(d.balance || 0)}</span></p>
      </div>
    </div>
  );
}

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

export default function Home({ data, loading, onGoTransactions }) {
  const [showChart, setShowChart] = useState(false);
  useEffect(() => {
    // Carrega o chunk do Recharts depois do primeiro paint (percepção mais rápida no iPhone).
    const id = setTimeout(() => setShowChart(true), 120);
    return () => clearTimeout(id);
  }, []);

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
  const series = (charts.dailySeries || []).slice(-8).map((item) => {
    const label = item.date ? `${item.date.slice(8, 10)}/${item.date.slice(5, 7)}` : '';
    return {
      day: label,
      label,
      income: item.receitas || 0,
      expense: item.despesas || 0,
      balance:
        item.runningSaldoDisponivel ??
        ((item.receitas || 0) + (item.saldo || 0) + (item.reservasSaida || 0) - (item.despesas || 0) - (item.reservasEntrada || 0))
    };
  }).map((point, index, arr) => ({
    ...point,
    prevBalance: index === 0 ? point.balance - (point.income || 0) + (point.expense || 0) : arr[index - 1].balance,
  }));
  const transactions = recentTransactions.slice(0, 5);
  const goalPercent = meta.usedPercent == null ? null : Math.round(meta.usedPercent * 100);

  return (
    <div className='space-y-5'>
      <header className='flex items-center justify-between gap-3 px-1 pt-1'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <img src='/favicon.jpg' alt='Nicco Finance' className='h-7 w-7 rounded-xl ring-1 ring-white/10' />
            <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Nicco Finance</p>
          </div>
          <h1 className='truncate text-2xl font-bold text-slate-900'>Dashboard</h1>
        </div>
      </header>

      {/* Filtro de data removido da visualização do Dashboard (continua aplicando por baixo). */}

      <section className='min-w-0 rounded-5xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-5 text-white shadow-soft'>
        <p className='text-sm text-slate-300'>Saldo Total</p>
        <h2 className='mt-2 text-[2.35rem] font-extrabold leading-tight tracking-tight tabular-nums'>{money(totalBalance)}</h2>
        <div className='mt-5 grid grid-cols-3 gap-3 rounded-3xl bg-white/10 p-4'>
          <div className='min-w-0 text-center'>
            <p className='flex items-center justify-center gap-1 text-xs font-semibold text-slate-300'>
              <ArrowUpRight size={14} /> Receita
            </p>
            <p className='mt-1 text-sm font-semibold text-emerald-200 tabular-nums'>{money(income)}</p>
          </div>
          <div className='min-w-0 text-center'>
            <p className='flex items-center justify-center gap-1 text-xs font-semibold text-slate-300'>
              <TrendingDown size={14} /> Despesa
            </p>
            <p className='mt-1 text-sm font-semibold text-rose-200 tabular-nums'>{money(expense)}</p>
          </div>
          <div className='min-w-0 text-center'>
            <p className='flex items-center justify-center gap-1 text-xs font-semibold text-slate-300'>
              <PiggyBank size={14} /> Reserva
            </p>
            <p className='mt-1 text-sm font-semibold text-amber-200 tabular-nums'>{money(reserves)}</p>
          </div>
        </div>
      </section>

      {accountBreakdown.length > 0 && (
        <section className='rounded-4xl bg-white p-5 shadow-soft'>
          <div className='mb-4'>
            <h3 className='text-base font-semibold text-slate-900'>Contas Bancarias</h3>
            <p className='text-xs text-slate-500'>Saldo detalhado das contas utilizadas.</p>
          </div>
          <div className='grid gap-3'>
            {accountBreakdown.map((account) => (
              <article key={account.account} className='rounded-4xl bg-white p-4 shadow-soft ring-1 ring-white/10'>
                <div className='flex items-start justify-between gap-4'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-extrabold text-slate-100'>{account.account}</p>
                    <p className='mt-1 text-[11px] font-semibold text-slate-400'>Saldo</p>
                    <p className='mt-1 text-xl font-extrabold tracking-tight tabular-nums text-[#f2d58b]'>{money(account.saldoDisponivel || 0)}</p>
                  </div>

                  <div className='min-w-[10.25rem] text-right text-[11px] text-slate-400'>
                    <p>
                      <span className='font-semibold text-slate-300'>Entradas:</span>{' '}
                      <span className='font-semibold text-emerald-200'>{money((account.receitas || 0) + (account.transferenciasEntrada || 0))}</span>
                    </p>
                    <p className='mt-1'>
                      <span className='font-semibold text-slate-300'>Saídas:</span>{' '}
                      <span className='font-semibold text-rose-200'>{money((account.despesas || 0) + (account.transferenciasSaida || 0))}</span>
                    </p>
                    <p className='mt-1'>
                      <span className='font-semibold text-slate-300'>Reserva:</span>{' '}
                      <span className='font-semibold text-[#f2d58b]'>{money(account.reservaAtual || 0)}</span>
                    </p>
                  </div>
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
            <p className='text-xs text-slate-500'>Receita vs despesa (últimos 8 dias).</p>
          </div>
          <div className='shrink-0 text-right text-xs'>
            <p className='font-semibold text-emerald-600'>+{money(income)}</p>
            <p className='font-semibold text-rose-500'>-{money(expense)}</p>
          </div>
        </div>
        <div className='h-36'>
          {showChart ? (
            <Suspense fallback={<div className='grid h-full place-items-center text-sm text-slate-400'>Carregando gráfico…</div>}>
              <DailySeriesChart series={series} tooltip={<ActivityTooltip />} />
            </Suspense>
          ) : (
            <div className='grid h-full place-items-center text-sm text-slate-400'>Carregando gráfico…</div>
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
              const isIncome = transaction.type === 'Receita' || transaction.type === 'Saldo' || (transaction.type === 'Reserva' && transaction.reserve === 'Entrada');
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

                  <div className='mt-2 flex min-w-0 items-start justify-between gap-3 text-[11px]'>
                    <div className='min-w-0 text-slate-500'>
                      {transaction.category ? <span className='font-semibold'>Categoria:</span> : null}{' '}
                      <span className='truncate'>{transaction.category || ''}</span>
                    </div>
                    <div className='flex min-w-0 flex-wrap justify-end gap-1.5'>
                      {transaction.subcategory && <span className='badge'>{transaction.subcategory}</span>}
                      {transaction.paymentMethod && <span className='badge'>{transaction.paymentMethod}</span>}
                      {transaction.reserve && <span className='badge'>Reserva: {transaction.reserve}</span>}
                      {transaction.installment && <span className='badge'>{transaction.installment}</span>}
                    </div>
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
