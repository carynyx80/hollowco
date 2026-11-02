// City geometry helpers shared by the 3D scene and the HUD.
export const LOT = 6; export const SPAN = 4; // lots at -24..24
export const STREETS = [-27, -21, -15, -9, -3, 3, 9, 15, 21, 27];
export const BANK: [number, number] = [-12, 0];
export const DOCK: [number, number] = [0, 33];
export const GUARDS: [number, number][] = [[-31, -31], [31, -31], [-31, 27], [31, 27]];
const RESERVED = new Set(['0,0', '-12,0', '-6,0', '6,0', '0,-6', '0,6']);
export const LOTS: [number, number][] = (() => {
  const l: [number, number][] = [];
  for (let i = -SPAN; i <= SPAN; i++) for (let j = -SPAN; j <= SPAN; j++) { const k = `${i * LOT},${j * LOT}`; if (!RESERVED.has(k)) l.push([i * LOT, j * LOT]); }
  return l.sort((a, b) => Math.hypot(...a) - Math.hypot(...b) || a[0] - b[0] || a[1] - b[1]);
})();
const near = (v: number) => STREETS.reduce((b, s) => (Math.abs(s - v) < Math.abs(b - v) ? s : b), STREETS[0]);
export type P = [number, number, number];
/** Route along the street grid from a to b (manhattan), lifted slightly above the asphalt. */
export function streetPath(a: [number, number], b: [number, number], y = 0.45): P[] {
  const sxA = near(a[0] + 0.01), szB = near(b[1] + 0.01);
  return [[a[0], y, a[1]], [sxA, y, a[1]], [sxA, y, szB], [b[0], y, szB], [b[0], y, b[1]]];
}
/** Parabolic arc (for payouts / rooftop hops). */
export function arcPath(a: P, b: P, h = 4, n = 14): P[] {
  return Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * h, a[2] + (b[2] - a[2]) * t] as P; });
}
export function pathLen(p: P[]) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]); return s; }
export function samplePath(p: P[], t: number, out: P = [0, 0, 0]): P {
  const L = pathLen(p); let d = Math.max(0, Math.min(1, t)) * L;
  for (let i = 1; i < p.length; i++) { const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]); if (d <= seg || i === p.length - 1) { const u = seg ? Math.min(1, d / seg) : 1; out[0] = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u; out[1] = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u; out[2] = p[i - 1][2] + (p[i][2] - p[i - 1][2]) * u; return out; } d -= seg; }
  return out;
}
export const buildingHeight = (rev: number) => 3 + Math.min(14, Math.sqrt(Math.max(0, rev)) * 2.2);
export type CityShop = { id: string; name: string; tagline?: string; logo?: string; colors?: string[]; revenue: number; orders: number; mine?: boolean; lot: [number, number]; fresh?: boolean };
export type Packet = { kind: 'paypal' | 'payout' | 'supplier' | 'alarm'; path: P[]; color: string; t0: number; dur: number; replay?: boolean };
/** Tiny pub/sub between the DOM HUD and the WebGL scene. */
export const bus = typeof window !== 'undefined' ? ((window as any).__cityBus ||= new EventTarget()) as EventTarget : new EventTarget();
export const emit = (t: string, d?: any) => bus.dispatchEvent(new CustomEvent(t, { detail: d }));
