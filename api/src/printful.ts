import { env } from './env.js';
// Printful API v1. Orders are ALWAYS created as drafts (confirm=false). This code never confirms.
const VARIANT = { tshirt: 4012, mug: 1320, poster: 1 } as Record<string, number>; // Bella+Canvas 3001 M White, 11oz mug, poster
const SIM_COST: Record<string, number> = { tshirt: 9.95, mug: 6.5, poster: 7.0 };
export const printfulMode = () => (env('PRINTFUL_API_TOKEN') ? 'printful' : 'simulated');
export async function draftOrder(o: { kind: string; designUrl: string; recipient: any; externalId: string; qty?: number }) {
  const tokenV = env('PRINTFUL_API_TOKEN');
  if (!tokenV) {
    return { mode: 'simulated', id: 'SIM-' + o.externalId, status: 'draft', perUnit: true, cost: SIM_COST[o.kind] ?? 9.95, note: 'SIMULATED SUPPLIER — set PRINTFUL_API_TOKEN for real Printful draft orders' };
  }
  const r = await fetch('https://api.printful.com/orders?confirm=false', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenV}`, 'Content-Type': 'application/json', ...(env('PRINTFUL_STORE_ID') ? { 'X-PF-Store-Id': env('PRINTFUL_STORE_ID') } : {}) },
    body: JSON.stringify({ external_id: o.externalId.slice(0, 32), recipient: o.recipient, items: [{ variant_id: VARIANT[o.kind] ?? VARIANT.tshirt, quantity: Math.max(1, Math.min(5, o.qty || 1)), files: [{ url: o.designUrl }] }] }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) return { mode: 'printful', id: null, status: 'error', perUnit: true, cost: SIM_COST[o.kind] ?? 9.95, note: 'Printful error: ' + (j?.error?.message || r.status) + ' (cost estimated)' };
  return { mode: 'printful', id: String(j.result.id), status: j.result.status, cost: Number(j.result.costs?.total ?? SIM_COST[o.kind]), note: 'Printful DRAFT (not confirmed)' };
}
