const state = {
  apiUrl: localStorage.getItem("financeApiUrl") || "",
  token: localStorage.getItem("financeApiToken") || "",
  config: {
    categorias: ["Alimentação", "Saúde", "Transporte", "Moradia", "Lazer", "Outros"],
    contas: ["Santander", "Nubank", "RecargaPay"]
  }
};

const $ = (id) => document.getElementById(id);

const formatBRL = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const todayISO = () => new Date().toISOString().slice(0, 10);

const currentMonth = () => new Date().toISOString().slice(0, 7);

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

function normalizeMoney(value) {
  if (typeof value === "number") return value;
  const clean = String(value || "")
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  const number = Number(clean);
  if (Number.isNaN(number)) throw new Error("Valor inválido.");
  return number;
}

function jsonp(params) {
  return new Promise((resolve, reject) => {
    if (!state.apiUrl) {
      reject(new Error("Configure a URL do Apps Script primeiro."));
      return;
    }

    const callbackName = `financeCallback_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const script = document.createElement("script");
    const url = new URL(state.apiUrl);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });

    url.searchParams.set("callback", callbackName);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao chamar o Apps Script."));
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      if (data && data.ok === false) reject(new Error(data.error || "Erro desconhecido."));
      else resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Não foi possível carregar resposta do Apps Script."));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function fillSelect(id, values, placeholder = "Selecione") {
  const select = $(id);
  select.innerHTML = `<option value="">${placeholder}</option>`;
  values
    .filter(Boolean)
    .forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
}

function applyConfig() {
  fillSelect("categoria", state.config.categorias, "Categoria");
  fillSelect("conta", state.config.contas, "Conta");
}

async function loadConfig() {
  try {
    const data = await jsonp({ action: "config" });
    state.config = {
      categorias: data.categorias?.length ? data.categorias : state.config.categorias,
      contas: data.contas?.length ? data.contas : state.config.contas
    };
    applyConfig();
  } catch (error) {
    applyConfig();
    console.warn(error);
  }
}

async function loadSummary() {
  try {
    $("recentList").textContent = "Carregando...";
    $("categoryList").textContent = "Carregando...";

    const month = $("monthInput").value || currentMonth();
    const data = await jsonp({ action: "summary", month });

    $("incomeValue").textContent = formatBRL(data.totals.receitas);
    $("expenseValue").textContent = formatBRL(data.totals.despesas);
    $("balanceValue").textContent = formatBRL(data.totals.saldo);
    $("categoryTotalLabel").textContent = formatBRL(data.totals.despesas);

    renderCategories(data.byCategory || [], data.totals.despesas || 0);
    renderRecent(data.recent || []);
  } catch (error) {
    showToast(error.message);
    $("recentList").textContent = "Não consegui carregar.";
    $("categoryList").textContent = "Não consegui carregar.";
  }
}

function renderCategories(items, total) {
  const root = $("categoryList");
  root.className = "category-list";

  if (!items.length) {
    root.className = "category-list empty";
    root.textContent = "Sem dados para este mês.";
    return;
  }

  root.innerHTML = "";
  items.slice(0, 8).forEach((item) => {
    const percent = total ? Math.round((item.valor / total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `
      <div class="category-top">
        <span class="category-name">${item.categoria}</span>
        <span class="category-value">${formatBRL(item.valor)}</span>
      </div>
      <div class="bar"><span style="width:${Math.min(percent, 100)}%"></span></div>
    `;
    root.appendChild(row);
  });
}

function renderRecent(items) {
  const root = $("recentList");
  root.className = "recent-list";

  if (!items.length) {
    root.className = "recent-list empty";
    root.textContent = "Nada lançado ainda.";
    return;
  }

  root.innerHTML = "";
  items.forEach((item) => {
    const isIncome = item.tipo === "Receita";
    const row = document.createElement("div");
    row.className = "recent-row";
    row.innerHTML = `
      <div>
        <div class="recent-name">${item.nome || "Sem nome"}</div>
        <div class="recent-meta">${item.data || ""} · ${item.categoria || item.conta || ""}</div>
      </div>
      <div class="recent-value ${isIncome ? "income" : "expense"}">
        ${isIncome ? "+" : "-"}${formatBRL(item.valor)}
      </div>
    `;
    root.appendChild(row);
  });
}

function openEntry(tipo) {
  $("tipo").value = tipo;
  $("formTitle").textContent = tipo === "Receita" ? "Nova receita" : "Nova despesa";
  $("data").value = todayISO();
  $("status").value = tipo === "Receita" ? "Recebido em dia" : "Pago em dia";
  $("valor").value = "";
  $("nome").value = "";
  $("reserva").value = "";
  $("subcategoria").value = tipo === "Despesa" ? "Essencial" : "";
  $("forma").value = "";
  $("parcela").value = "";
  $("obs").value = "";
  $("entryDialog").showModal();
  setTimeout(() => $("valor").focus(), 150);
}

async function saveEntry(event) {
  event.preventDefault();

  try {
    const payload = {
      action: "add",
      token: state.token,
      data: $("data").value,
      nome: $("nome").value.trim(),
      tipo: $("tipo").value,
      reserva: $("reserva").value,
      conta: $("conta").value,
      categoria: $("categoria").value,
      subcategoria: $("subcategoria").value,
      forma: $("forma").value,
      valor: normalizeMoney($("valor").value),
      status: $("status").value,
      parcela: $("parcela").value.trim(),
      obs: $("obs").value.trim()
    };

    if (!payload.token) throw new Error("Configure o token secreto.");
    if (!payload.nome) throw new Error("Informe o nome.");
    if (!payload.valor) throw new Error("Informe o valor.");

    $("saveBtn").disabled = true;
    $("saveBtn").textContent = "Salvando...";

    await jsonp(payload);

    $("entryDialog").close();
    showToast("Lançamento salvo.");
    await loadSummary();
  } catch (error) {
    showToast(error.message);
  } finally {
    $("saveBtn").disabled = false;
    $("saveBtn").textContent = "Salvar lançamento";
  }
}

function openSettings() {
  $("apiUrl").value = state.apiUrl;
  $("apiToken").value = state.token;
  $("settingsDialog").showModal();
}

function saveSettings() {
  state.apiUrl = $("apiUrl").value.trim();
  state.token = $("apiToken").value.trim();
  localStorage.setItem("financeApiUrl", state.apiUrl);
  localStorage.setItem("financeApiToken", state.token);
  $("settingsDialog").close();
  showToast("Configurações salvas.");
  loadConfig();
  loadSummary();
}

function boot() {
  $("monthInput").value = currentMonth();
  $("apiUrl").value = state.apiUrl;
  $("apiToken").value = state.token;

  applyConfig();

  $("newExpenseBtn").addEventListener("click", () => openEntry("Despesa"));
  $("newIncomeBtn").addEventListener("click", () => openEntry("Receita"));
  $("closeDialog").addEventListener("click", () => $("entryDialog").close());
  $("entryForm").addEventListener("submit", saveEntry);
  $("refreshBtn").addEventListener("click", loadSummary);
  $("monthInput").addEventListener("change", loadSummary);
  $("openSettings").addEventListener("click", openSettings);
  $("closeSettings").addEventListener("click", () => $("settingsDialog").close());
  $("saveSettings").addEventListener("click", saveSettings);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }

  if (!state.apiUrl) {
    setTimeout(openSettings, 500);
  } else {
    loadConfig();
    loadSummary();
  }
}

boot();
