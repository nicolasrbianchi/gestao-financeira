import React, { useState } from 'react';

const TRANSFER_CATEGORY = 'Transferencia entre contas';

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
  types: ['Receita', 'Despesa', 'Reserva', 'Saldo'],
  statuses: ['Pendente', 'Pago em dia', 'Pago em atraso', 'Recebido em dia', 'Recebido em atraso'],
  reserves: ['Entrada', 'Saida'],
  subcategories: ['Essencial', 'Extra'],
  paymentMethods: ['Débito', 'Crédito', 'Pix', 'Boleto', 'Depósito'],
  categories: [TRANSFER_CATEGORY]
};

function uniqueOptions(values = [], fallbackValues = []) {
  const merged = [...values, ...fallbackValues].filter(Boolean);
  return [...new Set(merged)];
}

function defaultStatus(type) {
  if (type === 'Receita' || type === 'Saldo') return 'Recebido em dia';
  if (type === 'Despesa' || type === 'Reserva') return 'Pago em dia';
  return '';
}

export default function TransactionSheet({ open, onClose, metadata = {}, api, onSaved, onToast }) {
  const [form, setForm] = useState(emptyTransaction);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const update = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'tipo') {
        next.reserva = value === 'Reserva' ? next.reserva : '';
        next.categoria = value === 'Saldo' ? TRANSFER_CATEGORY : value === 'Reserva' ? '' : next.categoria;
        next.subcategoria = ['Reserva', 'Saldo'].includes(value) ? '' : next.subcategoria;
        next.forma = ['Reserva', 'Saldo'].includes(value) ? '' : next.forma;
        next.status = next.status || defaultStatus(value);
      }
      return next;
    });
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

  const isIncomeOrExpense = ['Receita', 'Despesa'].includes(form.tipo);
  const isReserve = form.tipo === 'Reserva';
  const isBalance = form.tipo === 'Saldo';
  const paymentMethods = metadata.paymentMethods || metadata.forms || [];

  const validate = () => {
    if (!form.data || !form.tipo || !form.conta || !form.valor) return 'Preencha data, tipo, conta/canal e valor.';
    if (!isBalance && !form.nome) return 'Preencha o nome da transação.';
    if (isReserve && !form.reserva) return 'Reserva exige Entrada ou Saida.';
    if (isIncomeOrExpense && (!form.categoria || !form.subcategoria || !form.forma)) return 'Receita e Despesa exigem categoria, subcategoria e forma.';
    if (isBalance && !form.categoria) return 'Saldo exige categoria.';
    return '';
  };

  const submit = async (event) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        nome: form.nome || (isBalance ? `Saldo ${form.conta}` : form.nome),
        status: form.status || defaultStatus(form.tipo),
        categoria: isBalance ? TRANSFER_CATEGORY : form.categoria,
      };
      await api('/transactions', { method: 'POST', body: JSON.stringify(payload) });
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
          {select('tipo', 'Tipo', uniqueOptions(metadata.types, fallback.types), { required: true })}
          {input('valor', 'Valor', { inputMode: 'decimal', placeholder: '0,00', required: true })}
          {select('conta', 'Conta/Canal', uniqueOptions(metadata.accounts), { required: true })}

          {!isBalance && input('nome', 'Nome', { placeholder: 'Ex.: Mercado, Salário, Reserva', required: true })}
          {isBalance && (
            <label className='space-y-1 text-xs font-semibold text-slate-500'>
              <span>Categoria</span>
              <input value={TRANSFER_CATEGORY} disabled />
            </label>
          )}
          {isReserve && select('reserva', 'Entrada ou Saida', uniqueOptions(metadata.reserves, fallback.reserves), { required: true })}
          {isIncomeOrExpense && select('categoria', 'Categoria', uniqueOptions(metadata.categories, fallback.categories), { required: true })}
          {isIncomeOrExpense && select('subcategoria', 'Subcategoria', uniqueOptions(metadata.subcategories, fallback.subcategories), { required: true })}
          {isIncomeOrExpense && select('forma', 'Forma', uniqueOptions(paymentMethods, fallback.paymentMethods), { required: true })}

          {isIncomeOrExpense && select('status', 'Status opcional', uniqueOptions(metadata.statuses, fallback.statuses), {})}
          {isIncomeOrExpense && input('parcela', 'Parcela opcional', { placeholder: 'Ex.: 1/3' })}
          {isIncomeOrExpense && input('obs', 'Observações opcionais', { placeholder: 'Detalhe opcional' })}
        </div>

        {error && <p className='rounded-2xl bg-rose-50 p-3 text-sm text-rose-600'>{error}</p>}

        <button type='submit' disabled={saving} className='w-full rounded-3xl bg-slate-950 px-4 py-4 text-sm font-bold text-white shadow-soft'>
          {saving ? 'Salvando…' : 'Salvar transação'}
        </button>
      </form>
    </div>
  );
}
