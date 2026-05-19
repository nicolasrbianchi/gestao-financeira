import React from 'react';
export default function BottomNav({tab,onTab,onAdd}){return <nav className='bottom'>{['home','transactions','categories','more'].map((t,i)=><button key={t} className={tab===t?'active':''} onClick={()=>onTab(t)}>{i===2?'Categorias':t==='transactions'?'Transações':t==='home'?'Home':'Mais'}</button>)}<button className='fab' onClick={onAdd}>+</button></nav>}
