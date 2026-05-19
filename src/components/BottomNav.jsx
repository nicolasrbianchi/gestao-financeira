import React from 'react';
import { BarChart3, CreditCard, Home, User, Wallet2 } from 'lucide-react';

const tabs = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'transactions', label: 'Analytics', icon: BarChart3 },
  { key: 'categories', label: 'Cards', icon: CreditCard },
  { key: 'more', label: 'Wallet', icon: Wallet2 }
];

export default function BottomNav({ tab, onTab }) {
  return (
    <nav className='fixed inset-x-0 bottom-0 mx-auto grid w-full max-w-[430px] grid-cols-5 gap-1 rounded-t-[2rem] border border-slate-100 bg-white/95 px-3 py-3 shadow-[0_-8px_28px_rgba(15,23,42,0.08)] backdrop-blur'>
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onTab(key)}
          className={`flex flex-col items-center gap-1 rounded-2xl py-1 text-[11px] transition ${tab === key ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <Icon size={18} />
          {label}
        </button>
      ))}
      <button className='flex flex-col items-center gap-1 rounded-2xl py-1 text-[11px] text-slate-400'>
        <User size={18} />
        Profile
      </button>
    </nav>
  );
}
