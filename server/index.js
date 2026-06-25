import express from 'express';
import cookieSession from 'cookie-session';
import path from 'path';
import { fileURLToPath } from 'url';

import { config, assertConfig } from './config.js';
import { router, startPluggyAutoFetchScheduler } from './routes.js';
import { logger, requestContext, requestLogger, safeError } from './logger.js';

// DB setup on deploy (opt-in)
const dbPushOnDeploy = ['yes', 'true', '1'].includes(String(process.env.DB_PUSH_ON_DEPLOY || process.env.DB_PUSH_ON_DEPOY || '').toLowerCase());
if (dbPushOnDeploy) {
  try {
    // roda antes de subir o server. Import dinâmico evita custo quando desativado.
    const { dbSetup } = await import('../scripts/dbSetup.js');
    await dbSetup();
  } catch (e) {
    // Falha de schema é fatal (melhor falhar deploy do que subir app quebrado)
    // eslint-disable-next-line no-console
    console.error('❌ DB_PUSH_ON_DEPLOY falhou:', e?.message || String(e));
    process.exit(1);
  }
}

assertConfig();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (config.isProd) app.set('trust proxy', 1);

// Evita respostas 304 (ETag) nos endpoints JSON, que quebram o client (fetch espera body JSON).
// Static assets continuam com cache normal via express.static.
app.set('etag', false);

app.use(requestContext);
app.use(express.json());
app.use(
  cookieSession({
    name: 'gf_session',
    keys: [config.sessionSecret],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
  })
);
app.use(requestLogger);
app.use('/api', router);

app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'dist', 'index.html')));

app.use((err, req, res, _next) => {
  const e = safeError(err);
  logger.error('api_request_failed', { requestId: req.requestId, path: req.path, error: e.message, stack: e.stack });
  res.status(500).json({ ok: false, error: 'Erro interno ao processar requisição.', requestId: req.requestId });
});

app.listen(config.port, () => {
  logger.info('server_started', { port: config.port, nodeEnv: process.env.NODE_ENV || 'development', logLevel: logger.level });
  startPluggyAutoFetchScheduler();
});
