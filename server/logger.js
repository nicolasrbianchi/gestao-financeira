import crypto from 'crypto';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const envLevel = process.env.LOG_LEVEL?.toLowerCase();
const defaultLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const activeLevel = LEVELS[envLevel] !== undefined ? envLevel : defaultLevel;

const redactKey = (key = '') => /token|password|secret|cookie|authorization/i.test(key);

const sanitizeValue = (value) => {
  if (value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactKey(k) ? '[REDACTED]' : sanitizeValue(v)]));
  }
  if (typeof value === 'string' && value.length > 300) return `${value.slice(0, 300)}...`;
  return value;
};

const emit = (level, msg, fields = {}) => {
  if (LEVELS[level] > LEVELS[activeLevel]) return;
  const payload = { level, msg, timestamp: new Date().toISOString(), ...sanitizeValue(fields) };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

export const logger = {
  level: activeLevel,
  isDebug: activeLevel === 'debug',
  error: (msg, fields) => emit('error', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  info: (msg, fields) => emit('info', msg, fields),
  debug: (msg, fields) => emit('debug', msg, fields),
};

export const createRequestId = () => crypto.randomUUID().slice(0, 8);

export function requestContext(req, _res, next) {
  req.requestId = createRequestId();
  req.requestStart = Date.now();
  next();
}

export function requestLogger(req, res, next) {
  if (!req.path.startsWith('/api')) return next();
  logger.info('api_request_started', { requestId: req.requestId, method: req.method, path: req.path, authenticated: !!req.session?.authenticated });
  res.on('finish', () => {
    logger.info('api_request_completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - req.requestStart,
      authenticated: !!req.session?.authenticated,
    });
  });
  next();
}

export const safeError = (err) => ({ message: err?.message || 'Erro interno', stack: logger.isDebug ? err?.stack : undefined });
