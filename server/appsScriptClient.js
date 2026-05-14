import { config } from './config.js';
async function call(action,params={}){if(!config.appsScriptUrl) throw new Error('APPS_SCRIPT_URL não configurada'); const url=new URL(config.appsScriptUrl);url.searchParams.set('action',action);url.searchParams.set('token',config.appsScriptToken);Object.entries(params).forEach(([k,v])=>v!==undefined&&v!==''&&url.searchParams.set(k,v)); const r=await fetch(url); if(!r.ok) throw new Error('Falha Apps Script'); const data=await r.json(); if(data.ok===false) throw new Error(data.error||'Erro Apps Script'); return data;}
export const getTransactions=()=>call('transactions');
export const getMetadata=()=>call('metadata');
export const addTransaction=(payload)=>call('add',payload);
export const health=()=>call('health');
