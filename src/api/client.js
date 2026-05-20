export async function api(path, opts = {}) {
  const r = await fetch(`/api${path}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const text = await r.text();
  let d = {};
  try {
    d = text ? JSON.parse(text) : {};
  } catch {
    d = { ok: false, error: 'Resposta inválida da API (não-JSON).', _raw: text?.slice?.(0, 300) };
  }
  if (!r.ok) {
    const code = d.requestId ? ` Código: ${d.requestId}` : '';
    throw new Error(`${d.error || 'Erro na API'}${code}`);
  }
  return d;
}
export const withQuery = (path, params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  return `${path}?${q.toString()}`;
};
