import React, { useState } from 'react';
export default function More({api,onLogout}){const [h,setH]=useState(''); return <div><div className='card'><p>Sessão ativa</p><button onClick={onLogout}>Sair</button><button onClick={async()=>{const r=await api('/health');setH(r.ok?'Conectado':'Falha');}}>Testar conexão</button><p>{h}</p><p>Ambiente web v1.0</p></div></div>}
