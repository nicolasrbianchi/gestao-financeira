import React, { useState } from 'react';
import { Download, Inbox, LogOut, Server, Tags, Target } from 'lucide-react';
import ManageTagsSheet from '../components/ManageTagsSheet';
import ManageMonthlyGoalsSheet from '../components/ManageMonthlyGoalsSheet';
import ExportSheet from '../components/ExportSheet';

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

export default function More({ api, metadata = {}, onLogout, onOpenInbox }) {
  const [status, setStatus] = useState('');
  const [meta, setMeta] = useState('');
  const [checking, setChecking] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(null);

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

  const loadInboxCount = async () => {
    try {
      const r = await api('/imports/pending');
      setInboxCount((r.items || []).length);
    } catch {
      setInboxCount(null);
    }
  };

  // best-effort ao abrir a tela
  React.useEffect(() => { loadInboxCount(); /* eslint-disable-next-line */ }, []);

  return (
    <div className='space-y-4'>
      <header className='px-1'>
        <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Configurações</p>
        <h1 className='text-2xl font-bold text-slate-900'>Mais</h1>
        <p className='mt-1 text-sm text-slate-500'>Gestão do app e operação.</p>
      </header>

      <Row
        icon={Inbox}
        title='Importações pendentes'
        description={inboxCount == null ? '—' : `${inboxCount} pendente(s) para aprovar`}
        action={<button type='button' onClick={onOpenInbox} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Abrir</button>}
      />

      <Row
        icon={Tags}
        title='Categorias & classificações'
        description={`Gerenciar opções do app. Ativas: ${(metadata.categories || []).length} categorias · ${(metadata.subcategories || []).length} classificações.`}
        action={<button type='button' onClick={() => setManageOpen(true)} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Gerenciar</button>}
      />

      <Row
        icon={Target}
        title='Metas mensais'
        description='Defina a meta geral por mês (YYYY-MM).'
        action={<button type='button' onClick={() => setGoalsOpen(true)} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Gerenciar</button>}
      />

      <Row
        icon={Download}
        title='Exportar dados'
        description='Baixar backup e/ou transações.'
        action={<button type='button' onClick={() => setExportOpen(true)} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Exportar</button>}
      />

      <Row
        icon={Server}
        title='Status do sistema'
        description='Valida API e fonte de dados ativa.'
        action={<button type='button' onClick={testConnection} disabled={checking} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>{checking ? 'Testando…' : 'Testar conexão'}</button>}
      >
        {status && <p className='mt-3 break-words text-sm font-semibold text-slate-700'>{status}</p>}
        {meta && <p className='mt-1 text-xs text-slate-400'>{meta}</p>}
      </Row>


      <section className='card'>
        <button type='button' onClick={onLogout} className='flex w-full items-center justify-center gap-2 rounded-3xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600'>
          <LogOut size={17} />
          Sair da sessão
        </button>
      </section>

      <ManageTagsSheet open={manageOpen} onClose={() => setManageOpen(false)} api={api} />
      <ManageMonthlyGoalsSheet open={goalsOpen} onClose={() => setGoalsOpen(false)} api={api} />
      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
