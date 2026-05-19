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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { api('/auth/status').then((d) => setAuth(d.authenticated)).catch(() => setAuth(false)); }, []);
  useEffect(() => { if (auth) api('/metadata').then(setMetadata).catch(() => setMetadata({})); }, [auth, reloadKey]);

  if (auth === null) return <div className='p-4'>Carregando…</div>;
  if (!auth) return <LoginScreen onOk={() => setAuth(true)} />;

  return <AppShell tab={tab} onTab={setTab} filters={filters} setFilters={setFilters} metadata={metadata || {}} onReload={() => setReloadKey((v) => v + 1)} api={api} withQuery={withQuery} onLogout={async()=>{await api('/auth/logout',{method:'POST'});location.reload();}} />;
}
