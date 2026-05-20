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
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);

  if (auth === null) return <div className='loading-state'>Carregando…</div>;
  if (!auth) return <LoginScreen onOk={() => setAuth(true)} />;

  return <><AppShell tab={tab} onTab={setTab} filters={filters} setFilters={setFilters} metadata={metadata || {}} initialDashboard={boot?.dashboard || null} onReload={() => setReloadKey((v) => v + 1)} api={api} withQuery={withQuery} onToast={setToast} onLogout={async()=>{await api('/auth/logout',{method:'POST'});location.reload();}} />{toast&&<div className='toast'>{toast}</div>}</>;
}
