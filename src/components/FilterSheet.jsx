import React, { useEffect, useState } from 'react';
import { defaultFilters } from '../utils/filters';

function options(values = []) {
  return [...new Set((values || []).filter(Boolean))];
}

export default function FilterSheet({ open, onClose, filters, setFilters, metadata = {} }) {
  const [local, setLocal] = useState(filters);

  useEffect(() => setLocal(filters), [filters, open]);

  if (!open) return null;

  const pick = (key, value) => setLocal((current) => ({ ...current, [key]: value }));
  const active = Object.entries(local).filter(([key, value]) => value && !['startDate', 'endDate'].includes(key)).length;
  const select = (key, label, values) => {
    const list = options(values);
    return (
      <label className='space-y-1 text-xs font-semibold text-slate-500'>
        <span>{label}</span>
        {list.length ? (
          <select value={local[key] || ''} onChange={(event) => pick(key, event.target.value)}>
            <option value=''>Todos</option>
            {list.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        ) : (
          <input value={local[key] || ''} onChange={(event) => pick(key, event.target.value)} placeholder={label} />
        )}
      </label>
    );
  };

  return (
    <div className='sheet' role='dialog' aria-modal='true' onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className='sheet-panel space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>Filtros</p>
            <h2 className='mt-1 text-xl font-bold text-slate-900'>Refinar transações</h2>
            <p className='mt-1 text-sm text-slate-500'>{active} filtro(s) ativo(s)</p>
          </div>
          <button type='button' onClick={onClose} className='rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <label className='min-w-0 space-y-1 text-xs font-semibold text-slate-500'>
            <span>Início</span>
            <input type='date' value={local.startDate || ''} onChange={(event) => pick('startDate', event.target.value)} />
          </label>
          <label className='min-w-0 space-y-1 text-xs font-semibold text-slate-500'>
            <span>Fim</span>
            <input type='date' value={local.endDate || ''} onChange={(event) => pick('endDate', event.target.value)} />
          </label>
        </div>

        <div className='grid grid-cols-1 gap-3'>
          {select('category', 'Categoria', metadata.categories)}
          {select('subcategory', 'Classificação', metadata.subcategories)}
          {select('account', 'Conta/Canal', metadata.accounts)}
          {select('type', 'Tipo', metadata.types)}
          {select('status', 'Status', metadata.statuses)}
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <button type='button' onClick={() => { const defaults = defaultFilters(); setLocal(defaults); setFilters(defaults); }} className='rounded-3xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600'>Limpar</button>
          <button type='button' onClick={() => { setFilters(local); onClose?.(); }} className='rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Aplicar</button>
        </div>
      </div>
    </div>
  );
}
