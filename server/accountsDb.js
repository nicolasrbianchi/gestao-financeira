import { query } from './db.js';

function sanitizeName(value) {
  return String(value || '').trim();
}

export async function listAccounts({ includeInactive = false } = {}) {
  const { rows } = await query(
    `select id, name, is_active as "isActive"
       from accounts
      where ($1::boolean = true) or (is_active = true)
      order by lower(name) asc`,
    [includeInactive]
  );
  return rows;
}

export async function createAccount({ name }) {
  const n = sanitizeName(name);
  if (!n) throw new Error('Nome obrigatório.');

  // Upsert case-insensitive (via uq_accounts_name_lower)
  try {
    const { rows } = await query(
      `insert into accounts (name)
       values ($1)
       returning id, name, is_active as "isActive"`,
      [n]
    );
    return rows[0];
  } catch (e) {
    // 23505: unique_violation
    if (String(e?.code || '') !== '23505') throw e;
    const { rows: existing } = await query(
      `select id from accounts where lower(name)=lower($1) limit 1`,
      [n]
    );
    const id = existing[0]?.id;
    if (!id) throw e;
    const updated = await updateAccount(id, { name: n, isActive: true });
    return updated;
  }
}

export async function updateAccount(id, { name, isActive } = {}) {
  const accountId = Number(id || 0);
  if (!accountId) throw new Error('id inválido.');

  const fields = [];
  const params = [accountId];
  let p = 2;

  if (name !== undefined) {
    const n = sanitizeName(name);
    if (!n) throw new Error('Nome obrigatório.');
    fields.push(`name=$${p++}`);
    params.push(n);
  }
  if (isActive !== undefined) {
    fields.push(`is_active=$${p++}`);
    params.push(!!isActive);
  }

  if (!fields.length) throw new Error('Nada para atualizar.');

  const { rows } = await query(
    `update accounts
        set ${fields.join(', ')}, updated_at=now()
      where id=$1
      returning id, name, is_active as "isActive"`,
    params
  );
  if (!rows[0]) throw new Error('Conta não encontrada.');
  return rows[0];
}
