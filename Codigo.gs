/**
 * Apps Script backend da planilha de gestão financeira.
 *
 * Ações suportadas (via querystring):
 * - action=health
 * - action=metadata (ou action=config)
 * - action=transactions
 * - action=add
 * - action=summary
 */

const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || 'COLE_AQUI_O_ID_DA_SUA_PLANILHA';
const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN') || 'TROQUE_POR_UM_TOKEN_SECRETO';

const TRANSACTIONS_SHEET = 'Transações';
const SOURCES_SHEET = 'Fontes';
const CATEGORIES_SHEET = 'Categorias';

const TRANSACTION_HEADERS = [
  'Data',
  'Nome',
  'Tipo',
  'Reserva',
  'Conta/Canal',
  'Categoria',
  'Subcategoria',
  'Forma',
  'Valor',
  'Status',
  'Parcela',
  'Obs',
];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || 'health';

  try {
    if (action === 'health') {
      validateToken_(p.token);
      return respond_({ ok: true, timestamp: new Date().toISOString() }, p.callback);
    }

    if (action === 'metadata' || action === 'config') {
      validateToken_(p.token);
      return respond_(getMetadata_(), p.callback);
    }

    if (action === 'transactions') {
      validateToken_(p.token);
      return respond_(getTransactions_(), p.callback);
    }

    if (action === 'add') {
      validateToken_(p.token);
      return respond_(addTransaction_(p), p.callback);
    }

    if (action === 'summary') {
      validateToken_(p.token);
      return respond_(getSummary_(p.month), p.callback);
    }

    return respond_({ ok: false, error: 'Ação inválida.' }, p.callback);
  } catch (err) {
    return respond_({ ok: false, error: err && err.message ? err.message : String(err) }, p.callback);
  }
}

function doPost(e) {
  const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  const action = body.action || 'add';

  try {
    validateToken_(body.token);

    if (action === 'add') return respond_(addTransaction_(body), body.callback);
    if (action === 'summary') return respond_(getSummary_(body.month), body.callback);
    if (action === 'transactions') return respond_(getTransactions_(), body.callback);
    if (action === 'metadata' || action === 'config') return respond_(getMetadata_(), body.callback);

    return respond_({ ok: false, error: 'Ação inválida.' }, body.callback);
  } catch (err) {
    return respond_({ ok: false, error: err && err.message ? err.message : String(err) }, body.callback);
  }
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Aba não encontrada: ' + name);
  return sh;
}

function validateToken_(token) {
  if (!token || token !== SECRET_TOKEN) throw new Error('Token inválido.');
}

function respond_(data, callback) {
  const payload = JSON.stringify(data);
  return ContentService.createTextOutput(callback ? `${callback}(${payload});` : payload).setMimeType(
    callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON
  );
}

function normalizeList_(arr) {
  return (arr || [])
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
}

function readColumn_(sheetName, headerName) {
  const sh = sheet_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const idx = headerRow.indexOf(headerName);
  if (idx === -1) return [];

  const col = idx + 1;
  const values = sh.getRange(2, col, lastRow - 1, 1).getDisplayValues().flat();
  return normalizeList_(values);
}

function getTransactions_() {
  const sh = sheet_(TRANSACTIONS_SHEET);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2) return { ok: true, transactions: [] };

  const header = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

  const transactions = rows
    .map((row, i) => {
      const obj = {};
      for (let c = 0; c < header.length; c++) {
        const key = header[c];
        if (!key) continue;
        obj[key] = row[c];
      }
      obj.sheetRowNumber = i + 2;
      return obj;
    })
    .filter((t) => Object.keys(t).length > 1);

  return { ok: true, transactions };
}

function mergeLists_() {
  return normalizeList_(Array.prototype.concat.apply([], arguments));
}

function monthKey_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : normalizeDate_(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM');
}

function getMonthlyGoals_() {
  const sh = ss_().getSheetByName(CATEGORIES_SHEET);
  if (!sh) return {};

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 2) return {};

  const labels = sh.getRange(1, 1, lastRow, 1).getDisplayValues().flat();
  const goalRowIndex = labels.findIndex((value) => String(value || '').trim() === '.') + 1;
  if (!goalRowIndex) return {};

  const monthValues = sh.getRange(1, 2, 1, lastCol - 1).getValues()[0];
  const goalValues = sh.getRange(goalRowIndex, 2, 1, lastCol - 1).getValues()[0];
  const goals = {};

  for (let i = 0; i < monthValues.length; i++) {
    const key = monthKey_(monthValues[i]);
    const value = parseMoney_(goalValues[i]);
    if (key && value) goals[key] = value;
  }

  return goals;
}

function getMetadata_() {
  const tx = getTransactions_().transactions || [];

  const uniqueFromTx = (key) =>
    normalizeList_(tx.map((t) => String((t && t[key]) || '').trim()).filter(Boolean));

  // Pela cópia da planilha no repo: "Fontes" tem as colunas "Categorias" e "Contas".
  const categories = readColumn_(SOURCES_SHEET, 'Categorias');
  const accounts = readColumn_(SOURCES_SHEET, 'Contas');

  return {
    ok: true,
    types: mergeLists_(uniqueFromTx('Tipo'), ['Receita', 'Despesa', 'Reserva', 'Saldo']),
    categories: mergeLists_(categories, uniqueFromTx('Categoria'), ['Transferencia entre contas']),
    subcategories: mergeLists_(uniqueFromTx('Subcategoria'), ['Essencial', 'Extra']),
    accounts: mergeLists_(accounts, uniqueFromTx('Conta/Canal')),
    paymentMethods: mergeLists_(uniqueFromTx('Forma'), ['Débito', 'Crédito', 'Pix', 'Boleto', 'Depósito']),
    statuses: uniqueFromTx('Status'),
    reserves: mergeLists_(uniqueFromTx('Reserva'), ['Entrada', 'Saida']),
    monthlyGoals: getMonthlyGoals_(),
  };
}

function parseMoney_(v) {
  if (typeof v === 'number') return v;

  const n = Number(
    String(v || '')
      .replace(/\s/g, '')
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
  );

  return Number.isNaN(n) ? 0 : n;
}

function normalizeDate_(value) {
  if (!value) return new Date();

  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00');

  // Fallback: tenta parsear qualquer string (ex: 15/05/2026)
  return new Date(s);
}

function ensureTransactionHeader_() {
  const sh = sheet_(TRANSACTIONS_SHEET);
  const lastCol = Math.max(sh.getLastColumn(), TRANSACTION_HEADERS.length);
  const header = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

  const missing = TRANSACTION_HEADERS.filter((h) => header.indexOf(h) === -1);
  if (missing.length) {
    const isEmpty = header.every((v) => !String(v || '').trim());

    // Se estiver vazia, escreve o header padrão.
    if (isEmpty) {
      sh.getRange(1, 1, 1, TRANSACTION_HEADERS.length).setValues([TRANSACTION_HEADERS]);
      return TRANSACTION_HEADERS;
    }

    throw new Error('Header da aba Transações não tem as colunas esperadas: ' + missing.join(', '));
  }

  return header;
}

function addTransaction_(p) {
  const sh = sheet_(TRANSACTIONS_SHEET);
  const header = ensureTransactionHeader_();

  const data = p.data || p.date;
  const tipo = p.tipo || p.type;
  const reserva = p.reserva || p.reserve || '';
  const conta = p.conta || p.account || '';
  const categoria = p.categoria || p.category || '';
  const subcategoria = p.subcategoria || p.subcategory || '';
  const forma = p.forma || p.paymentMethod || '';
  const status = p.status || '';
  const parcela = p.parcela || p.installment || '';
  const obs = p.obs || p.notes || '';
  const valor = parseMoney_(p.valor !== undefined ? p.valor : p.amount);
  const nome = String(p.nome || p.name || (tipo === 'Saldo' && conta ? 'Saldo ' + conta : '')).trim();

  if (!tipo) throw new Error('Tipo obrigatório.');
  if (!conta) throw new Error('Conta/Canal obrigatório.');
  if (tipo !== 'Saldo' && !nome) throw new Error('Nome obrigatório.');
  if (tipo === 'Reserva' && !reserva) throw new Error('Reserva obrigatória para tipo Reserva.');
  if ((tipo === 'Receita' || tipo === 'Despesa') && (!categoria || !subcategoria || !forma)) throw new Error('Receita e Despesa exigem categoria, subcategoria e forma.');
  if (tipo === 'Saldo' && !categoria) throw new Error('Saldo exige categoria.');
  if (!valor || valor <= 0) throw new Error('Valor obrigatório.');

  const rowObj = {
    Data: normalizeDate_(data),
    Nome: nome,
    Tipo: tipo,
    Reserva: reserva,
    'Conta/Canal': conta,
    Categoria: categoria,
    Subcategoria: subcategoria,
    Forma: forma,
    Valor: valor,
    Status: status,
    Parcela: parcela,
    Obs: obs,
  };

  const row = header.map((h) => (h in rowObj ? rowObj[h] : ''));
  sh.appendRow(row);

  return { ok: true, row: sh.getLastRow() };
}

function getSummary_(month) {
  const tx = (getTransactions_().transactions || []).map((t) => ({
    date: String(t.Data || '').slice(0, 10),
    name: t.Nome,
    type: t.Tipo,
    reserve: t.Reserva,
    category: t.Categoria,
    amount: parseMoney_(t.Valor),
  }));

  const targetMonth = month || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  const filtered = tx.filter((t) => t.date && t.date.slice(0, 7) === targetMonth);

  const receitas = filtered.filter((t) => t.type === 'Receita').reduce((a, b) => a + b.amount, 0);
  const despesas = filtered.filter((t) => t.type === 'Despesa').reduce((a, b) => a + b.amount, 0);

  const reservasIn = filtered
    .filter((t) => t.type === 'Reserva' && t.reserve === 'Entrada')
    .reduce((a, b) => a + b.amount, 0);

  const reservasOut = filtered
    .filter((t) => t.type === 'Reserva' && t.reserve === 'Saida')
    .reduce((a, b) => a + b.amount, 0);

  const reservas = reservasIn - reservasOut;
  const saldo = receitas - (despesas + Math.max(reservas, 0));

  const byCategoryMap = {};
  filtered
    .filter((t) => t.type === 'Despesa')
    .forEach((t) => {
      const key = t.category || 'Sem categoria';
      byCategoryMap[key] = (byCategoryMap[key] || 0) + t.amount;
    });

  const byCategory = Object.keys(byCategoryMap)
    .map((categoria) => ({ categoria, valor: byCategoryMap[categoria] }))
    .sort((a, b) => b.valor - a.valor);

  const recent = filtered
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 10)
    .map((t) => ({ data: t.date, nome: t.name, tipo: t.type, categoria: t.category, valor: t.amount }));

  return {
    ok: true,
    month: targetMonth,
    totals: { receitas, despesas, reservas, saldo },
    byCategory,
    recent,
  };
}
