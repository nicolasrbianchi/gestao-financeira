import React, { useEffect, useState } from 'react';
import { api, withQuery } from './api/client';
import { defaultFilters } from './utils/filters';
import AppShell from './components/AppShell';
import LoginScreen from './components/LoginScreen';

export default function App() {
  const [auth, setAuth] = useState(null);
  const [tab, setTab] = useState('home');
  const [filters, setFilters] = useState(defaultFilters());
  const [metadata, setMetadata] = useState(null);
  const [boot, setBoot] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState('');

  useEffect(() => { api('/auth/status').then((d) => setAuth(d.authenticated)).catch(() => setAuth(false)); }, []);
  useEffect(() => {
    if (!auth) return;
    api('/bootstrap', { cache: 'no-store' })
      .then((d) => {
        setBoot(d || {});
        setMetadata(d?.metadata || {});
      })
      .catch(() => {
        setBoot(null);
        api('/metadata').then(setMetadata).catch(() => setMetadata({}));
      });
  }, [auth, reloadKey]);

  // Pluggy auto-fetch (MVP): roda periodicamente quando app estiver aberto.
  // O backend tem throttle (PLUGGY_FETCH_MIN_INTERVAL_MS) para evitar excesso.
  useEffect(() => {
    if (!auth) return;
    let stopped = false;

    const tick = async () => {
      try {
        await api('/pluggy/fetch-transactions', { method: 'POST', body: '{}' });
      } catch {
        // ignore (sem db/pluggy config, rate limit, etc). Logs ficam no backend.
      }
    };

    // primeiro tick (best-effort)
    void tick();
    const id = setInterval(() => {
      if (stopped) return;
      void tick();
    }, 3 * 60_000);

    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [auth]);

  // Notificação best-effort: importações pendentes
  useEffect(() => {
    if (!auth) return;
    api('/imports/pending')
      .then((r) => {
        const count = (r.items || []).length;
        const prev = Number(localStorage.getItem('gf_inbox_pending_count') || 0);
        if (count > prev) setToast(`${count} importação(ões) pendente(s) para aprovar.`);
        localStorage.setItem('gf_inbox_pending_count', String(count));
      })
      .catch(() => {
        // ignore (DATA_SOURCE!=db ou erro de rede)
      });
  }, [auth, reloadKey]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);

  if (auth === null) return <div className='loading-state'>Carregando…</div>;
  if (!auth) return <LoginScreen onOk={() => setAuth(true)} />;

  return <><AppShell tab={tab} onTab={setTab} filters={filters} setFilters={setFilters} metadata={metadata || {}} initialDashboard={boot?.dashboard || null} onReload={() => setReloadKey((v) => v + 1)} api={api} withQuery={withQuery} onToast={setToast} onLogout={async()=>{await api('/auth/logout',{method:'POST'});location.reload();}} />{toast&&<div className='toast'>{toast}</div>}</>;
}
