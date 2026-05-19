# Gestão Financeira

Stack: **React/Vite + Express + Apps Script + Google Sheets**.

## Setup
1. `npm install`
2. Criar `.env` com:
   - `APP_LOGIN`, `APP_PASSWORD`, `SESSION_SECRET`
   - `APPS_SCRIPT_URL`, `APPS_SCRIPT_TOKEN`
   - `LOG_LEVEL` (`error|warn|info|debug`, padrão: `debug` em dev, `info` em produção)
   - opcional `ENABLE_DIAGNOSTICS=true` para habilitar `/api/debug/diagnostics`
   - opcional `USE_MOCK_DATA=true` somente em desenvolvimento
3. `npm run dev`

## Produção (Render)
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Script start local/prod: `node server/index.js`
- Em produção, `APPS_SCRIPT_URL` é obrigatório.

## Observabilidade
- Logs estruturados JSON com `requestId` por requisição.
- Erros da API retornam `requestId` para rastreio.
- Logs em `debug` trazem resumos sanitizados (filtros, contagens, campos detectados), sem payload financeiro completo.
- Segredos e dados sensíveis (token/senha/cookies/headers) nunca são logados.

## Avisos conhecidos
- `express-session` com `MemoryStore` permanece por simplicidade/single-user; **não recomendado** para produção multiusuário/distribuída.
- Chunk warning do Vite reduzido com `manualChunks` para `recharts`; ainda pode variar conforme crescimento do app.

## Apps Script
- Publicar `Codigo.gs` como Web App.
- Ações suportadas: `health`, `metadata`, `transactions`, `add`, `config`, `summary`.
