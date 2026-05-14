import React,{useEffect,useState} from 'react';import {api} from './api/client';
const fmt=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function App(){const [auth,setAuth]=useState(false);const [tab,setTab]=useState('home');const [data,setData]=useState(null);const [f,setF]=useState({startDate:new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10),endDate:new Date().toISOString().slice(0,10)});
useEffect(()=>{api('/auth/status').then(d=>setAuth(d.authenticated));},[]);
useEffect(()=>{if(auth) api('/dashboard?'+new URLSearchParams(f)).then(setData);},[auth,JSON.stringify(f)]);
if(!auth) return <Login onOk={()=>setAuth(true)}/>;
return <div className='app'><header>Gestão Financeira</header><main>{tab==='home'&&<Home data={data}/>} {tab==='transactions'&&<Transactions f={f}/>} {tab==='categories'&&<Categories f={f}/>} {tab==='more'&&<More/>}</main><nav>{['home','transactions','categories','more'].map(t=><button key={t} onClick={()=>setTab(t)}>{t}</button>)}</nav></div>}
function Login({onOk}){const [login,setL]=useState('');const [password,setP]=useState('');return <form className='card' onSubmit={async e=>{e.preventDefault();await api('/auth/login',{method:'POST',body:JSON.stringify({login,password})});onOk();}}><h2>Login</h2><input placeholder='Usuário' value={login} onChange={e=>setL(e.target.value)}/><input type='password' placeholder='Senha' value={password} onChange={e=>setP(e.target.value)}/><button>Entrar</button></form>}
const Home=({data})=>!data?<p>Carregando...</p>:<div><div className='grid'><Card t='Receitas' v={fmt(data.summaryCards.receitas)}/><Card t='Despesas' v={fmt(data.summaryCards.despesas)}/><Card t='Reservas' v={fmt(data.summaryCards.reservas)}/><Card t='Saldo' v={fmt(data.summaryCards.saldo)}/></div></div>;
const Card=({t,v})=><div className='card'><small>{t}</small><strong>{v}</strong></div>;
function Transactions(){return <p>Use /api/transactions para listar transações filtradas.</p>}
function Categories(){return <p>Use /api/categories para ranking por categoria.</p>}
function More(){return <button onClick={()=>api('/auth/logout',{method:'POST'}).then(()=>location.reload())}>Sair</button>}
