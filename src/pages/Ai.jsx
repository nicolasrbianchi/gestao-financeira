import React from 'react';
import { Sparkles } from 'lucide-react';

export default function Ai() {
  return (
    <div className='space-y-4'>
      <header className='px-1'>
        <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Assistente</p>
        <h1 className='text-2xl font-bold text-slate-900'>Nicco IA</h1>
        <p className='mt-1 text-sm text-slate-500'>Em breve.</p>
      </header>

      <section className='rounded-4xl bg-white p-5 shadow-soft'>
        <div className='flex items-start gap-3'>
          <span className='grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-50 text-indigo-500'>
            <Sparkles size={18} />
          </span>
          <div className='min-w-0'>
            <p className='text-sm font-semibold text-slate-900'>Nicco IA</p>
            <p className='mt-1 text-sm text-slate-500'>Este menu vai virar seu cockpit de inteligência (insights, previsões e recomendações).</p>
          </div>
        </div>
      </section>
    </div>
  );
}

