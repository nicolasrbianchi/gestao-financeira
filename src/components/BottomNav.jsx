import React from 'react';
import { BarChart3, LayoutDashboard, ListChecks, Plus, Sparkles } from 'lucide-react';

const tabs = [
  { key: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'transactions', label: 'Transações', icon: ListChecks },
  { key: 'categories', label: 'Categorias', icon: BarChart3 },
  { key: 'ai', label: 'Nicco IA', icon: Sparkles }
];

export default function BottomNav({ tab, onTab, onAdd, pendingCount = 0 }) {
  const itemClass = (active) =>
    `flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition ${active ? 'bg-indigo-50 text-indigo-600 ring-1 ring-white/10 shadow-soft' : 'text-slate-400 active:bg-slate-50'}`;

  return (
    <nav className='bottom-nav' aria-label='Navegação principal'>
      {tabs.slice(0, 2).map(({ key, label, icon: Icon }) => (
        <button key={key} type='button' onClick={() => onTab(key)} className={itemClass(tab === key)} aria-current={tab === key ? 'page' : undefined}>
          <Icon size={19} />
          <span>{label}</span>
        </button>
      ))}

      <button
        type='button'
        onClick={onAdd}
        className='relative mx-auto grid h-14 w-14 -translate-y-4 place-items-center rounded-full bg-slate-950 text-black shadow-[0_14px_34px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition active:opacity-90'
        aria-label='Adicionar transação'
      >
        <Plus size={26} strokeWidth={2.5} />
        {pendingCount > 0 && (
          <span
            className='absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[10px] font-extrabold text-white ring-2 ring-[rgba(0,0,0,0.72)]'
            aria-label={`${pendingCount} pendência(s) para aprovar`}
          >
            {pendingCount}
          </span>
        )}
      </button>

      {tabs.slice(2).map(({ key, label, icon: Icon }) => (
        <button key={key} type='button' onClick={() => onTab(key)} className={itemClass(tab === key)} aria-current={tab === key ? 'page' : undefined}>
          <Icon size={19} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
