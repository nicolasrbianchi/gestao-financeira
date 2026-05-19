import React, { useEffect, useState } from 'react';
import BottomNav from './BottomNav';
import FilterSheet from './FilterSheet';
import TransactionSheet from './TransactionSheet';
import Home from '../pages/Home';
import Transactions from '../pages/Transactions';
import Categories from '../pages/Categories';
import More from '../pages/More';
import { filterChip } from '../utils/filters';

export default function AppShell(props){ const {tab,onTab,filters,setFilters,metadata,onReload,api,withQuery,onLogout}=props; const [showFilters,setShowFilters]=useState(false); const [showAdd,setShowAdd]=useState(false); const [data,setData]=useState(null); const [loading,setLoading]=useState(false);
useEffect(()=>{ let mounted=true; setLoading(true); const route=tab==='home'?'/dashboard':tab==='transactions'?'/transactions':'/categories'; api(withQuery(route,filters)).then((d)=>mounted&&setData(d)).finally(()=>mounted&&setLoading(false)); return ()=>mounted=false; },[tab,filters,onReload]);
return <div className='app-shell'><header className='top'><h1>Gestão Financeira</h1><button onClick={()=>setShowFilters(true)}>Filtros</button></header><p className='chip'>{filterChip(filters)}</p><main>{tab==='home'&&<Home data={data} loading={loading} />} {tab==='transactions'&&<Transactions data={data} loading={loading} filters={filters} setFilters={setFilters}/>} {tab==='categories'&&<Categories data={data} loading={loading}/>} {tab==='more'&&<More api={api} onLogout={onLogout}/>}</main><BottomNav tab={tab} onTab={onTab} onAdd={()=>setShowAdd(true)} /><FilterSheet open={showFilters} onClose={()=>setShowFilters(false)} filters={filters} setFilters={setFilters} metadata={metadata}/><TransactionSheet open={showAdd} onClose={()=>setShowAdd(false)} metadata={metadata} onSaved={onReload} api={api}/></div>}
