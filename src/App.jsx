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
  const [pendingImportsCount, setPendingImportsCount] = useState(0);
  const [insightTick, setInsightTick] = useState(0);

  const notificationsLoad = () => {
    try {
      const raw = localStorage.getItem('gf_notifications_v1');
      const arr = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(arr) ? arr : [];
      // migração best-effort: garante shape
      return list.map((n) => ({
        id: String(n?.id || ''),
        kind: n?.kind || 'Notificação',
        title: n?.title || 'Atualização',
        body: n?.body || '',
        createdAt: n?.createdAt || null,
        readAt: n?.readAt || null,
      })).filter((n) => n.id);
    } catch {
      return [];
    }
  };

  const notificationsSave = (arr) => {
    try {
      localStorage.setItem('gf_notifications_v1', JSON.stringify(arr.slice(0, 50)));
    } catch {
      // ignore
    }
    try {
      window.dispatchEvent(new Event('gf_notifications_changed'));
    } catch {
      // ignore
    }
  };

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
  // Normal: 3min. Ao abrir o painel do MeuPluggy, fazemos um "boost" temporário para 30s por 5 min.
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

    const refreshPendingCount = async () => {
      try {
        const r = await api('/imports/pending');
        const count = (r.items || []).length;
        setPendingImportsCount(count);
        localStorage.setItem('gf_inbox_pending_count', String(count));
      } catch {
        // ignore
      }
    };

    const tick = async () => {
      try {
        const burst = isBoostActive();
        await api('/pluggy/fetch-transactions', { method: 'POST', body: JSON.stringify(burst ? { burst: true } : {}) });
      } catch {
        // ignore (sem db/pluggy config, rate limit, etc). Logs ficam no backend.
      } finally {
        // atualiza badge/contador (best-effort)
        await refreshPendingCount();
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
        setPendingImportsCount(count);
        const prev = Number(localStorage.getItem('gf_inbox_pending_count') || 0);

        if (count > prev) {
          setToast(`${count} importação(ões) pendente(s) para aprovar.`);

          // Também registra na Central de notificações (pra aparecer no sino)
          try {
            const now = Date.now();
            const n = {
              id: `inbox:${now}`,
              kind: 'Inbox',
              title: 'Open Finance',
              body: `${count} importação(ões) pendente(s) para aprovar.`,
              createdAt: new Date(now).toISOString(),
              readAt: null,
            };
            const arr = [n, ...notificationsLoad()];
            notificationsSave(arr);
          } catch {
            // ignore
          }
        }

        localStorage.setItem('gf_inbox_pending_count', String(count));
      })
      .catch(() => {
        // ignore (DATA_SOURCE!=db ou erro de rede)
      });
  }, [auth, reloadKey]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);

  // Insight periódico (Nicco IA): 2x por dia (quando app estiver aberto).
  useEffect(() => {
    if (!auth) return;

    const getLastAt = () => {
      try { return Number(localStorage.getItem('gf_last_ai_insight_at_ms') || 0) || 0; } catch { return 0; }
    };
    const setLastAt = (ms) => {
      try { localStorage.setItem('gf_last_ai_insight_at_ms', String(ms)); } catch {}
    };

    const maybeGenerate = async () => {
      const now = Date.now();
      const last = getLastAt();
      const periodMs = 12 * 60 * 60 * 1000;
      if (last && now - last < periodMs) return;

      try {
        const r = await api('/ai/insight');
        const text = String(r?.insight?.text || '').trim();
        if (!text) return;

        const n = {
          id: `insight:${now}`,
          kind: 'Insight',
          title: 'Insight do Nicco IA',
          body: text,
          createdAt: new Date(now).toISOString(),
          readAt: null,
        };
        const arr = [n, ...notificationsLoad()];
        notificationsSave(arr);
        setToast('Novo insight do Nicco IA');
        setLastAt(now);
        setInsightTick((v) => v + 1);
      } catch {
        // ignore
      }
    };

    // primeiro check + intervalo
    void maybeGenerate();
    const id = setInterval(() => { void maybeGenerate(); }, 60 * 60 * 1000); // checa de hora em hora
    return () => clearInterval(id);
  }, [auth]);

  if (auth === null) return <div className='loading-state'>Carregando…</div>;
  if (!auth) return <LoginScreen onOk={() => setAuth(true)} />;

  return <><AppShell tab={tab} onTab={setTab} filters={filters} setFilters={setFilters} metadata={metadata || {}} initialDashboard={boot?.dashboard || null} onReload={() => setReloadKey((v) => v + 1)} api={api} withQuery={withQuery} onToast={setToast} pendingImportsCount={pendingImportsCount} insightTick={insightTick} onLogout={async()=>{await api('/auth/logout',{method:'POST'});location.reload();}} />{toast&&<div className='toast'>{toast}</div>}</>;
}
