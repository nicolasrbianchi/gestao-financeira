import React from 'react';
import { Bell } from 'lucide-react';

export default function NotificationsSheet({ open, onClose }) {
  if (!open) return null;

  return (
    <div className='sheet' role='dialog' aria-modal='true' onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className='sheet-panel space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>Notificações</p>
            <h2 className='mt-1 truncate text-xl font-bold text-slate-900'>Central</h2>
            <p className='mt-1 text-sm text-slate-500'>Em breve: alertas e lembretes do Nicco.</p>
          </div>
          <button type='button' onClick={onClose} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        <div className='empty-state shadow-none'>
          <div className='mx-auto mb-2 grid h-12 w-12 place-items-center rounded-3xl bg-slate-50 text-indigo-500'>
            <Bell size={20} />
          </div>
          Nenhuma notificação por enquanto.
        </div>
      </div>
    </div>
  );
}

