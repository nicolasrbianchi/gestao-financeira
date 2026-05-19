import React, { useState } from 'react';
import { LogOut, Server, Tags } from 'lucide-react';

export default function More({ api, metadata = {}, onLogout }) {
  const [status, setStatus] = useState('');
  const [meta, setMeta] = useState('');
  const [checking, setChecking] = useState(false);

  const testConnection = async () => {
    try {
      setChecking(true);
      const response = await api('/health');
      setStatus(response.appsScript?.ok ? 'API e Apps Script conectados' : 'API conectada, mas Apps Script falhou');
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
        <p className='mt-1 text-sm text-slate-500'>Status, conexão e sessão.</p>
      </header>

      <section className='card'>
        <div className='flex items-start gap-3'>
          <span className='grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600'><Server size={18} /></span>
          <div className='min-w-0 flex-1'>
            <h2 className='font-bold text-slate-900'>Conexão</h2>
            <p className='mt-1 text-sm text-slate-500'>Valida API, sessão e Apps Script.</p>
          </div>
        </div>
        <button type='button' onClick={testConnection} disabled={checking} className='mt-4 w-full rounded-3xl bg-slate-950 px-4 py-3 text-sm font-bold text-white'>
          {checking ? 'Testando…' : 'Testar conexão'}
        </button>
        {status && <p className='mt-3 break-words text-sm font-semibold text-slate-700'>{status}</p>}
        {meta && <p className='mt-1 text-xs text-slate-400'>{meta}</p>}
      </section>

      <section className='card'>
        <div className='flex items-start gap-3'>
          <span className='grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600'><Tags size={18} /></span>
          <div className='min-w-0 flex-1'>
            <h2 className='font-bold text-slate-900'>Metadados</h2>
            <p className='mt-1 text-sm text-slate-500'>Categorias: {(metadata.categories || []).length} · Contas: {(metadata.accounts || []).length}</p>
          </div>
        </div>
      </section>

      <section className='card'>
        <button type='button' onClick={onLogout} className='flex w-full items-center justify-center gap-2 rounded-3xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600'>
          <LogOut size={17} />
          Sair da sessão
        </button>
      </section>
    </div>
  );
}
