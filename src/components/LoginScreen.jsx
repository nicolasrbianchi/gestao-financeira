import React, { useState } from 'react';
import { api } from '../api/client';

export default function LoginScreen({ onOk }) {
  const [login, setL] = useState('');
  const [password, setP] = useState('');
  const [error, setError] = useState('');

  return (
    <div className='app-shell login-wrap'>
      <form
        className='card login-card'
        onSubmit={async (ev) => {
          ev.preventDefault();
          setError('');
          try {
            await api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
            onOk();
          } catch {
            setError('Não foi possível entrar. Verifique suas credenciais.');
          }
        }}
      >
        <div className='space-y-1'>
          <h2>Nicco Finance</h2>
          <p className='muted'>Precisão financeira</p>
        </div>

        <div className='space-y-3'>
          <input
            autoCapitalize='none'
            autoCorrect='off'
            inputMode='text'
            placeholder='Login'
            value={login}
            onChange={(x) => setL(x.target.value)}
          />
          <input
            type='password'
            placeholder='Senha'
            value={password}
            onChange={(x) => setP(x.target.value)}
          />
        </div>

        {error && <p className='error'>{error}</p>}
        <button>Entrar</button>

        <p className='login-hint'>Cockpit financeiro pessoal · Sofisticação silenciosa · Clareza analítica</p>
      </form>
    </div>
  );
}
