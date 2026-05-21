import React, { useEffect, useMemo, useState } from 'react';
import { Tags } from 'lucide-react';

function Section({ title, count, children }) {
  return (
    <section className='rounded-4xl bg-slate-50 p-3'>
      <div className='mb-2 flex items-center justify-between'>
        <p className='text-xs font-bold uppercase tracking-[0.14em] text-slate-400'>{title}</p>
        <p className='text-xs font-semibold text-slate-400'>{count}</p>
      </div>
      {children}
    </section>
  );
}

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

export default function ManageTagsSheet({ open, onClose, api }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');

  const activeCounts = useMemo(
    () => ({
      categories: categories.filter((c) => c.isActive).length,
      subcategories: subcategories.filter((c) => c.isActive).length,
    }),
    [categories, subcategories]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [c, s] = await Promise.all([
        api(`/categories/manage?includeInactive=${includeInactive ? 'true' : 'false'}`),
        api(`/subcategories/manage?includeInactive=${includeInactive ? 'true' : 'false'}`),
      ]);
      setCategories(c.categories || []);
      setSubcategories(s.subcategories || []);
    } catch (e) {
      setError(e.message || 'Erro ao carregar categorias.');
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
  const categoriesView = (categories || []).filter(byQuery).sort(sortActiveFirst);
  const subcategoriesView = (subcategories || []).filter(byQuery).sort(sortActiveFirst);

  const create = async (kind) => {
    try {
      setError('');
      if (kind === 'category') {
        const name = newCategory.trim();
        if (!name) return;
        await api('/categories/manage', { method: 'POST', body: JSON.stringify({ name }) });
        setNewCategory('');
      } else {
        const name = newSubcategory.trim();
        if (!name) return;
        await api('/subcategories/manage', { method: 'POST', body: JSON.stringify({ name }) });
        setNewSubcategory('');
      }
      await load();
    } catch (e) {
      setError(e.message || 'Erro ao salvar.');
    }
  };

  const rename = async (kind, item) => {
    const next = window.prompt('Novo nome:', item.name);
    if (!next) return;
    try {
      setError('');
      if (kind === 'category') {
        await api(`/categories/manage/${item.id}`, { method: 'PUT', body: JSON.stringify({ name: next }) });
      } else {
        await api(`/subcategories/manage/${item.id}`, { method: 'PUT', body: JSON.stringify({ name: next }) });
      }
      await load();
    } catch (e) {
      setError(e.message || 'Erro ao renomear.');
    }
  };

  const toggleActive = async (kind, item) => {
    try {
      setError('');
      const isActive = !item.isActive;
      if (kind === 'category') {
        await api(`/categories/manage/${item.id}`, { method: 'PUT', body: JSON.stringify({ isActive }) });
      } else {
        await api(`/subcategories/manage/${item.id}`, { method: 'PUT', body: JSON.stringify({ isActive }) });
      }
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
            <h2 className='mt-1 truncate text-xl font-bold text-slate-900'>Categorias</h2>
            <p className='mt-1 text-sm text-slate-500'>Ativas: {activeCounts.categories} · Classificações ativas: {activeCounts.subcategories}</p>
          </div>
          <button type='button' onClick={onClose} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        <div className='flex items-center justify-between gap-2'>
          <div className='flex flex-1 items-center gap-2 rounded-3xl bg-white p-2 shadow-soft'>
            <span className='grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-indigo-500'><Tags size={18} /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Buscar categoria/classificação' className='min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none' />
          </div>
          <button
            type='button'
            onClick={() => setIncludeInactive((v) => !v)}
            className={`shrink-0 rounded-3xl px-4 py-3 text-xs font-extrabold ${includeInactive ? 'bg-slate-100 text-slate-700' : 'bg-slate-950 text-white'}`}
          >
            {includeInactive ? 'Mostrar só ativas' : 'Mostrar arquivadas'}
          </button>
        </div>

        {error && <div className='rounded-3xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'>{error}</div>}

        <Section title='Categorias' count={`${categoriesView.length} ${includeInactive ? 'no filtro' : 'ativas'}`}> 
          <div className='grid grid-cols-1 gap-2'>
            <div className='flex items-center gap-2 rounded-3xl bg-white p-2 shadow-soft'>
              <span className='grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-indigo-500'><Tags size={18} /></span>
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder='Nova categoria' className='min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none' />
              <button type='button' onClick={() => create('category')} className='rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold text-white'>Criar</button>
            </div>
            {loading ? <div className='empty-state shadow-none'>Carregando…</div> : categoriesView.map((c) => (
              <ItemRow
                key={c.id}
                item={c}
                onRename={() => rename('category', c)}
                onToggleActive={() => toggleActive('category', c)}
              />
            ))}
          </div>
        </Section>

        <Section title='Classificações (globais)' count={`${subcategoriesView.length} ${includeInactive ? 'no filtro' : 'ativas'}`}>
          <div className='grid grid-cols-1 gap-2'>
            <div className='flex items-center gap-2 rounded-3xl bg-white p-2 shadow-soft'>
              <span className='grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-indigo-500'><Tags size={18} /></span>
              <input value={newSubcategory} onChange={(e) => setNewSubcategory(e.target.value)} placeholder='Nova classificação' className='min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none' />
              <button type='button' onClick={() => create('subcategory')} className='rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold text-white'>Criar</button>
            </div>
            {loading ? <div className='empty-state shadow-none'>Carregando…</div> : subcategoriesView.map((s) => (
              <ItemRow
                key={s.id}
                item={s}
                onRename={() => rename('subcategory', s)}
                onToggleActive={() => toggleActive('subcategory', s)}
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
