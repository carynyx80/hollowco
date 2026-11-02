export const API = '/api';
export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(j.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return j;
}
export const usd = (n: number) => `$${Number(n || 0).toFixed(2)}`;
