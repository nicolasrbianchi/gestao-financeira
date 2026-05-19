import React, { useState } from 'react';
import { api } from '../api/client';

export default function LoginScreen({ onOk }) {
  const [login, setL] = useState('');
  const [password, setP] = useState('');
  const [error, setError] = useState('');

  return (
    <div className='app-shell'>
      <form
        className='card'
        onSubmit={async (ev) => {
          ev.preventDefault();
          setError('');
          try {
            await api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
            onOk();
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <h2>Gestão Financeira</h2>
        <input placeholder='Login' value={login} onChange={(x) => setL(x.target.value)} />
        <input type='password' placeholder='Senha' value={password} onChange={(x) => setP(x.target.value)} />
        {error && <p>{error}</p>}
        <button>Entrar</button>
      </form>
    </div>
  );
}
