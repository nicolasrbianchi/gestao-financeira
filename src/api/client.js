export async function api(path, opts = {}) {
  const r = await fetch(`/api${path}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
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
