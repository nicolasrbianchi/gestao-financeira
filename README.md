# Gestão Financeira

Stack: **React/Vite + Express + Apps Script + Google Sheets**.

## Setup
1. `npm install`
2. Criar `.env` com:
   - `APP_LOGIN`, `APP_PASSWORD`, `SESSION_SECRET`
   - `APPS_SCRIPT_URL`, `APPS_SCRIPT_TOKEN`
   - opcional `USE_MOCK_DATA=true` somente em desenvolvimento
3. `npm run dev`

## Produção (Render)
- Build: `npm install && npm run build`
- Start: `npm start`
- Em produção, `APPS_SCRIPT_URL` é obrigatório.

## Apps Script
- Publicar `Codigo.gs` como Web App.
- Ações suportadas: `health`, `metadata`, `transactions`, `add`, `config`, `summary`.
- A aba **Transações** deve conter as colunas exatas:
  `Data, Nome, Tipo, Reserva, Conta/Canal, Categoria, Subcategoria, Forma, Valor, Status, Parcela, Obs`.

## Regras desta versão
- Sem banco de dados.
- Frontend nunca acessa Apps Script direto.
- Sem edição/exclusão de transações.
- Sem polling automático.
