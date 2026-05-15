import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

import { config, assertConfig } from './config.js';
import { router } from './routes.js';

assertConfig();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Render (e similares) terminam TLS no proxy e enviam para o Node via HTTP.
// Sem isso, `req.secure` fica false e o express-session não seta cookie `secure`.
if (config.isProd) app.set('trust proxy', 1);

app.use(express.json());

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use('/api', router);

// Frontend (Vite build output)
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'dist', 'index.html')));

app.listen(config.port, () => console.log('running', config.port));
