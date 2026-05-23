import React from 'react';
import { Download, FileJson, Sheet as SheetIcon } from 'lucide-react';

function openDownload(path) {
  // GET com cookie auth; abrir em nova aba força download via Content-Disposition.
  window.open(`/api${path}`, '_blank', 'noopener,noreferrer');
}

export default function ExportSheet({ open, onClose }) {
  if (!open) return null;

  return (
    <div className='sheet' role='dialog' aria-modal='true' onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className='sheet-panel space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>Exportação</p>
            <h2 className='mt-1 truncate text-xl font-bold text-slate-900'>Exportar dados</h2>
            <p className='mt-1 text-sm text-slate-500'>Baixe um backup completo (JSON) ou transações (CSV).</p>
          </div>
          <button type='button' onClick={onClose} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        <section className='grid grid-cols-1 gap-3'>
          <button
            type='button'
            onClick={() => openDownload('/export/backup.json')}
            className='card flex items-center justify-between gap-3'
          >
            <div className='flex items-center gap-3'>
              <span className='grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 text-indigo-500'><FileJson size={18} /></span>
              <div className='text-left'>
                <p className='font-bold text-slate-900'>Backup (JSON)</p>
                <p className='text-sm text-slate-500'>metadata + transações</p>
              </div>
            </div>
            <Download size={18} className='text-slate-400' />
          </button>

          <button
            type='button'
            onClick={() => openDownload('/export/transactions.csv')}
            className='card flex items-center justify-between gap-3'
          >
            <div className='flex items-center gap-3'>
              <span className='grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 text-emerald-600'><SheetIcon size={18} /></span>
              <div className='text-left'>
                <p className='font-bold text-slate-900'>Transações (CSV)</p>
                <p className='text-sm text-slate-500'>para planilha / BI</p>
              </div>
            </div>
            <Download size={18} className='text-slate-400' />
          </button>

          <button
            type='button'
            onClick={() => openDownload('/export/inbox.csv')}
            className='card flex items-center justify-between gap-3'
          >
            <div className='flex items-center gap-3'>
              <span className='grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 text-amber-600'><SheetIcon size={18} /></span>
              <div className='text-left'>
                <p className='font-bold text-slate-900'>Inbox (CSV)</p>
                <p className='text-sm text-slate-500'>pendentes + aprovadas/rejeitadas</p>
              </div>
            </div>
            <Download size={18} className='text-slate-400' />
          </button>
        </section>
      </div>
    </div>
  );
}
