import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Landmark, PiggyBank, Wallet } from 'lucide-react';

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

const typeIcons = { Receita: ArrowUpRight, Despesa: ArrowDownRight, Reserva: PiggyBank, Saldo: Wallet };

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
  const types = uniqueOptions(metadata.types, fallback.types);

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
            <h2 className='mt-1 text-xl font-bold text-slate-900'>{form.tipo ? `Lançar ${form.tipo}` : 'Adicionar lançamento'}</h2>
          </div>
          <button type='button' onClick={onClose} className='rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        <div className='grid grid-cols-4 gap-2'>
          {types.map((type) => {
            const Icon = typeIcons[type] || Wallet;
            const active = form.tipo === type;
            return (
              <button key={type} type='button' onClick={() => update('tipo', type)} className={`rounded-3xl border px-2 py-3 text-center text-[11px] font-bold transition active:scale-95 ${active ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100' : 'border-slate-500/20 bg-slate-50 text-slate-500'}`}>
                <Icon className='mx-auto mb-1' size={16} />
                {type}
              </button>
            );
          })}
        </div>

        <div className='grid grid-cols-2 gap-3'>
          {input('data', 'Data', { type: 'date', required: true })}
          {input('valor', 'Valor', { inputMode: 'decimal', placeholder: '0,00', required: true })}
        </div>

        <div className='rounded-4xl bg-slate-50 p-3'>
          <div className='mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400'>
            <Landmark size={14} /> Origem
          </div>
          <div className='grid grid-cols-1 gap-3'>
            {select('conta', 'Conta/Canal', uniqueOptions(metadata.accounts), { required: true })}
            {!isBalance && input('nome', 'Nome', { placeholder: isReserve ? 'Ex.: Reserva emergência' : 'Ex.: Mercado, Salário', required: true })}
            {isBalance && (
              <label className='space-y-1 text-xs font-semibold text-slate-500'>
                <span>Categoria</span>
                <input value={TRANSFER_CATEGORY} disabled />
              </label>
            )}
          </div>
        </div>

        {isReserve && (
          <div className='rounded-4xl bg-slate-50 p-3'>
            {select('reserva', 'Movimento da reserva', uniqueOptions(metadata.reserves, fallback.reserves), { required: true })}
          </div>
        )}

        {isIncomeOrExpense && (
          <div className='rounded-4xl bg-slate-50 p-3'>
            <p className='mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400'>Classificação</p>
            <div className='grid grid-cols-1 gap-3'>
              {select('categoria', 'Categoria', uniqueOptions(metadata.categories, fallback.categories), { required: true })}
              <div className='grid grid-cols-2 gap-3'>
                {select('subcategoria', 'Subcategoria', uniqueOptions(metadata.subcategories, fallback.subcategories), { required: true })}
                {select('forma', 'Forma', uniqueOptions(paymentMethods, fallback.paymentMethods), { required: true })}
              </div>
              {select('status', 'Status opcional', uniqueOptions(metadata.statuses, fallback.statuses), {})}
            </div>
          </div>
        )}

        {isIncomeOrExpense && (
          <details className='rounded-4xl bg-slate-50 p-3 text-sm text-slate-500'>
            <summary className='cursor-pointer font-bold text-slate-700'>Mais detalhes</summary>
            <div className='mt-3 grid grid-cols-1 gap-3'>
              {input('parcela', 'Parcela opcional', { placeholder: 'Ex.: 1/3' })}
              {input('obs', 'Observações opcionais', { placeholder: 'Detalhe opcional' })}
            </div>
          </details>
        )}

        {error && <p className='rounded-2xl bg-rose-50 p-3 text-sm text-rose-600'>{error}</p>}

        <button type='submit' disabled={saving} className='sticky bottom-0 w-full rounded-3xl bg-slate-950 px-4 py-4 text-sm font-bold text-white shadow-soft'>
          {saving ? 'Salvando…' : 'Salvar transação'}
        </button>
      </form>
    </div>
  );
}
