import React, { useState } from 'react';
import { CalendarDays, Database, Filter, LogOut, RefreshCcw, Server, ShieldCheck, SlidersHorizontal, Tags } from 'lucide-react';
import { mtdFilters, filterChip } from '../utils/filters';
import ManageTagsSheet from '../components/ManageTagsSheet';
import ManageMonthlyGoalsSheet from '../components/ManageMonthlyGoalsSheet';

function Row({ icon: Icon, title, description, action, children }) {
  return (
    <article className='card'>
      <div className='flex items-start gap-3'>
        <span className='grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-50 text-indigo-500'>{Icon && <Icon size={18} />}</span>
        <div className='min-w-0 flex-1'>
          <h2 className='font-bold text-slate-900'>{title}</h2>
          {description && <p className='mt-1 text-sm text-slate-500'>{description}</p>}
          {children}
        </div>
      </div>
      {action && <div className='mt-4'>{action}</div>}
    </article>
  );
}

export default function More({ api, metadata = {}, filters, setFilters, onOpenFilters, onReload, onLogout }) {
  const [status, setStatus] = useState('');
  const [meta, setMeta] = useState('');
  const [checking, setChecking] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const testConnection = async () => {
    try {
      setChecking(true);
      const response = await api('/health');
      const ds = response.dataSource || 'appsScript';
      setStatus(response.data?.ok ? `API conectada (fonte: ${ds})` : `API conectada, mas fonte de dados falhou (${ds})`);
      setMeta(`v${response.app?.version || '0.0.0'} · ${response.nodeEnv || 'ambiente indefinido'}`);
    } catch (error) {
      setStatus(error.message || 'Falha ao testar conexão');
      setMeta('');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className='space-y-4'>
      <header className='px-1'>
        <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Configurações</p>
        <h1 className='text-2xl font-bold text-slate-900'>Mais</h1>
        <p className='mt-1 text-sm text-slate-500'>Preferências, filtros e saúde da conexão.</p>
      </header>

      <Row
        icon={SlidersHorizontal}
        title='Filtros globais'
        description={filterChip(filters) || 'MTD'}
        action={(
          <div className='grid grid-cols-2 gap-3'>
            <button type='button' onClick={onOpenFilters} className='flex items-center justify-center gap-2 rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'><Filter size={16} /> Ajustar</button>
            <button type='button' onClick={() => setFilters?.(mtdFilters())} className='flex items-center justify-center gap-2 rounded-3xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600'><CalendarDays size={16} /> MTD</button>
          </div>
        )}
      />

      <section className='grid grid-cols-2 gap-3'>
        <article className='rounded-4xl bg-white p-4 shadow-soft'>
          <Tags className='text-indigo-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Categorias</p>
          <p className='mt-1 text-xl font-bold'>{(metadata.categories || []).length}</p>
        </article>
        <article className='rounded-4xl bg-white p-4 shadow-soft'>
          <Database className='text-emerald-500' size={18} />
          <p className='mt-3 text-xs text-slate-500'>Contas</p>
          <p className='mt-1 text-xl font-bold'>{(metadata.accounts || []).length}</p>
        </article>
      </section>

      <Row
        icon={Tags}
        title='Gerenciar categorias'
        description='Criar, renomear e arquivar categorias/subcategorias (apenas em DATA_SOURCE=db).'
        action={<button type='button' onClick={() => setManageOpen(true)} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Abrir gestão</button>}
      />

      <Row
        icon={Tags}
        title='Gerenciar metas mensais'
        description='Define a meta geral por mês (apenas em DATA_SOURCE=db).'
        action={<button type='button' onClick={() => setGoalsOpen(true)} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Abrir metas</button>}
      />

      <Row
        icon={Server}
        title='Conexão'
        description='Valida API, sessão e Apps Script.'
        action={<button type='button' onClick={testConnection} disabled={checking} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>{checking ? 'Testando…' : 'Testar conexão'}</button>}
      >
        {status && <p className='mt-3 break-words text-sm font-semibold text-slate-700'>{status}</p>}
        {meta && <p className='mt-1 text-xs text-slate-400'>{meta}</p>}
      </Row>

      <Row
        icon={RefreshCcw}
        title='Dados do app'
        description='Recarrega os dados da aba atual e metadados básicos.'
        action={<button type='button' onClick={onReload} className='w-full rounded-3xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600'>Recarregar dados</button>}
      />

      <Row icon={ShieldCheck} title='Regras ativas' description='Sessão HTTP-only · fonte de dados selecionada via env · transferência especial · saldo por snapshot.'>
        <div className='mt-3 flex flex-wrap gap-2'>
          <span className='badge'>Saldo = histórico até o fim do período</span>
          <span className='badge'>Meta geral</span>
          <span className='badge'>Transferência especial</span>
        </div>
      </Row>

      <section className='card'>
        <button type='button' onClick={onLogout} className='flex w-full items-center justify-center gap-2 rounded-3xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600'>
          <LogOut size={17} />
          Sair da sessão
        </button>
      </section>

      <ManageTagsSheet open={manageOpen} onClose={() => setManageOpen(false)} api={api} />
      <ManageMonthlyGoalsSheet open={goalsOpen} onClose={() => setGoalsOpen(false)} api={api} />
    </div>
  );
}
