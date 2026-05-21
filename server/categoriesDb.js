import { query } from './db.js';

function sanitizeName(value) {
  return String(value || '').trim();
}

export async function listCategories({ includeInactive = false } = {}) {
  const { rows } = await query(
    `select id, name, is_active as "isActive"
     from categories
     where ($1::boolean = true) or (is_active = true)
     order by lower(name) asc`,
    [includeInactive]
  );
  return rows;
}

export async function createCategory({ name }) {
  const n = sanitizeName(name);
  if (!n) throw new Error('Nome obrigatório.');
  const { rows } = await query(
    `insert into categories (name)
     values ($1)
     on conflict (name) do update set name=excluded.name
     returning id, name, is_active as "isActive"`,
    [n]
  );
  return rows[0];
}

export async function updateCategory(id, { name, isActive } = {}) {
  const categoryId = Number(id || 0);
  if (!categoryId) throw new Error('id inválido.');

  // Categoria especial usada automaticamente pelo tipo=Saldo.
  const { rows: currentRows } = await query('select name from categories where id=$1', [categoryId]);
  const currentName = String(currentRows[0]?.name || '');
  if (currentName === 'Transferencia entre contas' && isActive === false) {
    throw new Error('Não é permitido arquivar a categoria "Transferencia entre contas" (usada pelo tipo Saldo).');
  }

  const fields = [];
  const params = [categoryId];
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
    `update categories
       set ${fields.join(', ')}, updated_at=now()
     where id=$1
     returning id, name, is_active as "isActive"`,
    params
  );
  if (!rows[0]) throw new Error('Categoria não encontrada.');
  return rows[0];
}
