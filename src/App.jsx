import React, { useEffect, useState } from 'react';
import { api, flushOfflineQueue, withQuery } from './api/client';
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
  const [toastAction, setToastAction] = useState(null);
  const [pendingImportsCount, setPendingImportsCount] = useState(0);
  const [insightTick, setInsightTick] = useState(0);

  // Flush de ações offline (transações) quando a conexão voltar.
  useEffect(() => {
    let mounted = true;
    const flush = async () => {
      try {
        const r = await flushOfflineQueue();
        if (!mounted) return;
        if (r?.processed) {
          setToast(`Sincronizei ${r.processed} ação(ões) offline.`);
          setReloadKey((v) => v + 1);
        }
      } catch {
        // ignore
      }
    };

    void flush();
    window.addEventListener('online', flush);
    return () => {
      mounted = false;
      window.removeEventListener('online', flush);
    };
  }, []);

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

  const syncPendingImportsCount = (count, { notify = true } = {}) => {
    const nextCount = Math.max(0, Number(count) || 0);
    setPendingImportsCount(nextCount);

    try {
      const prev = Number(localStorage.getItem('gf_inbox_pending_count') || 0);
      if (notify && nextCount > prev) {
        setToast(`${nextCount} importação(ões) pendente(s) para aprovar.`);
        const now = Date.now();
        const n = {
          id: `inbox:${now}:${nextCount}`,
          kind: 'Inbox',
          title: 'Open Finance',
          body: `${nextCount} importação(ões) pendente(s) para aprovar.`,
          createdAt: new Date(now).toISOString(),
          readAt: null,
        };
        notificationsSave([n, ...notificationsLoad()]);
      }

      localStorage.setItem('gf_inbox_pending_count', String(nextCount));
      window.dispatchEvent(new CustomEvent('gf_imports_pending_count_changed', { detail: { count: nextCount } }));
    } catch {
      // ignore
    }
  };

  useEffect(() => { api('/auth/status').then((d) => setAuth(d.authenticated)).catch(() => setAuth(false)); }, []);

  // Deep links (PWA shortcuts): ?tab=transactions / ?action=add / ?action=inbox
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search || '');
      const nextTab = String(qs.get('tab') || '').trim();
      const action = String(qs.get('action') || '').trim();

      if (nextTab) setTab(nextTab);

      // ações: deixam o AppShell abrir sheets
      if (action) {
        window.__gf_intent = { action };
      }

      // Evita repetir intent ao navegar/recarregar.
      if (nextTab || action) {
        try { window.history.replaceState({}, '', '/'); } catch {}
      }
    } catch {
      // ignore
    }
  }, []);

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
        syncPendingImportsCount(count);
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

  useEffect(() => {
    const onPendingChanged = (event) => {
      const count = Number(event?.detail?.count);
      if (!Number.isFinite(count)) return;
      setPendingImportsCount(Math.max(0, count));
    };
    window.addEventListener('gf_imports_pending_count_changed', onPendingChanged);
    return () => window.removeEventListener('gf_imports_pending_count_changed', onPendingChanged);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event) => {
      if (event?.data?.type !== 'GF_PUSH_RECEIVED') return;
      const payload = event.data.payload || {};
      const now = Date.now();
      const n = {
        id: `push:${payload.tag || 'nicco'}:${now}`,
        kind: payload.tag === 'inbox' ? 'Inbox' : 'Push',
        title: payload.title || 'Nicco Finance',
        body: payload.body || '',
        createdAt: payload.sentAt || new Date(now).toISOString(),
        readAt: null,
      };
      notificationsSave([n, ...notificationsLoad()]);
      if (payload.tag === 'inbox') {
        try { window.dispatchEvent(new CustomEvent('gf_imports_pending_count_changed', { detail: { count: pendingImportsCount } })); } catch {}
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [pendingImportsCount]);

  useEffect(() => {
    if (!auth) return undefined;
    const refreshInboxBadge = async () => {
      try {
        const r = await api('/imports/pending');
        syncPendingImportsCount((r.items || []).length, { notify: false });
      } catch {
        // ignore
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshInboxBadge();
    };
    void refreshInboxBadge();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshInboxBadge);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshInboxBadge);
    };
  }, [auth]);

  useEffect(() => {
    if (!toast) return;
    // Quando o toast tem ação (ex: update do app), não auto-esconde.
    if (toastAction) return undefined;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast, toastAction]);

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
        const recentInsights = notificationsLoad()
          .filter((n) => n.kind === 'Insight' && n.body)
          .slice(0, 5)
          .map((n) => n.body)
          .join(' | ')
          .slice(0, 1600);
        const r = await api(`/ai/insight${recentInsights ? `?avoid=${encodeURIComponent(recentInsights)}` : ''}`);
        const text = String(r?.insight?.text || '').trim();
        if (!text) return;
        const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
        const alreadySeen = notificationsLoad()
          .filter((n) => n.kind === 'Insight')
          .some((n) => String(n.body || '').toLowerCase().replace(/\s+/g, ' ').trim() === normalizedText);
        if (alreadySeen) {
          setLastAt(now);
          return;
        }

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

  // Service Worker update UX (toast com ação)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let mounted = true;
    (async () => {
      try {
        const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js').catch(() => null));
        if (!reg) return;
        try { await reg.update(); } catch { /* ignore */ }

        const onUpdateFound = () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (!mounted) return;
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setToast('Nova versão disponível. Toque para atualizar.');
              setToastAction(() => () => window.location.reload());
            }
          });
        };

        reg.addEventListener('updatefound', onUpdateFound);
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (auth === null) return <div className='loading-state'>Carregando…</div>;
  if (!auth) return <LoginScreen onOk={() => setAuth(true)} />;

  return (
    <>
      <AppShell
        tab={tab}
        onTab={setTab}
        filters={filters}
        setFilters={setFilters}
        metadata={metadata || {}}
        initialDashboard={boot?.dashboard || null}
        onReload={() => setReloadKey((v) => v + 1)}
        api={api}
        withQuery={withQuery}
        onToast={(t) => {
          setToastAction(null);
          setToast(t);
        }}
        pendingImportsCount={pendingImportsCount}
        onPendingImportsCountChange={(count) => syncPendingImportsCount(count, { notify: false })}
        insightTick={insightTick}
        onLogout={async () => { await api('/auth/logout', { method: 'POST' }); location.reload(); }}
      />
      {toast && (
        <div
          className='toast'
          role='button'
          tabIndex={0}
          onClick={() => {
            if (typeof toastAction === 'function') return toastAction();
            return undefined;
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
