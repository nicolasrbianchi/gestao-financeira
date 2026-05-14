const SPREADSHEET_ID = 'COLE_AQUI_O_ID_DA_SUA_PLANILHA';
const SECRET_TOKEN = 'troque-essa-chave-secreta';
const TRANSACTIONS_SHEET = 'Transações';
const SOURCES_SHEET = 'Fontes';

function doGet(e){const p=e.parameter||{};const action=p.action||'summary';try{if(action==='config') return respond_(getMetadata_(),p.callback);if(action==='metadata') return respond_(getMetadata_(),p.callback);if(action==='summary') return respond_(getSummary_(p.month),p.callback);if(action==='transactions'){validateToken_(p.token);return respond_(getTransactions_(),p.callback);}if(action==='add'){validateToken_(p.token);return respond_(addTransaction_(p),p.callback);}if(action==='health'){validateToken_(p.token);return respond_({ok:true,timestamp:new Date().toISOString()},p.callback);}return respond_({ok:false,error:'Ação inválida.'},p.callback);}catch(err){return respond_({ok:false,error:err.message||String(err)},p.callback);}}
function doPost(e){const b=JSON.parse(e.postData.contents||'{}'); validateToken_(b.token); return respond_(addTransaction_(b),b.callback);}
function ss_(){return SpreadsheetApp.openById(SPREADSHEET_ID)}
function sheet_(n){const sh=ss_().getSheetByName(n);if(!sh) throw new Error('Aba não encontrada: '+n); return sh}
function validateToken_(t){if(!t||t!==SECRET_TOKEN) throw new Error('Token inválido.')}
function respond_(d,cb){const payload=JSON.stringify(d); return ContentService.createTextOutput(cb?`${cb}(${payload});`:payload).setMimeType(cb?ContentService.MimeType.JAVASCRIPT:ContentService.MimeType.JSON)}
function getTransactions_(){const sh=sheet_(TRANSACTIONS_SHEET);const last=sh.getLastRow(); if(last<2) return {ok:true,transactions:[]};const head=sh.getRange(1,1,1,12).getValues()[0]; const vals=sh.getRange(2,1,last-1,12).getValues(); return {ok:true,transactions:vals.map((r,i)=>Object.fromEntries(head.map((h,idx)=>[h,r[idx]])).sheetRowNumber=i+2&&Object.fromEntries([...head.map((h,idx)=>[h,r[idx]]),['sheetRowNumber',i+2]]))};}
function getMetadata_(){const tx=getTransactions_().transactions;const unique=(k)=>[...new Set(tx.map(t=>String(t[k]||'').trim()).filter(Boolean))]; return {ok:true,types:unique('Tipo'),categories:unique('Categoria'),subcategories:unique('Subcategoria'),accounts:unique('Conta/Canal'),paymentMethods:unique('Forma'),statuses:unique('Status'),reserves:unique('Reserva')};}
function addTransaction_(p){const sh=sheet_(TRANSACTIONS_SHEET); const date=p.data?new Date(`${p.data}T12:00:00`):new Date(); const value=parseMoney_(p.valor||p.amount); if(!p.nome&&!p.name) throw new Error('Nome obrigatório.'); sh.appendRow([date,p.nome||p.name,p.tipo||p.type,p.reserva||p.reserve,p.conta||p.account,p.categoria||p.category,p.subcategoria||p.subcategory,p.forma||p.paymentMethod,value,p.status||'',p.parcela||p.installment||'',p.obs||p.notes||'']); return {ok:true,row:sh.getLastRow()};}
function getSummary_(month){return {ok:true,month:month||Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM')}}
function parseMoney_(v){if(typeof v==='number') return v; return Number(String(v||'').replace(/\s/g,'').replace('R$','').replace(/\./g,'').replace(',','.'))}
