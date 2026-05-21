# Nicco Finance

Tagline: **Precisão financeira**

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

### Keep-alive (Render Free)

No plano free do Render o serviço pode “dormir” por inatividade. Para reduzir cold starts, expusemos dois endpoints **sem autenticação**:

- `GET /api/ping` → `204`
- `GET /api/wakeup` → `204`

E configuramos um monitor externo no **UptimeRobot** (https://dashboard.uptimerobot.com/monitors) para bater periodicamente em `/api/wakeup`.

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

### Deploy automático (GitHub → Apps Script)
Este repo pode fazer deploy automático do Apps Script via **GitHub Actions** usando **clasp**.

Requisitos:
- Configurar o secret `CLASPRC_JSON` no GitHub (conteúdo do arquivo `~/.clasprc.json` gerado pelo `clasp login`).
- (Uma vez) Ativar a **Google Apps Script API** na conta: https://script.google.com/home/usersettings

Configuração de propriedades (Script Properties) via GitHub Actions (manual):
- Criar secrets:
  - `APPS_SCRIPT_SPREADSHEET_ID`
  - `APPS_SCRIPT_SECRET_TOKEN`
- Rodar o workflow **Configure Apps Script Properties** (Actions tab)

Quando ocorrer push na `main` alterando `Codigo.gs` e/ou `apps-script/appsscript.json`, o workflow faz:
- `clasp push` (atualiza o código no projeto do Apps Script)
- `clasp deploy` (re-deploy no mesmo deploymentId do Web App)

Obs: o manifest do Apps Script fica em `apps-script/appsscript.json`.

### Operação (regra prática)
- Mudou algo no **Apps Script** (ex: `Codigo.gs` ou `apps-script/appsscript.json`)?
  → além do deploy normal do app (Render), **precisa rodar/aguardar** o workflow **Deploy Apps Script Web App** ficar verde.
- Se o merge foi na `main`, ele roda automático. Se precisar forçar, roda manualmente em **Actions → Deploy Apps Script Web App → Run workflow**.
