# Gestão Financeira (Render + React + Express + Google Sheets)

Arquitetura: React/Vite (frontend) -> Express (Render) -> Apps Script -> Google Sheets.

## Nota sobre o legado
Existe uma versão antiga (vanilla JS + PWA) que chamava o Apps Script direto (JSONP + token no client). Ela foi movida para `legacy/pwa/` apenas como referência durante a refatoração.

## Estrutura da planilha referência
- Abas: Resumo, Transações, Categorias, Dividas, meses, Fontes.
- `Transações` colunas: Data, Nome, Tipo, Reserva, Conta/Canal, Categoria, Subcategoria, Forma, Valor, Status, Parcela, Obs.
- `Resumo` foi usado para inferir regras: receitas e despesas por `Tipo`; reservas por `Tipo=Reserva` e `Reserva=Entrada/Saida`; saldo derivado.

## .env
Copie `.env.example` para `.env` e ajuste:

- `APP_LOGIN` / `APP_PASSWORD`
- (opcional) `APPS_SCRIPT_URL` / `APPS_SCRIPT_TOKEN`
- `USE_MOCK_DATA=true` permite rodar a UI sem Apps Script configurado (dados mock)

## Rodar
- `npm install`
- `npm run dev`
- `npm run build`
- `npm start`

## Deploy Render
Build: `npm install && npm run build`
Start: `npm start`

## Apps Script
Atualize `Codigo.gs` com `SPREADSHEET_ID` e `SECRET_TOKEN`, publique Web App e use URL `/exec` em `APPS_SCRIPT_URL`.

## Escopo inicial
Inclui Home, Transações, Categorias, login com sessão e criação/listagem; sem edição/exclusão e sem telas de dívidas/abas mensais.
