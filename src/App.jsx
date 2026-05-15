import React, { useEffect, useState } from 'react';
import { api } from './api/client';

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const initialFilters = {
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
};

export default function App() {
  const [auth, setAuth] = useState(null);
  const [tab, setTab] = useState('home');
  const [data, setData] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [filters] = useState(initialFilters);

  useEffect(() => {
    let active = true;
    api('/auth/status')
      .then((d) => {
        if (active) setAuth(d.authenticated);
      })
      .catch(() => {
        if (active) setAuth(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!auth) return;

    let active = true;
    setDashboardError('');

    api('/dashboard?' + new URLSearchParams(filters))
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (!active) return;
        setData(null);
        setDashboardError(error.message || 'Não foi possível carregar o dashboard.');
      });

    return () => {
      active = false;
    };
  }, [auth, filters]);

  if (auth === null) return <p>Carregando...</p>;
  if (!auth) return <Login onOk={() => setAuth(true)} />;

  return (
    <div className="app">
      <header>Gestão Financeira</header>
      <main>
        {tab === 'home' && <Home data={data} error={dashboardError} />}
        {tab === 'transactions' && <Transactions />}
        {tab === 'categories' && <Categories />}
        {tab === 'more' && <More />}
      </main>
      <nav>
        {['home', 'transactions', 'categories', 'more'].map((t) => (
          <button key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Login({ onOk }) {
  const [login, setL] = useState('');
  const [password, setP] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        setSending(true);
        try {
          await api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
          onOk();
        } catch (err) {
          setError(err.message || 'Falha ao autenticar.');
        } finally {
          setSending(false);
        }
      }}
    >
      <h2>Login</h2>
      <input placeholder="Usuário" value={login} onChange={(e) => setL(e.target.value)} />
      <input type="password" placeholder="Senha" value={password} onChange={(e) => setP(e.target.value)} />
      {error ? <p>{error}</p> : null}
      <button disabled={sending}>{sending ? 'Entrando...' : 'Entrar'}</button>
    </form>
  );
}

const Home = ({ data, error }) => {
  if (error) return <p>{error}</p>;
  if (!data) return <p>Carregando...</p>;

  return (
    <div>
      <div className="grid">
        <Card t="Receitas" v={fmt(data.summaryCards.receitas)} />
        <Card t="Despesas" v={fmt(data.summaryCards.despesas)} />
        <Card t="Reservas" v={fmt(data.summaryCards.reservas)} />
        <Card t="Saldo" v={fmt(data.summaryCards.saldo)} />
      </div>
    </div>
  );
};

const Card = ({ t, v }) => (
  <div className="card">
    <small>{t}</small>
    <strong>{v}</strong>
  </div>
);

function Transactions() {
  return <p>Use /api/transactions para listar transações filtradas.</p>;
}

function Categories() {
  return <p>Use /api/categories para ranking por categoria.</p>;
}

function More() {
  return <button onClick={() => api('/auth/logout', { method: 'POST' }).then(() => location.reload())}>Sair</button>;
}
