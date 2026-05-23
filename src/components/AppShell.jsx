import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomNav from './BottomNav';
import FilterSheet from './FilterSheet';
import TransactionSheet from './TransactionSheet';
import ImportInboxSheet from './ImportInboxSheet';
import AddTransactionMenuSheet from './AddTransactionMenuSheet';
import NotificationsSheet from './NotificationsSheet';
import Home from '../pages/Home';
import Transactions from '../pages/Transactions';
import Categories from '../pages/Categories';
import More from '../pages/More';
import Ai from '../pages/Ai';
import { Bell, Filter, Settings, SquarePen } from 'lucide-react';

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

  const safeTab = ROUTES[tab] === undefined ? 'home' : tab;
  const route = useMemo(() => ROUTES[safeTab], [safeTab]);

  useEffect(() => {
    if (safeTab !== tab) onTab('home');
  }, [safeTab, tab, onTab]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  // Recarrega dados da aba atual + metadata (usado no "Mais")
  const reloadAll = useCallback(() => {
    onReload?.();
    reload();
  }, [onReload, reload]);

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
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.data && cached?.at && Date.now() - cached.at < 2 * 60 * 1000) {
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
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: nextData }));
        } catch {
          // ignore storage quota
        }
      })
      .catch((err) => {
        if (mounted) setError(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [api, withQuery, route, filters, reloadKey]);

  const handleSaved = () => {
    setShowTransactionSheet(false);
    setEditingTx(null);
    setApproveDraft(null);
    setTransactionSheetMode('add');
    onToast?.('Transação salva com sucesso.');
    onReload?.();
    reload();
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
      const unread = list.filter((n) => {
        const t = n?.createdAt ? new Date(n.createdAt).getTime() : 0;
        return t && t > lastSeen;
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
    if (!showNotifications) return;
    try {
      localStorage.setItem('gf_notifications_last_seen_at_ms', String(Date.now()));
    } catch {
      // ignore
    }
    computeUnreadNotifications();
  }, [showNotifications, computeUnreadNotifications]);

  return (
    <div className={`app-frame ${safeTab === 'ai' ? 'app-frame-chat' : ''}`}>
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
      <main className='min-w-0'>{renderPage()}</main>

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
