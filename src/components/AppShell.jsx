import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomNav from './BottomNav';
import FilterSheet from './FilterSheet';
import TransactionSheet from './TransactionSheet';
import TransactionDetailsSheet from './TransactionDetailsSheet';
import ImportInboxSheet from './ImportInboxSheet';
import AddTransactionMenuSheet from './AddTransactionMenuSheet';
import NotificationsSheet from './NotificationsSheet';
import Home from '../pages/Home';
import Transactions from '../pages/Transactions';
import Categories from '../pages/Categories';
import More from '../pages/More';
import Ai from '../pages/Ai';
import { Bell, Filter, Settings, SquarePen, Loader2, ArrowDown } from 'lucide-react';
import { haptic } from '../utils/haptics';

const ROUTES = {
  home: '/dashboard',
  transactions: '/transactions',
  categories: '/categories',
  ai: null,
  more: null
};

function getErrorDetails(error) {
  const message = error?.message || String(error || 'Erro desconhecido');
  const requestId = message.match(/Código:\s*([^\s]+)/)?.[1] || null;
  return { message, requestId };
}

function ErrorState({ error, onRetry }) {
  const details = getErrorDetails(error);
  return (
    <div className='error-state'>
      <p className='font-semibold'>Não consegui carregar esta tela.</p>
      <p className='mt-1 text-rose-500/90'>{details.message}</p>
      {details.requestId && <p className='mt-2 text-xs text-slate-500'>requestId: {details.requestId}</p>}
      {onRetry && (
        <button type='button' onClick={onRetry} className='mt-4 rounded-2xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600'>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export default function AppShell(props) {
  const { tab, onTab, filters, setFilters, metadata, initialDashboard, api, withQuery, onLogout, onToast, onReload, pendingImportsCount, insightTick } = props;
  const [showFilters, setShowFilters] = useState(false);
  const [showTransactionSheet, setShowTransactionSheet] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [detailsTx, setDetailsTx] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [transactionSheetMode, setTransactionSheetMode] = useState('add');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [aiResetKey, setAiResetKey] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [approveDraft, setApproveDraft] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const refreshTimerRef = useRef(null);
  const refreshingRef = useRef(false);
  const [pullProgress, setPullProgress] = useState(0);
  const pullRef = useRef({ started: false, startY: 0, pulling: false, max: 80 });
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const pullRefreshRef = useRef({ startedAt: 0, sawLoading: false });

  const safeTab = ROUTES[tab] === undefined ? 'home' : tab;
  const route = useMemo(() => ROUTES[safeTab], [safeTab]);

  const isStandalone = useMemo(() => {
    try {
      // iOS Safari: navigator.standalone
      if (window.navigator && window.navigator.standalone) return true;
      // Chrome/others
      return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (safeTab !== tab) onTab('home');
  }, [safeTab, tab, onTab]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  // Recarrega dados da aba atual + metadata (usado no "Mais")
  const reloadAll = useCallback(() => {
    onReload?.();
    reload();
  }, [onReload, reload]);

  // Pull-to-refresh (mobile/PWA)
  useEffect(() => {
    const isPaused = () => (
      document.visibilityState !== 'visible'
      || showTransactionSheet
      || showTransactionDetails
      || showInbox
      || showNotifications
      || showFilters
      || showAddMenu
    );

    const onTouchStart = (e) => {
      if (isPaused()) return;
      if (window.scrollY > 0) return;
      const t = e.touches?.[0];
      if (!t) return;
      pullRef.current = { started: true, startY: t.clientY, pulling: false, max: 80 };
    };

    const onTouchMove = (e) => {
      const st = pullRef.current;
      if (!st.started) return;
      if (window.scrollY > 0) return;
      const t = e.touches?.[0];
      if (!t) return;
      const dy = t.clientY - st.startY;
      if (dy <= 0) return;

      // Evita interferir com scroll quando não é claramente um pull
      if (dy < 8) return;
      st.pulling = true;
      const p = Math.max(0, Math.min(1, dy / st.max));
      setPullProgress(p);
    };

    const onTouchEnd = () => {
      const st = pullRef.current;
      if (!st.started) return;
      const shouldRefresh = st.pulling && pullProgress >= 1;
      pullRef.current = { started: false, startY: 0, pulling: false, max: 80 };
      setPullProgress(0);
      if (shouldRefresh) {
        haptic(10);
        pullRefreshRef.current = { startedAt: Date.now(), sawLoading: false };
        setPullRefreshing(true);
        reloadAll();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [reloadAll, showTransactionSheet, showTransactionDetails, showInbox, showNotifications, showFilters, showAddMenu, pullProgress]);

  // Fecha o loader do pull-to-refresh quando o reload terminar.
  useEffect(() => {
    if (!pullRefreshing) return;
    if (loading) {
      pullRefreshRef.current.sawLoading = true;
      return;
    }

    // Evita “piscar”: garante que pelo menos entrou em loading uma vez.
    if (!pullRefreshRef.current.sawLoading) return;

    // Deixa um mínimo de tempo visível pra passar sensação de refresh.
    const minMs = 450;
    const elapsed = Date.now() - (pullRefreshRef.current.startedAt || 0);
    const wait = Math.max(0, minMs - elapsed);
    const id = setTimeout(() => setPullRefreshing(false), wait);
    return () => clearTimeout(id);
  }, [pullRefreshing, loading]);

  // Auto-refresh: a barra enche por N ms; quando chega no fim, dispara reload.
  // (No iOS, timers podem pausar em background; quando voltar, o hook de focus/visibility já recarrega.)
  useEffect(() => {
    if (!route) return undefined;

    const getEveryMs = () => {
      try {
        const v = Number(localStorage.getItem('gf_auto_refresh_ms') || 0);
        if (Number.isFinite(v) && v >= 30_000) return v;
      } catch {
        // ignore
      }
      return 3 * 60_000; // default: 3min
    };

    const isPaused = () => (
      document.visibilityState !== 'visible'
      || showTransactionSheet
      || showTransactionDetails
      || showInbox
      || showNotifications
      || showFilters
      || showAddMenu
    );

    const schedule = () => {
      const everyMs = getEveryMs();
      const paused = isPaused();
      if (paused) return;

      try { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); } catch {}
      refreshTimerRef.current = setTimeout(() => {
        if (isPaused()) return schedule();
        if (refreshingRef.current) return schedule();
        refreshingRef.current = true;
        reload();
      }, everyMs);
    };

    schedule();
    return () => {
      try { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); } catch {}
    };
  }, [route, reload, showTransactionSheet, showTransactionDetails, showInbox, showNotifications, showFilters, showAddMenu]);

  // Quando volta pro app (PWA), atualiza automaticamente.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') reloadAll();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [reloadAll]);

  useEffect(() => {
    if (!route) {
      setLoading(false);
      setError(null);
      setData(null);
      return undefined;
    }

    // Bootstrap: evita 1 roundtrip no primeiro render da Home.
    if (safeTab === 'home' && initialDashboard && !data && reloadKey === 0) {
      setData(initialDashboard);
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    const cacheKey = `gf_cache:v1:${route}:${JSON.stringify(filters || {})}`;
    const ttlMs = isStandalone ? 24 * 60 * 60 * 1000 : 2 * 60 * 1000;
    let hadCache = false;
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.data && cached?.at && Date.now() - cached.at < ttlMs) {
          hadCache = true;
          setData(cached.data);
        }
      }
    } catch {
      // ignore cache issues
    }

    api(withQuery(route, filters))
      .then((response) => {
        if (!mounted) return;
        const nextData = response || {};
        setData(nextData);

        // terminou o refresh → libera próximo ciclo
        refreshingRef.current = false;

        try {
          localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: nextData }));
        } catch {
          // ignore storage quota
        }
      })
      .catch((err) => {
        if (!mounted) return;
        // Offline-friendly: se já temos cache, mantém a tela funcionando.
        if (hadCache) {
          setError(null);
          onToast?.('Sem conexão. Mostrando dados salvos.');
        } else {
          setError(err);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [api, withQuery, route, filters, reloadKey]);

  // cleanup timers
  useEffect(() => () => {
    try { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); } catch {}
  }, []);

  // PWA shortcuts intents
  useEffect(() => {
    try {
      const intent = window.__gf_intent;
      if (!intent?.action) return;
      window.__gf_intent = null;

      if (intent.action === 'add') {
        setEditingTx(null);
        setApproveDraft(null);
        setTransactionSheetMode('add');
        setShowTransactionSheet(true);
      }

      if (intent.action === 'inbox') {
        setShowInbox(true);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaved = () => {
    setShowTransactionSheet(false);
    setEditingTx(null);
    setApproveDraft(null);
    setTransactionSheetMode('add');
    onToast?.('Transação salva com sucesso.');
    onReload?.();
    reload();
  };

  const openDetails = (tx) => {
    setDetailsTx(tx || null);
    setShowTransactionDetails(true);
  };

  const closeTransactionSheet = () => {
    setShowTransactionSheet(false);
    setEditingTx(null);
    setTransactionSheetMode('add');
  };

  const renderPage = () => {
    if (error) return <ErrorState error={error} onRetry={reload} />;

    if (safeTab === 'home') {
      return (
        <Home
          data={data}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          onGoTransactions={() => onTab('transactions')}
        />
      );
    }
    if (safeTab === 'transactions') {
      return (
        <Transactions
          data={data}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          onView={(tx) => openDetails(tx)}
          onEdit={(tx) => {
            setEditingTx(tx);
            setTransactionSheetMode('edit');
            setShowTransactionSheet(true);
          }}
          onDelete={async (tx) => {
            try {
              const id = tx?.id ?? tx?.sheetRowNumber ?? tx?.row;
              if (!id) throw new Error('id inválido');
              await api(`/transactions/${id}`, { method: 'DELETE' });
              onToast?.('Transação excluída.');
              onReload?.();
              reload();
            } catch (e) {
              onToast?.(e?.message || 'Erro ao excluir transação.');
            }
          }}
        />
      );
    }
    if (safeTab === 'categories') return <Categories data={data} loading={loading} filters={filters} setFilters={setFilters} onGoTransactions={() => onTab('transactions')} />;
    if (safeTab === 'ai') return <Ai api={api} resetKey={aiResetKey} />;
    return <More api={api} metadata={metadata || {}} onLogout={onLogout} onToast={onToast} onReload={onReload} />;
  };

  const pendingCount = Number.isFinite(Number(pendingImportsCount)) ? Number(pendingImportsCount) : 0;

  const computeUnreadNotifications = useCallback(() => {
    try {
      const raw = localStorage.getItem('gf_notifications_v1');
      const arr = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(arr) ? arr : [];
      const lastSeen = Number(localStorage.getItem('gf_notifications_last_seen_at_ms') || 0) || 0;

      const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

      const unread = list.filter((n) => {
        // Esquema novo: se o objeto TEM a chave readAt, seguimos estritamente:
        // - string => lida
        // - null/undefined => não lida
        if (hasOwn(n, 'readAt')) return !n?.readAt;

        // Compat legado (sem readAt): usa lastSeen
        const t = n?.createdAt ? new Date(n.createdAt).getTime() : 0;
        return t ? t > lastSeen : true;
      }).length;

      setUnreadNotifications(unread);
    } catch {
      setUnreadNotifications(0);
    }
  }, []);

  useEffect(() => {
    computeUnreadNotifications();
  }, [computeUnreadNotifications, insightTick]);

  useEffect(() => {
    const onChanged = () => computeUnreadNotifications();
    window.addEventListener('gf_notifications_changed', onChanged);
    return () => window.removeEventListener('gf_notifications_changed', onChanged);
  }, [computeUnreadNotifications]);

  useEffect(() => {
    if (!showNotifications) return;
    computeUnreadNotifications();
  }, [showNotifications, computeUnreadNotifications]);

  // Badge no ícone (best-effort)
  useEffect(() => {
    const badge = Math.max(0, Number(unreadNotifications) || 0) + Math.max(0, Number(pendingCount) || 0);
    try {
      if ('setAppBadge' in navigator) {
        if (badge > 0) navigator.setAppBadge(badge);
        else navigator.clearAppBadge?.();
      }
    } catch {
      // ignore
    }
  }, [unreadNotifications, pendingCount]);

  return (
    <div className={`app-frame ${safeTab === 'ai' ? 'app-frame-chat' : ''}`}>
      {/* Pull-to-refresh loader (visível em qualquer tela) */}
      {(pullProgress > 0 || pullRefreshing) && (
        <div
          className='ptr-indicator'
          aria-hidden='true'
          style={{
            opacity: pullRefreshing ? 1 : Math.min(1, 0.35 + pullProgress),
            transform: pullRefreshing ? 'translateX(-50%) translateY(0px)' : `translateX(-50%) translateY(${Math.min(26, pullProgress * 26)}px)`,
          }}
        >
          {pullRefreshing ? (
            <div className='ptr-inner'>
              <Loader2 size={18} className='ptr-spin' />
              <span className='ptr-label'>Atualizando…</span>
            </div>
          ) : (
            <div className='ptr-inner'>
              <ArrowDown size={18} style={{ transform: `rotate(${Math.min(180, pullProgress * 180)}deg)` }} />
              <span className='ptr-label'>{pullProgress >= 1 ? 'Solte para atualizar' : 'Puxe para atualizar'}</span>
            </div>
          )}
        </div>
      )}
      <div className='top-actions'>
        {safeTab === 'ai' ? (
          <button
            type='button'
            onClick={() => setAiResetKey((v) => v + 1)}
            className='icon-btn'
            aria-label='Nova conversa'
          >
            <SquarePen size={18} />
          </button>
        ) : (
          <button
            type='button'
            onClick={() => setShowFilters(true)}
            className='icon-btn'
            aria-label='Abrir filtros'
          >
            <Filter size={18} />
          </button>
        )}

        <button
          type='button'
          onClick={() => setShowNotifications(true)}
          className='icon-btn'
          aria-label='Notificações'
        >
          <span className='relative inline-grid place-items-center'>
            <Bell size={18} />
            {unreadNotifications > 0 && (
              <span
                className='absolute -right-1 -top-1 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-[rgba(0,0,0,0.72)]'
                aria-label={`${unreadNotifications} notificação(ões) não lida(s)`}
              />
            )}
          </span>
        </button>
        <button
          type='button'
          onClick={() => onTab('more')}
          className='icon-btn'
          aria-label='Configurações'
        >
          <Settings size={18} />
        </button>
      </div>
      <main
        className={`min-w-0 ptr-content ${safeTab === 'ai' ? 'app-main-chat' : ''}`}
        style={{
          transform: (pullProgress > 0 || pullRefreshing)
            ? `translateY(${Math.round((pullRefreshing ? 56 : pullProgress * 56))}px)`
            : 'translateY(0px)',
        }}
      >
        {renderPage()}
      </main>

      <BottomNav
        tab={safeTab}
        onTab={onTab}
        pendingCount={pendingCount}
        onAdd={() => {
          setShowAddMenu(true);
        }}
      />

      <NotificationsSheet key={String(insightTick || 0)} open={showNotifications} onClose={() => setShowNotifications(false)} />
      <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} filters={filters} setFilters={setFilters} metadata={metadata || {}} />
      <TransactionSheet
        open={showTransactionSheet}
        onClose={closeTransactionSheet}
        metadata={metadata || {}}
        api={api}
        onSaved={handleSaved}
        onToast={onToast}
        initialTransaction={editingTx}
        mode={transactionSheetMode}
        submitPath={approveDraft?.importId ? `/imports/${approveDraft.importId}/approve` : null}
      />

      <TransactionDetailsSheet
        open={showTransactionDetails}
        onClose={() => setShowTransactionDetails(false)}
        api={api}
        transaction={detailsTx}
        onToast={onToast}
        onEdit={(tx) => {
          setShowTransactionDetails(false);
          setEditingTx(tx);
          setTransactionSheetMode('edit');
          setShowTransactionSheet(true);
        }}
        onDelete={async (tx) => {
          // reaproveita o mesmo fluxo da lista
          const id = tx?.id ?? tx?.sheetRowNumber ?? tx?.row;
          if (!id) throw new Error('id inválido');
          await api(`/transactions/${id}`, { method: 'DELETE' });
          onToast?.('Transação excluída.');
          onReload?.();
          reload();
        }}
      />

      <AddTransactionMenuSheet
        open={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        pendingCount={pendingCount}
        onOpenFinance={() => {
          setShowAddMenu(false);
          setShowInbox(true);
        }}
        onManual={() => {
          setShowAddMenu(false);
          setEditingTx(null);
          setApproveDraft(null);
          setTransactionSheetMode('add');
          setShowTransactionSheet(true);
        }}
      />

      <ImportInboxSheet
        open={showInbox}
        onClose={() => setShowInbox(false)}
        api={api}
        metadata={metadata || {}}
        onToast={onToast}
        onApprove={({ importId, initialForm }) => {
          setApproveDraft({ importId });
          setEditingTx({ ...initialForm });
          setTransactionSheetMode('add');
          setShowInbox(false);
          setShowTransactionSheet(true);
        }}
      />
    </div>
  );
}
