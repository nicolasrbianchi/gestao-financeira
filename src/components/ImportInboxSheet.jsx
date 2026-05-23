import React, { useEffect, useMemo, useState } from 'react';
import { Inbox, Trash2, CheckCircle2 } from 'lucide-react';
import { money } from '../utils/format';

function isoToFormDate(iso) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default function ImportInboxSheet({ open, onClose, api, metadata, onApprove, onToast }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [r, pluggy] = await Promise.all([
        api('/imports/pending'),
        api('/pluggy/items').catch(() => ({ items: [] })),
      ]);
      setItems(r.items || []);
      const enabled = (pluggy.items || []).filter((it) => it.enabled);
      const dates = enabled.map((it) => it.lastFetchAt).filter(Boolean).map((x) => new Date(x)).filter((d) => !Number.isNaN(d.getTime()));
      const max = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
      setLastUpdate(max ? max.toISOString() : null);
    } catch (e) {
      setError(e.message || 'Erro ao carregar importações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const count = items.length;
  const subtitle = useMemo(() => (count ? `${count} pendente(s)` : 'Nenhuma pendência'), [count]);
  const lastUpdateLabel = useMemo(() => {
    if (!lastUpdate) return 'Última atualização: —';
    try {
      return `Última atualização: ${new Date(lastUpdate).toLocaleString()}`;
    } catch {
      return 'Última atualização: —';
    }
  }, [lastUpdate]);

  if (!open) return null;

  const reject = async (id) => {
    if (!window.confirm('Excluir esta importação?')) return;
    try {
      await api(`/imports/${id}/reject`, { method: 'POST', body: '{}' });
      onToast?.('Importação excluída.');
      await load();
    } catch (e) {
      onToast?.(e.message || 'Erro ao excluir importação.');
    }
  };

  return (
    <div className='sheet' role='dialog' aria-modal='true' onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className='sheet-panel space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>Transações</p>
            <h2 className='mt-1 truncate text-xl font-bold text-slate-900'>Caixa de entrada</h2>
            <p className='mt-1 text-sm text-slate-500'>{subtitle}</p>
            <p className='mt-1 text-xs text-slate-400'>{lastUpdateLabel}</p>
          </div>
          <button type='button' onClick={onClose} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        {error && <div className='rounded-3xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'>{error}</div>}
        {loading ? (
          <div className='empty-state shadow-none'>Carregando…</div>
        ) : count ? (
          <div className='space-y-2'>
            {items.map((it) => (
              <div key={it.id} className='card my-0 flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <p className='text-xs font-semibold text-slate-500'>{it.provider} · {it.currency}</p>
                  <p className='mt-1 truncate text-base font-extrabold text-slate-900'>{it.description || 'Sem descrição'}</p>
                  <p className='mt-1 truncate text-xs text-slate-500'>{it.occurredAt ? new Date(it.occurredAt).toLocaleString() : 'Sem data'}{it.accountHint ? ` · ${it.accountHint}` : ''}</p>
                  <p className='mt-2 text-sm font-extrabold text-slate-900'>{money(Math.abs(it.amount || 0))}</p>
                </div>
                <div className='flex shrink-0 flex-col gap-2'>
                  <button
                    type='button'
                    onClick={() => onApprove?.({
                      importId: it.id,
                      prefill: it.prefill || null,
                      // pré-preenche o que dá
                      initialForm: {
                        data: isoToFormDate(it.occurredAt),
                        nome: it.prefill?.nome || it.description || '',
                        tipo: it.prefill?.tipo || '',
                        reserva: '',
                        conta: it.prefill?.conta || it.accountHint || '',
                        categoria: '',
                        subcategoria: '',
                        forma: it.prefill?.forma || '',
                        valor: String(Math.abs(it.amount || 0)).replace('.', ','),
                        status: '',
                        parcela: '',
                        obs: '',
                      },
                    })}
                    className='flex items-center justify-center gap-2 rounded-3xl bg-slate-950 px-4 py-3 text-xs font-extrabold text-white'
                  >
                    <CheckCircle2 size={16} /> Aprovar
                  </button>
                  <button
                    type='button'
                    onClick={() => reject(it.id)}
                    className='flex items-center justify-center gap-2 rounded-3xl bg-rose-50 px-4 py-3 text-xs font-extrabold text-rose-600'
                  >
                    <Trash2 size={16} /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='empty-state shadow-none'>Nada pra aprovar agora.</div>
        )}

        <div className='rounded-4xl bg-slate-50 p-3 text-xs text-slate-500'>
          <p className='flex items-center gap-2 font-semibold text-slate-600'><Inbox size={14} /> Dica</p>
          <p className='mt-1'>Aprovar abre o formulário para você completar os campos do Nicco.</p>
        </div>
      </div>
    </div>
  );
}
