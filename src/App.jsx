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

  const getPluggyBoostUntilMs = () => {
    try {
      const v = Number(localStorage.getItem('gf_pluggy_fetch_boost_until_ms') || 0);
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  };

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
  // Normal: 3min. Ao abrir o painel do MeuPluggy, fazemos um "boost" temporário para 30s por alguns minutos.
  useEffect(() => {
    if (!auth) return;
    let stopped = false;
    let timeoutId = null;

    const isBoostActive = () => Date.now() < getPluggyBoostUntilMs();

    const scheduleNext = () => {
      if (stopped) return;
      const everyMs = isBoostActive() ? 30_000 : 3 * 60_000;
      timeoutId = setTimeout(() => {
        void tick();
      }, everyMs);
    };

    const tick = async () => {
      try {
        const burst = isBoostActive();
        await api('/pluggy/fetch-transactions', { method: 'POST', body: JSON.stringify(burst ? { burst: true } : {}) });
      } catch {
        // ignore (sem db/pluggy config, rate limit, etc). Logs ficam no backend.
      } finally {
        scheduleNext();
      }
    };

    const onBoost = () => {
      if (stopped) return;
      try { if (timeoutId) clearTimeout(timeoutId); } catch {}
      // dispara já e reprograma com o intervalo novo
      void tick();
    };

    window.addEventListener('gf_pluggy_boost', onBoost);

    // primeiro tick (best-effort)
    void tick();

    return () => {
      stopped = true;
      window.removeEventListener('gf_pluggy_boost', onBoost);
      try { if (timeoutId) clearTimeout(timeoutId); } catch {}
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
