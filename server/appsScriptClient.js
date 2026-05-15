import { config } from './config.js';

const mockTransactions = () => ({
  ok: true,
  transactions: [
    {
      Data: new Date().toISOString().slice(0, 10),
      Nome: 'Salário',
      Tipo: 'Receita',
      Reserva: '',
      'Conta/Canal': 'Conta principal',
      Categoria: 'Renda',
      Subcategoria: '',
      Forma: 'PIX',
      Valor: 5000,
      Status: 'Recebido em dia',
      Parcela: '',
      Obs: 'mock',
      sheetRowNumber: 2,
    },
    {
      Data: new Date().toISOString().slice(0, 10),
      Nome: 'Mercado',
      Tipo: 'Despesa',
      Reserva: '',
      'Conta/Canal': 'Cartão',
      Categoria: 'Alimentação',
      Subcategoria: 'Essencial',
      Forma: 'Crédito',
      Valor: 250,
      Status: 'Pago em dia',
      Parcela: '',
      Obs: 'mock',
      sheetRowNumber: 3,
    },
  ],
});

async function call(action, params = {}) {
  if (!config.appsScriptUrl) {
    if (config.useMockData) {
      if (action === 'transactions') return mockTransactions();
      if (action === 'metadata') {
        return {
          ok: true,
          types: ['Receita', 'Despesa', 'Reserva'],
          categories: ['Renda', 'Alimentação', 'Saúde', 'Moradia'],
          subcategories: ['Essencial', 'Opcional'],
          accounts: ['Conta principal', 'Cartão'],
          paymentMethods: ['PIX', 'Crédito', 'Débito'],
          statuses: ['Recebido em dia', 'Pago em dia'],
          reserves: ['Entrada', 'Saida'],
        };
      }
      if (action === 'health') return { ok: true, mock: true, timestamp: new Date().toISOString() };
      if (action === 'add') return { ok: true, mock: true };

      return { ok: true, mock: true };
    }

    throw new Error('APPS_SCRIPT_URL não configurada');
  }

  const url = new URL(config.appsScriptUrl);
  url.searchParams.set('action', action);
  url.searchParams.set('token', config.appsScriptToken);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  });

  const r = await fetch(url);
  if (!r.ok) throw new Error('Falha Apps Script');

  const data = await r.json();
  if (data.ok === false) throw new Error(data.error || 'Erro Apps Script');

  return data;
}

export const getTransactions = () => call('transactions');
export const getMetadata = () => call('metadata');
export const addTransaction = (payload) => call('add', payload);
export const health = () => call('health');
