import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CreditCard,
  HandCoins,
  MoreHorizontal,
  PiggyBank,
  Send,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { money } from '../utils/format';

const quickActions = [
  { label: 'Send', icon: Send },
  { label: 'Receive', icon: ArrowDownLeft },
  { label: 'Transfer', icon: HandCoins },
  { label: 'More', icon: MoreHorizontal }
];

const txIcons = {
  Salary: Wallet,
  Food: CreditCard,
  Savings: PiggyBank,
  Shopping: CreditCard
};

export default function Home({ data, loading }) {
  if (loading || !data) return <p className='px-2 py-10 text-center text-slate-500'>Loading dashboard...</p>;

  const totalBalance = data.summaryCards.find((card) => card.key === 'saldo')?.value ?? 0;
  const income = data.summaryCards.find((card) => card.key === 'receitas')?.value ?? 0;
  const expense = Math.abs(data.summaryCards.find((card) => card.key === 'despesas')?.value ?? 0);
  const series = data.charts.dailySeries.slice(-7).map((d) => ({
    day: d.date.slice(5),
    balance: (d.receitas || 0) - (d.despesas || 0)
  }));
  const transactions = data.latestTransactions.slice(0, 5);

  return (
    <div className='space-y-6 pb-28'>
      <header className='flex items-center justify-between px-1 pt-1'>
        <div>
          <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Good morning</p>
          <h1 className='text-2xl font-bold text-slate-900'>Alex Johnson</h1>
        </div>
        <div className='flex items-center gap-2'>
          <button className='grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-600 shadow-soft transition hover:-translate-y-0.5'>
            <Bell size={18} />
          </button>
          <div className='grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-soft'>
            AJ
          </div>
        </div>
      </header>

      <section className='rounded-5xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 text-white shadow-soft'>
        <p className='text-sm text-slate-300'>Total Balance</p>
        <h2 className='mt-2 text-4xl font-extrabold tracking-tight'>{money(totalBalance)}</h2>
        <div className='mt-6 flex items-center justify-between rounded-3xl bg-white/10 p-4'>
          <div>
            <p className='text-xs text-slate-300'>Monthly Growth</p>
            <p className='mt-1 flex items-center gap-1 text-sm font-semibold text-emerald-300'><TrendingUp size={15} /> +8.4%</p>
          </div>
          <div className='text-right'>
            <p className='text-xs text-slate-300'>vs last month</p>
            <p className='mt-1 text-sm font-semibold'>+{money(income - expense)}</p>
          </div>
        </div>
      </section>

      <section className='grid grid-cols-4 gap-3'>
        {quickActions.map(({ label, icon: Icon }) => (
          <button key={label} className='rounded-3xl bg-white p-3 text-center shadow-soft transition hover:-translate-y-0.5'>
            <span className='mx-auto mb-2 grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-700'>
              <Icon size={18} />
            </span>
            <span className='text-xs font-medium text-slate-600'>{label}</span>
          </button>
        ))}
      </section>

      <section className='rounded-4xl bg-white p-5 shadow-soft'>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <p className='text-sm font-semibold text-slate-900'>Weekly activity</p>
            <p className='text-xs text-slate-500'>Income vs Expense</p>
          </div>
          <div className='text-right text-xs'>
            <p className='font-semibold text-emerald-600'>+{money(income)}</p>
            <p className='font-semibold text-rose-500'>-{money(expense)}</p>
          </div>
        </div>
        <div className='h-36'>
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart data={series}>
              <XAxis dataKey='day' axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(value) => money(value)} />
              <Line type='monotone' dataKey='balance' stroke='#4f46e5' strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className='grid grid-cols-2 gap-3'>
        <article className='rounded-4xl bg-white p-4 shadow-soft'>
          <ArrowUpRight className='text-emerald-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Income</p>
          <p className='mt-1 text-xl font-bold'>{money(income)}</p>
        </article>
        <article className='rounded-4xl bg-white p-4 shadow-soft'>
          <TrendingDown className='text-rose-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Expense</p>
          <p className='mt-1 text-xl font-bold'>{money(expense)}</p>
        </article>
      </section>

      <section className='rounded-4xl bg-white p-5 shadow-soft'>
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-base font-semibold text-slate-900'>Recent Transactions</h3>
          <button className='text-xs font-semibold text-indigo-600'>View all</button>
        </div>
        <ul className='space-y-3'>
          {transactions.map((tx, index) => {
            const Icon = txIcons[tx.category] || Wallet;
            const positive = tx.amount > 0;
            return (
              <li key={index} className='flex items-center gap-3'>
                <span className='grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-700'>
                  <Icon size={16} />
                </span>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-semibold text-slate-800'>{tx.description}</p>
                  <p className='text-xs text-slate-500'>{tx.category} • {tx.date}</p>
                </div>
                <p className={`text-sm font-semibold ${positive ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {positive ? '+' : '-'}{money(Math.abs(tx.amount))}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
