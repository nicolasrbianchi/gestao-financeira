import React, { useState } from 'react';

const emptyTransaction = {
  data: new Date().toISOString().slice(0, 10),
  nome: '',
  tipo: '',
  reserva: '',
  conta: '',
  categoria: '',
  subcategoria: '',
  forma: '',
  valor: '',
  status: '',
  parcela: '',
  obs: ''
};

const fallback = {
  types: ['Receita', 'Despesa', 'Reserva'],
  statuses: ['Pago', 'Pendente'],
  reserves: ['Entrada', 'Saída']
};

function uniqueOptions(values = [], fallbackValues = []) {
  const merged = [...values, ...fallbackValues].filter(Boolean);
  return [...new Set(merged)];
}

export default function TransactionSheet({ open, onClose, metadata = {}, api, onSaved, onToast }) {
  const [form, setForm] = useState(emptyTransaction);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const input = (key, label, props = {}) => (
    <label className='space-y-1 text-xs font-semibold text-slate-500'>
      <span>{label}</span>
      <input value={form[key]} onChange={(event) => update(key, event.target.value)} {...props} />
    </label>
  );

  const select = (key, label, options, props = {}) => (
    <label className='space-y-1 text-xs font-semibold text-slate-500'>
      <span>{label}</span>
      <select value={form[key]} onChange={(event) => update(key, event.target.value)} {...props}>
        <option value=''>Selecione</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );

  const submit = async (event) => {
    event.preventDefault();

    if (!form.data || !form.nome || !form.tipo || !form.status || !form.valor) {
      setError('Preencha data, nome, tipo, status e valor.');
      return;
    }
    if (form.tipo === 'Reserva' && !form.reserva) {
      setError('Tipo Reserva exige o campo Reserva.');
      return;
    }

    try {
      setSaving(true);
      await api('/transactions', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyTransaction);
      onSaved?.();
    } catch (err) {
      const message = err.message || 'Erro ao salvar transação.';
      setError(message);
      onToast?.(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='sheet' role='dialog' aria-modal='true' onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <form className='sheet-panel space-y-4' onSubmit={submit}>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>Nova transação</p>
            <h2 className='mt-1 text-xl font-bold text-slate-900'>Adicionar lançamento</h2>
          </div>
          <button type='button' onClick={onClose} className='rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        <div className='grid grid-cols-1 gap-3'>
          {input('data', 'Data', { type: 'date', required: true })}
          {input('nome', 'Nome', { placeholder: 'Ex.: Mercado, Salário, Aluguel', required: true })}
          {select('tipo', 'Tipo', uniqueOptions(metadata.types, fallback.types), { required: true })}
          {form.tipo === 'Reserva' && select('reserva', 'Reserva', uniqueOptions(metadata.reserves, fallback.reserves), { required: true })}
          {input('valor', 'Valor', { inputMode: 'decimal', placeholder: '0,00', required: true })}
          {select('status', 'Status', uniqueOptions(metadata.statuses, fallback.statuses), { required: true })}
          {select('conta', 'Conta/Canal', uniqueOptions(metadata.accounts), {})}
          {select('categoria', 'Categoria', uniqueOptions(metadata.categories), {})}
          {select('subcategoria', 'Subcategoria', uniqueOptions(metadata.subcategories), {})}
          {select('forma', 'Forma', uniqueOptions(metadata.forms), {})}
          {form.tipo !== 'Reserva' && select('reserva', 'Reserva opcional', uniqueOptions(metadata.reserves, fallback.reserves), {})}
          {input('parcela', 'Parcela', { placeholder: 'Ex.: 1/3' })}
          {input('obs', 'Observações', { placeholder: 'Detalhe opcional' })}
        </div>

        {error && <p className='rounded-2xl bg-rose-50 p-3 text-sm text-rose-600'>{error}</p>}

        <button type='submit' disabled={saving} className='w-full rounded-3xl bg-slate-950 px-4 py-4 text-sm font-bold text-white shadow-soft'>
          {saving ? 'Salvando…' : 'Salvar transação'}
        </button>
      </form>
    </div>
  );
}
