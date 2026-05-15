import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  appsScriptUrl: process.env.APPS_SCRIPT_URL || '',
  appsScriptToken: process.env.APPS_SCRIPT_TOKEN || '',
  appLogin: process.env.APP_LOGIN || '',
  appPassword: process.env.APP_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || 'change-me',
  useMockData: String(process.env.USE_MOCK_DATA || '').toLowerCase() === 'true',
  isProd: process.env.NODE_ENV === 'production',
};

export function assertConfig() {
  if (config.isProd && (!config.sessionSecret || config.sessionSecret === 'change-me')) {
    throw new Error('SESSION_SECRET não configurado (obrigatório em produção).');
  }

  // Em dev, deixamos rodar sem tudo configurado (para UI/fluxo local),
  // mas o /api vai falhar até preencher.
  return true;
}
