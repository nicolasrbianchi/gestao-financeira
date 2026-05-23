import { query } from './db.js';
import { logger } from './logger.js';

export async function listPendingImports(ctx = {}) {
  const requestId = ctx.requestId;
  const pendingWindowDays = Number(process.env.IMPORT_INBOX_PENDING_WINDOW_DAYS || 3);

  const whereWindow = Number.isFinite(pendingWindowDays) && pendingWindowDays > 0
    ? ` and occurred_at >= (now() - ($1::int * interval '1 day'))`
    : '';

  const params = whereWindow ? [Math.floor(pendingWindowDays)] : [];
  const { rows } = await query(
    `select id, provider, external_id, occurred_at, description, account_hint, amount, currency, status, created_at,
            (raw->'transaction'->>'amount') as raw_amount,
            (raw->'transaction'->>'type') as raw_type,
            (raw->'transaction'->>'operationType') as raw_operation_type,
            (raw->'transaction'->'paymentData'->>'paymentMethod') as raw_payment_method,
            (raw->'transaction'->'merchant'->>'businessName') as raw_merchant_name
       from import_inbox
      where status='pending'${whereWindow}
      order by occurred_at desc nulls last, id desc`
    ,
    params
  );
  logger.debug('import_inbox_listed', { requestId, count: rows.length });

  const normalize = (s) => String(s || '').trim();
  const nameFromDescription = (desc) => {
    const s = normalize(desc);
    if (!s) return '';
    if (s.includes('|')) {
      const parts = s.split('|').map((x) => x.trim()).filter(Boolean);
      if (parts.length) return parts[parts.length - 1];
    }
    return s;
  };

  const accountFromHint = (hint) => {
    const s = normalize(hint);
    if (!s) return '';
    // Ex: "Nu Pagamentos S.A. - Instituição de Pagamento" → "Nu Pagamentos S.A."
    if (s.includes(' - ')) return s.split(' - ')[0].trim();
    return s;
  };
  const mapPaymentMethod = ({ paymentMethod, operationType, description }) => {
    const pm = String(paymentMethod || '').toUpperCase();
    const op = String(operationType || '').toUpperCase();
    const desc = String(description || '').toLowerCase();

    if (pm === 'PIX' || op === 'PIX') return 'Pix';
    if (pm === 'BOLETO' || op === 'BOLETO') return 'Boleto';

    if (op === 'CARTAO') {
      if (desc.includes('crédito') || desc.includes('credito')) return 'Crédito';
      if (desc.includes('débito') || desc.includes('debito')) return 'Débito';
      return 'Débito';
    }

    return '';
  };

  return rows.map((r) => {
    const provider = String(r.provider);
    const rawAmount = Number(r.raw_amount);
    const tipo = provider === 'pluggy' && Number.isFinite(rawAmount)
      ? (rawAmount < 0 ? 'Despesa' : 'Receita')
      : '';
    const nome = provider === 'pluggy'
      ? (normalize(r.raw_merchant_name) || nameFromDescription(r.description))
      : '';
    const conta = provider === 'pluggy'
      ? accountFromHint(r.account_hint)
      : '';
    const forma = provider === 'pluggy'
      ? mapPaymentMethod({ paymentMethod: r.raw_payment_method, operationType: r.raw_operation_type, description: r.description })
      : '';

    return {
      id: Number(r.id),
      provider,
      externalId: String(r.external_id),
      occurredAt: r.occurred_at ? new Date(r.occurred_at).toISOString() : null,
      description: String(r.description || ''),
      accountHint: String(r.account_hint || ''),
      amount: Number(r.amount || 0),
      currency: String(r.currency || 'BRL'),
      status: String(r.status || 'pending'),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      prefill: provider === 'pluggy' ? { nome, tipo, conta, forma } : null,
    };
  });
}

export async function rejectImport(id, ctx = {}) {
  const requestId = ctx.requestId;
  const importId = Number(id || 0);
  if (!importId) throw new Error('id inválido.');
  const { rowCount } = await query(
    `update import_inbox set status='rejected', updated_at=now() where id=$1 and status='pending'`,
    [importId]
  );
  if (!rowCount) throw new Error('Import não encontrado (ou já processado).');
  logger.info('import_inbox_rejected', { requestId, id: importId });
  return { ok: true, id: importId };
}

export async function approveImport(id, transactionId, ctx = {}) {
  const requestId = ctx.requestId;
  const importId = Number(id || 0);
  const txId = Number(transactionId || 0);
  if (!importId) throw new Error('id inválido.');
  if (!txId) throw new Error('transactionId inválido.');

  const { rowCount } = await query(
    `update import_inbox
        set status='approved', approved_transaction_id=$2, updated_at=now()
      where id=$1 and status='pending'`,
    [importId, txId]
  );
  if (!rowCount) throw new Error('Import não encontrado (ou já processado).');
  logger.info('import_inbox_approved', { requestId, id: importId, transactionId: txId });
  return { ok: true, id: importId, transactionId: txId };
}
