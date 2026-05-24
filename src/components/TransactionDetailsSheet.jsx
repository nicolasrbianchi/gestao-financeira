import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { money } from '../utils/format';

function toneByType(type = '') {
  const t = String(type || '');
  if (t === 'Receita') return 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20';
  if (t === 'Despesa') return 'text-rose-400 bg-rose-500/10 border-rose-400/20';
  if (t === 'Reserva') return 'text-amber-300 bg-amber-500/10 border-amber-300/20';
  if (t === 'Saldo') return 'text-[#f2d58b] bg-[rgba(214,178,94,0.12)] border-[rgba(214,178,94,0.22)]';
  return 'text-slate-300 bg-slate-500/10 border-slate-300/20';
}

function fmtDateTime(tx) {
  const date = tx?.displayDate || tx?.date || '';
  if (!tx?.occurredAt) return date;
  try {
    const t = new Date(tx.occurredAt);
    if (Number.isNaN(t.getTime())) return date;
    const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  } catch {
    return date;
  }
}

export default function TransactionDetailsSheet({ open, onClose, api, transaction, onEdit, onDelete, onToast }) {
  const id = useMemo(() => Number(transaction?.id ?? transaction?.sheetRowNumber ?? transaction?.row ?? 0) || 0, [transaction]);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [saldoAfter, setSaldoAfter] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (!id) return;
    let mounted = true;
    setLoading(true);
    setError('');
    api(`/transactions/${id}/details`)
      .then((r) => {
        if (!mounted) return;
        setDetails(r?.transaction || transaction || null);
        setSaldoAfter(r?.saldoAfter ?? null);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message || 'Erro ao carregar detalhes.');
        setDetails(transaction || null);
        setSaldoAfter(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, id, api]);

  if (!open) return null;

  const tx = details || transaction || {};
  const tone = toneByType(tx.type);
  const amountAbs = Math.abs(Number(tx.amount || 0));
  const signed = (() => {
    if (tx?.type === 'Receita' || tx?.type === 'Saldo') return amountAbs;
    if (tx?.type === 'Despesa') return -amountAbs;
    if (tx?.type === 'Reserva') return tx?.reserve === 'Entrada' ? amountAbs : -amountAbs;
    return 0;
  })();

  const sourceLabel = tx.source === 'integration' ? 'Integração' : (tx.source ? 'Manual' : '');

  return (
    <div className='sheet' role='dialog' aria-modal='true' onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className='sheet-panel space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>Detalhes</p>
            <h2 className='mt-1 truncate text-xl font-bold text-slate-900'>{tx.name || 'Transação'}</h2>
            <p className='mt-1 text-sm text-slate-500'>{fmtDateTime(tx)}</p>
          </div>
          <button type='button' onClick={onClose} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        <div className='card my-0'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone}`}>{tx.type || '—'}</span>
                {sourceLabel ? <span className='badge'>{sourceLabel}</span> : null}
                {tx.account ? <span className='badge'>{tx.account}</span> : null}
              </div>
            </div>

            <div className='shrink-0 text-right'>
              <p className={`text-lg font-extrabold ${signed >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{signed >= 0 ? '+' : '-'}{money(Math.abs(Number(tx.amount || 0)))}</p>
              <p className='mt-1 text-xs font-semibold text-slate-400'>Saldo após: {saldoAfter == null ? '—' : money(Number(saldoAfter || 0))}</p>
            </div>
          </div>

          <div className='mt-3 grid grid-cols-1 gap-2 text-sm text-slate-300'>
            {tx.category ? <p><span className='text-slate-400'>Categoria:</span> {tx.category}</p> : null}
            {tx.subcategory ? <p><span className='text-slate-400'>Classificação:</span> {tx.subcategory}</p> : null}
            {tx.paymentMethod ? <p><span className='text-slate-400'>Forma:</span> {tx.paymentMethod}</p> : null}
            {tx.status ? <p><span className='text-slate-400'>Status:</span> {tx.status}</p> : null}
            {tx.installment ? <p><span className='text-slate-400'>Parcela:</span> {tx.installment}</p> : null}
            {tx.reserve ? <p><span className='text-slate-400'>Reserva:</span> {tx.reserve}</p> : null}
            {tx.notes ? <p className='whitespace-pre-wrap'><span className='text-slate-400'>Obs:</span> {tx.notes}</p> : null}
          </div>

          {error ? <p className='mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-600'>{error}</p> : null}
          {loading ? <p className='mt-3 text-xs font-semibold text-slate-400'>Carregando saldo…</p> : null}
        </div>

        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => onClose?.()}
            className='flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-slate-100 px-4 py-3 text-sm font-extrabold text-slate-600'
          >
            <ChevronLeft size={16} /> Voltar
          </button>

          {typeof onEdit === 'function' ? (
            <button
              type='button'
              onClick={() => onEdit(tx)}
              className='flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white'
            >
              <Pencil size={16} /> Editar
            </button>
          ) : null}
        </div>

        {typeof onDelete === 'function' ? (
          <button
            type='button'
            onClick={() => {
              const ok = window.confirm(`Excluir "${tx.name || 'transação'}"?`);
              if (!ok) return;
              onDelete(tx)
                ?.then?.(() => onToast?.('Transação excluída.'))
                ?.catch?.(() => {});
              onClose?.();
            }}
            className='w-full inline-flex items-center justify-center gap-2 rounded-3xl bg-rose-50 px-4 py-3 text-sm font-extrabold text-rose-600'
          >
            <Trash2 size={16} /> Excluir
          </button>
        ) : null}
      </div>
    </div>
  );
}

