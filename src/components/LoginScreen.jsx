import React, { useState } from 'react';
import { api } from '../api/client';

export default function LoginScreen({ onOk }) {
  const [login, setL] = useState('');
  const [password, setP] = useState('');
  const [error, setError] = useState('');
  return <div className='app-shell login-wrap'><form className='card login-card' onSubmit={async (ev) => { ev.preventDefault(); setError(''); try { await api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }); onOk(); } catch (err) { setError('Não foi possível entrar. Verifique suas credenciais.'); } }}><h2>Gestão Financeira</h2><p className='muted'>Controle premium das suas finanças.</p><input placeholder='Login' value={login} onChange={(x) => setL(x.target.value)} /><input type='password' placeholder='Senha' value={password} onChange={(x) => setP(x.target.value)} />{error && <p className='error'>{error}</p>}<button>Entrar</button></form></div>;
}
