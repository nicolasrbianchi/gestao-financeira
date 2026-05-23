import React from 'react';
import { ArrowRightLeft, PlusCircle } from 'lucide-react';

function ActionButton({ icon: Icon, title, description, onClick }) {
  return (
    <button type='button' onClick={onClick} className='card my-0 w-full text-left active:opacity-90'>
      <div className='flex items-start gap-3'>
        <span className='grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-50 text-indigo-500'>{Icon && <Icon size={18} />}</span>
        <div className='min-w-0 flex-1'>
          <p className='font-extrabold text-slate-900'>{title}</p>
          {description && <p className='mt-1 text-sm text-slate-500'>{description}</p>}
        </div>
      </div>
    </button>
  );
}

export default function AddTransactionMenuSheet({ open, onClose, onOpenFinance, onManual, pendingCount }) {
  if (!open) return null;

  const pendingLabel = pendingCount == null ? 'Pendências: —' : `${pendingCount} pendente(s)`;

  return (
    <div className='sheet' role='dialog' aria-modal='true' onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className='sheet-panel space-y-4' style={{ marginBottom: 'calc(6.5rem + env(safe-area-inset-bottom))', borderRadius: '2rem' }}>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>Adicionar</p>
            <h2 className='mt-1 truncate text-xl font-bold text-slate-900'>Nova transação</h2>
          </div>
          <button type='button' onClick={onClose} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        <div className='space-y-2'>
          <ActionButton
            icon={ArrowRightLeft}
            title='Aprovar transações Open Finance'
            description={pendingLabel}
            onClick={onOpenFinance}
          />
          <ActionButton
            icon={PlusCircle}
            title='Inserir transação manualmente'
            onClick={onManual}
          />
        </div>
      </div>
    </div>
  );
}
