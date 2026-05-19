import React, { useEffect, useMemo, useState } from 'react';
import BottomNav from './BottomNav';
import FilterSheet from './FilterSheet';
import Home from '../pages/Home';
import Transactions from '../pages/Transactions';
import Categories from '../pages/Categories';
import More from '../pages/More';

export default function AppShell(props) {
  const { tab, onTab, filters, setFilters, metadata, onReload, api, withQuery, onLogout } = props;
  const [showFilters, setShowFilters] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const route = useMemo(() => (tab === 'home' ? '/dashboard' : tab === 'transactions' ? '/transactions' : '/categories'), [tab]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    api(withQuery(route, filters))
      .then((d) => mounted && setData(d))
      .catch((e) => mounted && setError(e.message))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [route, filters, onReload]);

  return (
    <div className='mx-auto min-h-screen w-full max-w-[430px] bg-surface px-4 pb-28 pt-4'>
      <main>
        {error ? (
          <div className='rounded-4xl bg-white p-5 text-sm text-rose-500 shadow-soft'>Erro ao carregar dados: {error}</div>
        ) : tab === 'home' ? (
          <Home data={data} loading={loading} />
        ) : tab === 'transactions' ? (
          <Transactions data={data} loading={loading} filters={filters} setFilters={setFilters} />
        ) : tab === 'categories' ? (
          <Categories data={data} loading={loading} />
        ) : (
          <More api={api} onLogout={onLogout} />
        )}
      </main>

      <BottomNav tab={tab} onTab={onTab} />
      <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} filters={filters} setFilters={setFilters} metadata={metadata} />
    </div>
  );
}
