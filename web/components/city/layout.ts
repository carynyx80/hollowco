// HollowCo City geometry, shared by the 3D scene and the HUD. Mirrors api/src/city.ts.
// Lots are 7 units, two per block; 5-unit streets every 19 units; z > ~36 is the harbour.
export const PITCH = 19, ROAD = 5, LOTW = 7;
export const lotC = (g: number) => Math.floor(g / 2) * PITCH + (((g % 2) + 2) % 2 ? 13 : 6);
export const plotXZ = (gx: number, gz: number): [number, number] => [lotC(gx), lotC(gz)];
/** Front of the building faces the street on its z side. +1 = faces +z. */
export const faceOf = (gz: number) => (((gz % 2) + 2) % 2 ? 1 : -1);
/** Buildings sit this far back from the lot centre, away from their street, leaving a real sidewalk. */
export const SETBACK = 0.7;
export const CART_AT: [number, number] = [9.5, -9.5];
export const BANK: [number, number] = [-9.5, -9.5];
export const SHORE = 40.5; // quay edge (promenade street at z=38)
export const DOCK: [number, number] = [0, 48];
export const PARKS: [number, number][] = [[9.5, -9.5], [-9.5, 9.5], [9.5, 9.5]];
export const DISTRICT_INFO: Record<string, { label: string; color: string; icon: string }> = {
  books: { label: 'Books Quarter', color: '#E8A87C', icon: 'I' },
  fashion: { label: 'Fashion Avenue', color: '#B98A7A', icon: 'II' },
  goods: { label: 'Goods Market', color: '#D2A066', icon: 'III' },
  maker: { label: 'Maker Row', color: '#A9B4A6', icon: 'IV' },
};
export type P = [number, number, number];
const nearS = (v: number) => Math.round(v / PITCH) * PITCH;
/** Manhattan route along street centre-lines (lane offset `lane`), from a to b. */
export function streetPath(a: [number, number], b: [number, number], y = 0.5, lane = 0): P[] {
  const sx = nearS(a[0]) + lane, sz = nearS(b[1]) + lane;
  return [[a[0], y, a[1]], [a[0], y, nearS(a[1]) + lane], [sx, y, nearS(a[1]) + lane], [sx, y, sz], [b[0], y, sz], [b[0], y, b[1]]];
}
export function arcPath(a: P, b: P, h = 4, n = 14): P[] {
  return Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * h, a[2] + (b[2] - a[2]) * t] as P; });
}
export function pathLen(p: P[]) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]); return s; }
export function samplePath(p: P[], t: number, out: P = [0, 0, 0]): P {
  const L = pathLen(p); let d = Math.max(0, Math.min(1, t)) * L;
  for (let i = 1; i < p.length; i++) { const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]); if (d <= seg || i === p.length - 1) { const u = seg ? Math.min(1, d / seg) : 1; out[0] = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u; out[1] = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u; out[2] = p[i - 1][2] + (p[i][2] - p[i - 1][2]) * u; return out; } d -= seg; }
  return out;
}
export type Style = 'glass' | 'brick' | 'boutique' | 'warehouse';
export type Plot = { gx: number; gz: number; district: string; style: Style; tier: number; color: string; idx: number };
/** Height in world units: style + tier set at creation, revenue adds floors. */
export function heightOf(style: Style, tier: number, rev: number) {
  const r = Math.min(10, Math.sqrt(Math.max(0, rev)) * 1.1);
  return style === 'glass' ? 11 + tier * 5 + r * 1.4 : style === 'brick' ? 5.5 + tier * 2.2 + r * 0.6 : style === 'boutique' ? 3.6 + tier * 0.9 + r * 0.25 : 4.2 + tier * 0.7 + r * 0.2;
}
export type CityShop = { id: string; name: string; tagline?: string; logo?: string; colors?: string[]; owner: string; revenue: number; orders: number; products: number; kinds: string[]; minPrice: number;
  plot: Plot; x: number; z: number; face: number; h: number; mine?: boolean; fresh?: boolean };
export type Site = { shopId: string; name: string; owner: string; log: string; x: number; z: number; face: number };
export type Packet = { kind: 'paypal' | 'payout' | 'supplier' | 'alarm'; path: P[]; color: string; t0: number; dur: number; replay?: boolean };
export const bus = typeof window !== 'undefined' ? ((window as any).__cityBus ||= new EventTarget()) as EventTarget : new EventTarget();
export const emit = (t: string, d?: any) => bus.dispatchEvent(new CustomEvent(t, { detail: d }));
export const assetUrl = (u?: string) => u ? u.replace(/^https?:\/\/[^/]+\/assets\//, '/api/assets/') : '';
/** City extents (in blocks) covering every plot, the plaza and the waterfront. */
export function bounds(shops: { plot: Plot }[]) {
  let a = -1, b = 0, c = -1, d = 1; // kx min/max, kz min/max (blocks)
  for (const s of shops) { const kx = Math.floor(s.plot.gx / 2), kz = Math.floor(s.plot.gz / 2); a = Math.min(a, kx); b = Math.max(b, kx); c = Math.min(c, kz); d = Math.max(d, kz); }
  return { kx0: a - 1, kx1: b + 1, kz0: c - 1, kz1: 1 };
}
/** Live lighting state shared by every component (updated each frame by the sky). 0 = noon, 1 = midnight. */
export const ENV = { night: 1 };
export type Bounds = ReturnType<typeof bounds>;
export type Quality = 'low' | 'med' | 'high';
export const QUALITY = {
  low: { dpr: 1, shadows: 0, cars: 24, peds: 70, detail: 24, bloom: false, env: false, trees: 0.5, ms: 0 },
  med: { dpr: 1.25, shadows: 1024, cars: 54, peds: 150, detail: 60, bloom: true, env: true, trees: 0.8, ms: 0 },
  high: { dpr: 1.75, shadows: 2048, cars: 100, peds: 260, detail: 120, bloom: true, env: true, trees: 1, ms: 4 },
} as const;
export function detectQuality(): Quality {
  if (typeof window === 'undefined') return 'med';
  const q = new URLSearchParams(location.search).get('q'); if (q === 'low' || q === 'med' || q === 'high') return q;
  const saved = localStorage.getItem('city-quality'); if (saved === 'low' || saved === 'med' || saved === 'high') return saved;
  const cores = navigator.hardwareConcurrency || 4; const mem = (navigator as any).deviceMemory || 4; const small = Math.min(screen.width, screen.height) < 700;
  if (small || cores <= 4 || mem <= 2) return 'low'; if (cores >= 8 && mem >= 8) return 'high'; return 'med';
}
