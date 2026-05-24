import React, { useEffect, useMemo, useState } from 'react';
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

export default function TransactionSheet({ open, onClose, metadata = {}, api, onSaved, onToast, initialTransaction = null, mode = 'add', submitPath = null }) {

  const [form, setForm] = useState(emptyTransaction);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = useMemo(() => {
    const row = initialTransaction?.id ?? initialTransaction?.sheetRowNumber ?? initialTransaction?.row ?? null;
    return mode === 'edit' || (row != null);
  }, [initialTransaction, mode]);

  const toPtbrMoneyInput = (amount) => {
    if (amount == null || Number.isNaN(Number(amount))) return '';
    const n = Number(amount);
    if (!Number.isFinite(n)) return '';
    return n.toFixed(2).replace('.', ',');
  };

  // Quando abre (ou troca a transação), preenche o formulário.
  useEffect(() => {
    if (!open) return;
    if (!initialTransaction) {
      setForm(emptyTransaction);
      setError('');
      return;
    }

    setForm({
      data: initialTransaction.date || initialTransaction.data || new Date().toISOString().slice(0, 10),
      nome: initialTransaction.name || initialTransaction.nome || '',
      tipo: initialTransaction.type || initialTransaction.tipo || '',
      reserva: initialTransaction.reserve || initialTransaction.reserva || '',
      conta: initialTransaction.account || initialTransaction.conta || '',
      categoria: initialTransaction.category || initialTransaction.categoria || '',
      subcategoria: initialTransaction.subcategory || initialTransaction.subcategoria || '',
      forma: initialTransaction.paymentMethod || initialTransaction.forma || '',
      valor: initialTransaction.valor || toPtbrMoneyInput(initialTransaction.amount),
      status: initialTransaction.status || '',
      parcela: initialTransaction.installment || initialTransaction.parcela || '',
      obs: initialTransaction.notes || initialTransaction.obs || '',
    });
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTransaction]);

  if (!open) return null;

  const formatMoneyInput = (raw) => {
    let s = String(raw || '').trim();
    if (!s) return '';

    // Normaliza: mantém só dígitos e separadores.
    s = s.replace(/\s/g, '').replace(/R\$/gi, '').replace(/[^\d.,]/g, '');
    if (!s) return '';

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const hasComma = lastComma !== -1;
    const hasDot = lastDot !== -1;
    const decimalSep = hasComma && hasDot
      ? (lastComma > lastDot ? ',' : '.')
      : (hasComma ? ',' : (hasDot ? '.' : null));

    let intPart = '';
    let fracPart = '';
    if (decimalSep) {
      const idx = s.lastIndexOf(decimalSep);
      intPart = s.slice(0, idx);
      fracPart = s.slice(idx + 1);
    } else {
      intPart = s;
      fracPart = '';
    }

    // Remove outros separadores do inteiro.
    intPart = intPart.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '');
    if (!intPart) intPart = '0';

    // Fração: pega só dígitos, limita 2.
    fracPart = fracPart.replace(/\D/g, '').slice(0, 2);

    // Se não veio separador decimal, tratamos como "valor em reais" e completamos ,00.
    if (!decimalSep) fracPart = '';

    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const frac = fracPart.padEnd(2, '0');
    return `${withThousands},${frac}`;
  };

  const update = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'tipo') {
        next.reserva = value === 'Reserva' ? next.reserva : '';
        next.categoria = value === 'Saldo' ? TRANSFER_CATEGORY : value === 'Reserva' ? '' : next.categoria;
        next.subcategoria = ['Reserva', 'Saldo'].includes(value) ? '' : next.subcategoria;
        next.forma = ['Reserva', 'Saldo'].includes(value) ? '' : next.forma;
        next.parcela = ['Reserva', 'Saldo'].includes(value) ? '' : next.parcela;
        next.obs = ['Reserva', 'Saldo'].includes(value) ? '' : next.obs;
        next.status = current.status || defaultStatus(value);
      }
      return next;
    });
    setError('');
  };

  const sanitizeMoneyDraft = (raw) => {
    // Mantém digitável: só corta caracteres estranhos.
    return String(raw || '').replace(/\s/g, '').replace(/R\$/gi, '').replace(/[^\d.,]/g, '');
  };

  const input = (key, label, props = {}) => (
    <label className='space-y-1 text-xs font-semibold text-slate-500'>
      <span>{label}</span>
      <input
        value={form[key]}
        onChange={(event) => {
          if (key === 'valor') return update(key, sanitizeMoneyDraft(event.target.value));
          return update(key, event.target.value);
        }}
        onBlur={(event) => {
          if (key !== 'valor') return;
          const v = String(event.target.value || '').trim();
          if (!v) return;
          update(key, formatMoneyInput(v));
        }}
        {...props}
      />
    </label>
  );

  const selectOrInput = (key, label, options, props = {}) => {
    const list = uniqueOptions(options);
    return (
      <label className='space-y-1 text-xs font-semibold text-slate-500'>
        <span>{label}</span>
        {list.length ? (
          <select value={form[key]} onChange={(event) => update(key, event.target.value)} {...props}>
            <option value=''>Selecione</option>
            {list.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : (
          <input value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder={label} {...props} />
        )}
      </label>
    );
  };

  const isIncomeOrExpense = ['Receita', 'Despesa'].includes(form.tipo);
  const isReserve = form.tipo === 'Reserva';
  const isBalance = form.tipo === 'Saldo';
  const paymentMethods = metadata.paymentMethods || metadata.forms || [];
  const types = uniqueOptions(metadata.types, fallback.types);

  const validate = () => {
    if (!form.tipo) return 'Escolha o tipo do lançamento.';
    if (!form.data || !form.conta || !form.valor) return 'Preencha data, conta/canal e valor.';
    if (!isBalance && !form.nome) return 'Preencha o nome da transação.';
    if (isReserve && !form.reserva) return 'Reserva exige Entrada ou Saida.';
    if (isIncomeOrExpense && (!form.categoria || !form.subcategoria || !form.forma)) return 'Receita e Despesa exigem categoria, classificação e forma.';
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

      if (isEdit) {
        const id = initialTransaction?.id ?? initialTransaction?.sheetRowNumber ?? initialTransaction?.row;
        await api(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api(submitPath || '/transactions', { method: 'POST', body: JSON.stringify(payload) });
      }
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
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>{isEdit ? 'Editar transação' : 'Nova transação'}</p>
            <h2 className='mt-1 truncate text-xl font-bold text-slate-900'>{form.tipo ? `${isEdit ? 'Editando' : 'Lançar'} ${form.tipo}` : (isEdit ? 'Editar lançamento' : 'Adicionar lançamento')}</h2>
          </div>
          <button type='button' onClick={onClose} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        <div className='grid grid-cols-2 gap-2'>
          {types.map((type) => {
            const Icon = typeIcons[type] || Wallet;
            const active = form.tipo === type;
            return (
              <button key={type} type='button' onClick={() => update('tipo', type)} className={`min-h-[58px] rounded-3xl border px-3 py-2 text-left text-xs font-bold transition active:scale-95 ${active ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100' : 'border-slate-500/20 bg-slate-50 text-slate-500'}`}>
                <span className='flex items-center gap-2'><Icon size={16} /> {type}</span>
              </button>
            );
          })}
        </div>

        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {input('data', 'Data', { type: 'date', required: true })}
          {input('valor', 'Valor', { inputMode: 'decimal', placeholder: '0,00', required: true, autoComplete: 'off' })}
        </div>

        <div className='rounded-4xl bg-slate-50 p-3'>
          <div className='mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400'>
            <Landmark size={14} /> Dados principais
          </div>
          <div className='grid grid-cols-1 gap-3'>
            {selectOrInput('conta', 'Conta/Canal', metadata.accounts, { required: true })}
            {!isBalance && input('nome', 'Nome', { placeholder: isReserve ? 'Ex.: Reserva emergência' : 'Ex.: Mercado, Salário', required: true })}
            {isBalance && (
              <label className='space-y-1 text-xs font-semibold text-slate-500'>
                <span>Categoria</span>
                <input value={TRANSFER_CATEGORY} disabled />
              </label>
            )}
            {isReserve && selectOrInput('reserva', 'Entrada ou Saida', uniqueOptions(metadata.reserves, fallback.reserves), { required: true })}
          </div>
        </div>

        {isIncomeOrExpense && (
          <div className='rounded-4xl bg-slate-50 p-3'>
            <p className='mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400'>Classificação</p>
            <div className='grid grid-cols-1 gap-3'>
              {selectOrInput('categoria', 'Categoria', uniqueOptions(metadata.categories, fallback.categories), { required: true })}
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                {selectOrInput('subcategoria', 'Classificação', uniqueOptions(metadata.subcategories, fallback.subcategories), { required: true })}
                {selectOrInput('forma', 'Forma', uniqueOptions(paymentMethods, fallback.paymentMethods), { required: true })}
              </div>
              {selectOrInput('status', 'Status opcional', uniqueOptions(metadata.statuses, fallback.statuses), {})}
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

        <button type='submit' disabled={saving} className='w-full rounded-3xl bg-slate-950 px-4 py-4 text-sm font-bold text-white shadow-soft'>
          {saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Salvar transação')}
        </button>
      </form>
    </div>
  );
}
