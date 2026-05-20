import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomNav from './BottomNav';
import FilterSheet from './FilterSheet';
import TransactionSheet from './TransactionSheet';
import Home from '../pages/Home';
import Transactions from '../pages/Transactions';
import Categories from '../pages/Categories';
import More from '../pages/More';
import Ai from '../pages/Ai';
import { Filter, Settings } from 'lucide-react';

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
  const { tab, onTab, filters, setFilters, metadata, initialDashboard, api, withQuery, onLogout, onToast, onReload } = props;
  const [showFilters, setShowFilters] = useState(false);
  const [showTransactionSheet, setShowTransactionSheet] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

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
    onToast?.('Transação salva com sucesso.');
    onReload?.();
    reload();
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
      return <Transactions data={data} loading={loading} filters={filters} setFilters={setFilters} onOpenFilters={() => setShowFilters(true)} />;
    }
    if (safeTab === 'categories') return <Categories data={data} loading={loading} filters={filters} setFilters={setFilters} onOpenFilters={() => setShowFilters(true)} />;
    if (safeTab === 'ai') return <Ai api={api} />;
    return <More api={api} metadata={metadata || {}} filters={filters} setFilters={setFilters} onOpenFilters={() => setShowFilters(true)} onReload={reloadAll} onLogout={onLogout} />;
  };

  return (
    <div className='app-frame'>
      <div className='top-actions'>
        <button
          type='button'
          onClick={() => setShowFilters(true)}
          className='icon-btn'
          aria-label='Abrir filtros'
        >
          <Filter size={18} />
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

      <BottomNav tab={safeTab} onTab={onTab} onAdd={() => setShowTransactionSheet(true)} />
      <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} filters={filters} setFilters={setFilters} metadata={metadata || {}} />
      <TransactionSheet
        open={showTransactionSheet}
        onClose={() => setShowTransactionSheet(false)}
        metadata={metadata || {}}
        api={api}
        onSaved={handleSaved}
        onToast={onToast}
      />
    </div>
  );
}
