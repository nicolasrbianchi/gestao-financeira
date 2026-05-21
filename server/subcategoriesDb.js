import { query } from './db.js';

function sanitizeName(value) {
  return String(value || '').trim();
}

export async function listSubcategories({ includeInactive = false } = {}) {
  const { rows } = await query(
    `select id, name, is_active as "isActive"
     from subcategories
     where ($1::boolean = true) or (is_active = true)
     order by lower(name) asc`,
    [includeInactive]
  );
  return rows;
}

export async function createSubcategory({ name }) {
  const n = sanitizeName(name);
  if (!n) throw new Error('Nome obrigatório.');
  const { rows } = await query(
    `insert into subcategories (name)
     values ($1)
     on conflict (name) do update set name=excluded.name
     returning id, name, is_active as "isActive"`,
    [n]
  );
  return rows[0];
}

export async function updateSubcategory(id, { name, isActive } = {}) {
  const subcategoryId = Number(id || 0);
  if (!subcategoryId) throw new Error('id inválido.');

  const fields = [];
  const params = [subcategoryId];
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
    `update subcategories
       set ${fields.join(', ')}, updated_at=now()
     where id=$1
     returning id, name, is_active as "isActive"`,
    params
  );
  if (!rows[0]) throw new Error('Classificação não encontrada.');
  return rows[0];
}
