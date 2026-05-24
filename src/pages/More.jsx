import React, { useState } from 'react';
import { Bell, Download, Landmark, Link2, LogOut, Server, Tags, Target, Trash2 } from 'lucide-react';
import ManageTagsSheet from '../components/ManageTagsSheet';
import ManageMonthlyGoalsSheet from '../components/ManageMonthlyGoalsSheet';
import ExportSheet from '../components/ExportSheet';
import ManageAccountsSheet from '../components/ManageAccountsSheet';
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from '../utils/push';

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

export default function More({ api, metadata = {}, onLogout, onToast, onReload }) {
  const [status, setStatus] = useState('');
  const [meta, setMeta] = useState('');
  const [checking, setChecking] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pluggyItems, setPluggyItems] = useState([]);
  const [pushState, setPushState] = useState({ supported: false, permission: 'default', subscribed: false });

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

  const loadPluggy = async () => {
    try {
      const r = await api('/pluggy/items');
      setPluggyItems(r.items || []);
    } catch {
      setPluggyItems([]);
    }
  };

  React.useEffect(() => { loadPluggy(); /* eslint-disable-next-line */ }, []);

  const refreshPushState = async () => {
    try {
      const supported = isPushSupported();
      const permission = supported ? (Notification.permission || 'default') : 'unsupported';
      let subscribed = false;
      if (supported) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription?.();
        subscribed = !!sub;
      }
      setPushState({ supported, permission, subscribed });
    } catch {
      setPushState({ supported: false, permission: 'default', subscribed: false });
    }
  };

  React.useEffect(() => { void refreshPushState(); /* eslint-disable-next-line */ }, []);

  const openMeuPluggy = () => {
    // Ao abrir o painel manual do MeuPluggy, aumentamos temporariamente o ritmo do fetch
    // para capturar as novidades mais rápido enquanto o usuário clica em "Atualizar".
    try {
      localStorage.setItem('gf_pluggy_fetch_boost_until_ms', String(Date.now() + 5 * 60 * 1000));
      window.dispatchEvent(new Event('gf_pluggy_boost'));
    } catch {
      // ignore
    }
    window.open('https://meu.pluggy.ai/connections', '_blank', 'noopener,noreferrer');
    onToast?.('Abra o Meu Pluggy e clique em atualizar conexão.');
  };

  const pruneInboxToLastDays = async (days = 3) => {
    const ok = window.confirm(
      `Isso vai APAGAR da inbox (pendentes Pluggy) tudo que for mais antigo que ${days} dias.\n\n` +
      `Use quando entrou uma leva grande no primeiro import.\n\nContinuar?`
    );
    if (!ok) return;
    try {
      await api('/imports/prune', { method: 'POST', body: JSON.stringify({ days, onlyPending: true }) });
      await api('/pluggy/items/ignore-before/last-days', { method: 'POST', body: JSON.stringify({ days, rewind: true }) });
      // roda um fetch em burst (a rota já usa janela rolante de N dias)
      await api('/pluggy/fetch-transactions', { method: 'POST', body: JSON.stringify({ burst: true }) });
      onToast?.(`Inbox limpa. Mantidas só pendências dos últimos ${days} dias.`);
      onReload?.();
    } catch (e) {
      onToast?.(e?.message || 'Erro ao limpar inbox.');
    }
  };

  const enablePush = async () => {
    try {
      await subscribeToPush(api);
      onToast?.('Push ativado neste dispositivo ✅');
      await refreshPushState();
    } catch (e) {
      onToast?.(e?.message || 'Não consegui ativar push.');
      await refreshPushState();
    }
  };

  const disablePush = async () => {
    try {
      await unsubscribeFromPush(api);
      onToast?.('Push desativado.');
      await refreshPushState();
    } catch (e) {
      onToast?.(e?.message || 'Erro ao desativar push.');
    }
  };

  const testPush = async () => {
    try {
      await api('/push/test', { method: 'POST', body: JSON.stringify({}) });
      onToast?.('Enviei um push de teste.');
    } catch (e) {
      onToast?.(e?.message || 'Erro ao enviar push.');
    }
  };

  return (
    <div className='space-y-4'>
      <header className='px-1'>
        <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Configurações</p>
        <h1 className='text-2xl font-bold text-slate-900'>Mais</h1>
        <p className='mt-1 text-sm text-slate-500'>Gestão do app e operação.</p>
      </header>

      <Row
        icon={Link2}
        title='Conectar banco (MeuPluggy)'
        description={pluggyItems.length ? `${pluggyItems.length} conexão(ões) ativa(s)` : 'Abra o MeuPluggy para conectar/atualizar seus bancos.'}
        action={<button type='button' onClick={openMeuPluggy} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Abrir Meu Pluggy</button>}
      />

      <Row
        icon={Bell}
        title='Notificações push (celular)'
        description={
          !pushState.supported
            ? 'Este navegador não suporta push. (No iOS: só funciona se o app estiver instalado na Tela de Início.)'
            : pushState.permission === 'denied'
              ? 'Permissão negada no sistema. Precisa liberar nas configurações do navegador.'
              : pushState.subscribed
                ? 'Ativo neste dispositivo.'
                : 'Ative para receber alertas como um app.'
        }
        action={(
          <div className='flex gap-2'>
            {!pushState.supported || pushState.permission === 'denied' ? (
              <button type='button' disabled className='w-full rounded-3xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-500'>Indisponível</button>
            ) : pushState.subscribed ? (
              <>
                <button type='button' onClick={testPush} className='flex-1 rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Teste</button>
                <button type='button' onClick={disablePush} className='flex-1 rounded-3xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600'>Desativar</button>
              </>
            ) : (
              <button type='button' onClick={enablePush} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Ativar push</button>
            )}
          </div>
        )}
      />

      <Row
        icon={Trash2}
        title='Limpar inbox do Open Finance'
        description='Se no primeiro import entrou histórico demais, limpe as pendências antigas agora.'
        action={<button type='button' onClick={() => pruneInboxToLastDays(3)} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Manter só últimos 3 dias (agora)</button>}
      />

      <Row
        icon={Landmark}
        title='Canais'
        description={`Gerenciar contas/canais do app. Ativos: ${(metadata.accounts || []).length}.`}
        action={<button type='button' onClick={() => setAccountsOpen(true)} className='w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>Gerenciar</button>}
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
      <ManageAccountsSheet
        open={accountsOpen}
        onClose={() => {
          setAccountsOpen(false);
          onReload?.();
        }}
        api={api}
        onChanged={() => onReload?.()}
      />
      <ManageMonthlyGoalsSheet open={goalsOpen} onClose={() => setGoalsOpen(false)} api={api} />
      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
