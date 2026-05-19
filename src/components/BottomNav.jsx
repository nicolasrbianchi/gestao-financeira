import React from 'react';
import { BarChart3, Home, ListChecks, MoreHorizontal, Plus } from 'lucide-react';

const tabs = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'transactions', label: 'Transações', icon: ListChecks },
  { key: 'categories', label: 'Categorias', icon: BarChart3 },
  { key: 'more', label: 'Mais', icon: MoreHorizontal }
];

export default function BottomNav({ tab, onTab, onAdd }) {
  const itemClass = (active) =>
    `flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition ${active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 active:bg-slate-50'}`;

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
        className='mx-auto grid h-14 w-14 -translate-y-4 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_12px_28px_rgba(79,70,229,0.35)] transition active:scale-95'
        aria-label='Adicionar transação'
      >
        <Plus size={26} strokeWidth={2.5} />
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
