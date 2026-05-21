import React, { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';

function toPtbrMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2).replace('.', ',');
}

export default function ManageMonthlyGoalsSheet({ open, onClose, api }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [goals, setGoals] = useState([]);
  const [month, setMonth] = useState('');
  const [value, setValue] = useState('');

  const sorted = useMemo(() => (goals || []).slice().sort((a, b) => String(a.month).localeCompare(String(b.month))), [goals]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const r = await api('/monthly-goals/manage');
      setGoals(r.goals || []);
    } catch (e) {
      setError(e.message || 'Erro ao carregar metas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const save = async () => {
    try {
      setError('');
      if (!month) return setError('Escolha o mês.');
      if (!value) return setError('Preencha o valor.');
      await api('/monthly-goals/manage', { method: 'POST', body: JSON.stringify({ month, value }) });
      setValue('');
      await load();
    } catch (e) {
      setError(e.message || 'Erro ao salvar meta.');
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Remover meta de ${m}?`)) return;
    try {
      setError('');
      await api(`/monthly-goals/manage/${m}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message || 'Erro ao remover meta.');
    }
  };

  return (
    <div className='sheet' role='dialog' aria-modal='true' onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className='sheet-panel space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>Gestão</p>
            <h2 className='mt-1 truncate text-xl font-bold text-slate-900'>Metas mensais</h2>
            <p className='mt-1 text-sm text-slate-500'>Define o alvo geral por mês (YYYY-MM).</p>
          </div>
          <button type='button' onClick={onClose} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        {error && <div className='rounded-3xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'>{error}</div>}

        <section className='rounded-4xl bg-slate-50 p-3'>
          <p className='mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400'>Nova meta</p>
          <div className='flex items-center gap-2 rounded-3xl bg-white p-2 shadow-soft'>
            <span className='grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-indigo-500'><Target size={18} /></span>
            <input type='month' value={month} onChange={(e) => setMonth(e.target.value)} className='min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none' />
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode='decimal' placeholder='0,00' className='w-28 bg-transparent text-right text-sm font-semibold text-slate-800 outline-none' />
            <button type='button' onClick={save} className='rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold text-white'>Salvar</button>
          </div>
        </section>

        <section className='rounded-4xl bg-slate-50 p-3'>
          <div className='mb-2 flex items-center justify-between'>
            <p className='text-xs font-bold uppercase tracking-[0.14em] text-slate-400'>Metas cadastradas</p>
            <p className='text-xs font-semibold text-slate-400'>{sorted.length}</p>
          </div>
          {loading ? (
            <div className='empty-state shadow-none'>Carregando…</div>
          ) : sorted.length ? (
            <div className='space-y-2'>
              {sorted.map((g) => (
                <div key={g.month} className='flex items-center justify-between gap-2 rounded-3xl bg-white px-3 py-2 shadow-soft'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold text-slate-900'>{g.month}</p>
                    <p className='text-[11px] text-slate-400'>R$ {toPtbrMoney(g.value)}</p>
                  </div>
                  <button type='button' onClick={() => remove(g.month)} className='rounded-2xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600'>Remover</button>
                </div>
              ))}
            </div>
          ) : (
            <div className='empty-state shadow-none'>Nenhuma meta cadastrada.</div>
          )}
        </section>
      </div>
    </div>
  );
}

