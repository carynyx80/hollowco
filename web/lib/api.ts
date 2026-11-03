export const API = '/api';
export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(j.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return j;
}
export const usd = (n: number) => `$${Number(n || 0).toFixed(2)}`;
/** Resized, re-encoded (WebP/AVIF) version of an uploaded asset via Next's image optimizer. Shop logos and product
 *  art are 1–1.5 MB PNGs at source; the city and catalogue only ever show them at 64–640 px. */
export const thumb = (u: string | undefined, w: 64 | 128 | 256 | 384 | 640 | 1080 = 384) => {
  if (!u) return u; const local = u.replace(/^https?:\/\/[^/]+\/assets\//, '/api/assets/');
  return local.startsWith('/api/assets/') ? `/_next/image?url=${encodeURIComponent(local)}&w=${w}&q=72` : u;
};
