import express from 'express';
import cookieSession from 'cookie-session';
import path from 'path';
import { fileURLToPath } from 'url';

import { config, assertConfig } from './config.js';
import { router } from './routes.js';
import { logger, requestContext, requestLogger, safeError } from './logger.js';

assertConfig();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (config.isProd) app.set('trust proxy', 1);

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

app.listen(config.port, () => logger.info('server_started', { port: config.port, nodeEnv: process.env.NODE_ENV || 'development', logLevel: logger.level }));
