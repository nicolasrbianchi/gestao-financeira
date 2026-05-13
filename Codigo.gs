/**
 * Finanças Mobile - Google Apps Script
 *
 * 1. Cole este arquivo em Extensões > Apps Script.
 * 2. Preencha SPREADSHEET_ID e SECRET_TOKEN.
 * 3. Implante como Web App.
 * 4. Use a URL /exec na tela de configurações do app mobile.
 */

const SPREADSHEET_ID = "COLE_AQUI_O_ID_DA_SUA_PLANILHA";
const SECRET_TOKEN = "troque-essa-chave-secreta";
const TRANSACTIONS_SHEET = "Transações";
const SOURCES_SHEET = "Fontes";

function doGet(e) {
  const p = e.parameter || {};
  const action = p.action || "summary";

  try {
    if (action === "config") {
      return respond_(getConfig_(), p.callback);
    }

    if (action === "summary") {
      return respond_(getSummary_(p.month), p.callback);
    }

    if (action === "add") {
      validateToken_(p.token);
      return respond_(addTransaction_(p), p.callback);
    }

    return respond_({ ok: false, error: "Ação inválida." }, p.callback);
  } catch (err) {
    return respond_({ ok: false, error: err.message || String(err) }, p.callback);
  }
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || "{}");
  validateToken_(body.token);
  return respond_(addTransaction_(body), body.callback);
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error(`Aba não encontrada: ${name}`);
  return sh;
}

function validateToken_(token) {
  if (!token || token !== SECRET_TOKEN) {
    throw new Error("Token inválido.");
  }
}

function respond_(data, callback) {
  const payload = JSON.stringify(data);
  const output = callback
    ? `${callback}(${payload});`
    : payload;

  return ContentService
    .createTextOutput(output)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function getConfig_() {
  const sh = sheet_(SOURCES_SHEET);
  const lastRow = Math.max(sh.getLastRow(), 2);
  const values = sh.getRange(2, 2, lastRow - 1, 2).getValues();

  const categorias = unique_(values.map(r => r[0]));
  const contas = unique_(values.map(r => r[1]));

  return {
    ok: true,
    categorias,
    contas,
    formas: ["Pix", "Débito", "Crédito", "Depósito", "Dinheiro"],
    status: ["Pago em dia", "Pendente", "Recebido em dia"]
  };
}

function addTransaction_(p) {
  const sh = sheet_(TRANSACTIONS_SHEET);

  const date = p.data ? new Date(`${p.data}T12:00:00`) : new Date();
  const value = parseMoney_(p.valor);

  if (!p.nome) throw new Error("Nome obrigatório.");
  if (!p.tipo) throw new Error("Tipo obrigatório.");
  if (!value) throw new Error("Valor obrigatório.");

  sh.appendRow([
    date,
    p.nome || "",
    p.tipo || "Despesa",
    p.reserva || "",
    p.conta || "",
    p.categoria || "",
    p.subcategoria || "",
    p.forma || "",
    value,
    p.status || "",
    p.parcela || "",
    p.obs || ""
  ]);

  const row = sh.getLastRow();
  sh.getRange(row, 1).setNumberFormat("dd/mm/yyyy");
  sh.getRange(row, 9).setNumberFormat("R$ #,##0.00");

  return { ok: true, row };
}

function getSummary_(month) {
  const target = month || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  const sh = sheet_(TRANSACTIONS_SHEET);
  const lastRow = sh.getLastRow();

  if (lastRow < 2) {
    return emptySummary_(target);
  }

  const values = sh.getRange(2, 1, lastRow - 1, 12).getValues();
  const rows = values
    .map(rowToObject_)
    .filter(item => item.dataKey && item.dataKey.slice(0, 7) === target);

  let receitas = 0;
  let despesas = 0;
  const categoryMap = {};

  rows.forEach(item => {
    if (item.tipo === "Receita") receitas += item.valor;
    if (item.tipo === "Despesa") {
      despesas += item.valor;
      const cat = item.categoria || "Sem categoria";
      categoryMap[cat] = (categoryMap[cat] || 0) + item.valor;
    }
  });

  const byCategory = Object.entries(categoryMap)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);

  const recent = rows
    .sort((a, b) => String(b.dataKey).localeCompare(String(a.dataKey)))
    .slice(0, 10);

  return {
    ok: true,
    month: target,
    totals: {
      receitas,
      despesas,
      saldo: receitas - despesas
    },
    byCategory,
    recent
  };
}

function rowToObject_(r) {
  const date = r[0] instanceof Date ? r[0] : null;
  const dataKey = date
    ? Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd")
    : "";

  return {
    data: date ? Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM") : "",
    dataKey,
    nome: r[1] || "",
    tipo: r[2] || "",
    reserva: r[3] || "",
    conta: r[4] || "",
    categoria: r[5] || "",
    subcategoria: r[6] || "",
    forma: r[7] || "",
    valor: Number(r[8]) || 0,
    status: r[9] || "",
    parcela: r[10] || "",
    obs: r[11] || ""
  };
}

function parseMoney_(value) {
  if (typeof value === "number") return value;
  return Number(
    String(value || "")
      .replace(/\s/g, "")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
  );
}

function unique_(items) {
  return [...new Set(
    items
      .map(v => String(v || "").trim())
      .filter(v => v && v !== "." && !v.startsWith("="))
  )];
}

function emptySummary_(month) {
  return {
    ok: true,
    month,
    totals: { receitas: 0, despesas: 0, saldo: 0 },
    byCategory: [],
    recent: []
  };
}
