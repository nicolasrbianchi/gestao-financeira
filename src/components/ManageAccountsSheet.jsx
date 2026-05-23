import React, { useEffect, useMemo, useState } from 'react';
import { Landmark } from 'lucide-react';

function ItemRow({ item, onRename, onToggleActive }) {
  return (
    <div className='flex items-center justify-between gap-2 rounded-3xl bg-white px-3 py-2 shadow-soft'>
      <div className='min-w-0'>
        <p className={`truncate text-sm font-semibold ${item.isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{item.name}</p>
        <p className='text-[11px] text-slate-400'>id {item.id}</p>
      </div>
      <div className='flex shrink-0 items-center gap-2'>
        <button type='button' onClick={onRename} className='rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600'>Renomear</button>
        <button
          type='button'
          onClick={onToggleActive}
          className={`rounded-2xl px-3 py-2 text-xs font-bold ${item.isActive ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {item.isActive ? 'Arquivar' : 'Reativar'}
        </button>
      </div>
    </div>
  );
}

export default function ManageAccountsSheet({ open, onClose, api, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [newAccount, setNewAccount] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [seedTried, setSeedTried] = useState(false);

  const activeCount = useMemo(() => accounts.filter((a) => a.isActive).length, [accounts]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const r = await api(`/accounts/manage?includeInactive=${includeInactive ? 'true' : 'false'}`);
      const list = r.accounts || [];
      // Se ainda não tem nenhum canal cadastrado, faz seed automático a partir do histórico.
      if (!includeInactive && !seedTried && !list.length) {
        setSeedTried(true);
        await api('/accounts/manage/seed', { method: 'POST', body: '{}' }).catch(() => {});
        const r2 = await api(`/accounts/manage?includeInactive=false`).catch(() => ({ accounts: [] }));
        setAccounts(r2.accounts || []);
        onChanged?.();
      } else {
        setAccounts(list);
      }
    } catch (e) {
      setError(e.message || 'Erro ao carregar canais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, includeInactive]);

  if (!open) return null;

  const q = String(search || '').trim().toLowerCase();
  const byQuery = (item) => (!q ? true : String(item?.name || '').toLowerCase().includes(q));
  const sortActiveFirst = (a, b) => Number(!!b.isActive) - Number(!!a.isActive) || String(a.name).localeCompare(String(b.name));
  const view = (accounts || []).filter(byQuery).sort(sortActiveFirst);

  const create = async () => {
    try {
      setError('');
      const name = newAccount.trim();
      if (!name) return;
      await api('/accounts/manage', { method: 'POST', body: JSON.stringify({ name }) });
      setNewAccount('');
      onChanged?.();
      await load();
    } catch (e) {
      setError(e.message || 'Erro ao salvar.');
    }
  };

  const rename = async (item) => {
    const next = window.prompt('Novo nome:', item.name);
    if (!next) return;
    try {
      setError('');
      await api(`/accounts/manage/${item.id}`, { method: 'PUT', body: JSON.stringify({ name: next }) });
      onChanged?.();
      await load();
    } catch (e) {
      setError(e.message || 'Erro ao renomear.');
    }
  };

  const toggleActive = async (item) => {
    try {
      setError('');
      const isActive = !item.isActive;
      await api(`/accounts/manage/${item.id}`, { method: 'PUT', body: JSON.stringify({ isActive }) });
      onChanged?.();
      await load();
    } catch (e) {
      setError(e.message || 'Erro ao atualizar.');
    }
  };

  return (
    <div className='sheet' role='dialog' aria-modal='true' onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className='sheet-panel space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>Gestão</p>
            <h2 className='mt-1 truncate text-xl font-bold text-slate-900'>Canais</h2>
            <p className='mt-1 text-sm text-slate-500'>Ativos: {activeCount}</p>
          </div>
          <button type='button' onClick={onClose} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        <div className='flex items-center justify-between gap-2'>
          <div className='flex flex-1 items-center gap-2 rounded-3xl bg-white p-2 shadow-soft'>
            <span className='grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-indigo-500'><Landmark size={18} /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Buscar canal' className='min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none' />
          </div>
          <button
            type='button'
            onClick={() => setIncludeInactive((v) => !v)}
            className={`shrink-0 rounded-3xl px-4 py-3 text-xs font-extrabold ${includeInactive ? 'bg-slate-100 text-slate-700' : 'bg-slate-950 text-white'}`}
          >
            {includeInactive ? 'Mostrar só ativos' : 'Mostrar arquivados'}
          </button>
        </div>

        {error && <div className='rounded-3xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'>{error}</div>}

        <section className='rounded-4xl bg-slate-50 p-3'>
          <div className='mb-2 flex items-center justify-between'>
            <p className='text-xs font-bold uppercase tracking-[0.14em] text-slate-400'>Canais</p>
            <p className='text-xs font-semibold text-slate-400'>{view.length}</p>
          </div>

          <div className='grid grid-cols-1 gap-2'>
            <div className='flex items-center gap-2 rounded-3xl bg-white p-2 shadow-soft'>
              <span className='grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-indigo-500'><Landmark size={18} /></span>
              <input value={newAccount} onChange={(e) => setNewAccount(e.target.value)} placeholder='Novo canal' className='min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none' />
              <button type='button' onClick={create} className='rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold text-white'>Criar</button>
            </div>

            {loading ? <div className='empty-state shadow-none'>Carregando…</div> : view.map((a) => (
              <ItemRow
                key={a.id}
                item={a}
                onRename={() => rename(a)}
                onToggleActive={() => toggleActive(a)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
