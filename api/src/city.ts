// HollowCo City: persistent, deterministic plots. Every shop gets one lot on a planned street grid,
// assigned server-side in creation order so all viewers see the same stable layout.
import * as db from './db.js';
export type District = 'books' | 'fashion' | 'goods' | 'maker';
export const DISTRICTS: Record<District, { label: string; style: string[]; seed: [number, number] }> = {
  books: { label: 'Books Quarter', style: ['brick', 'brick', 'glass'], seed: [-5, -3] },
  fashion: { label: 'Fashion Avenue', style: ['boutique', 'boutique', 'glass'], seed: [4, -3] },
  goods: { label: 'Goods Market', style: ['warehouse', 'warehouse', 'brick'], seed: [0, 3] },
  maker: { label: 'Maker Row', style: ['glass', 'brick', 'boutique'], seed: [0, -8] },
};
// Grid: lots are 7 units wide, two lots per block, 5-unit streets every block (block pitch 19).
// gz > 3 is the harbour. The 4 blocks around the origin are the plaza (beacon, bank, parks).
const WATER_GZ = 3;
const reserved = (gx: number, gz: number) => (gx >= -2 && gx <= 1 && gz >= -2 && gz <= 1) || gz > WATER_GZ;
const CANDIDATES: [number, number][] = [];
for (let gx = -40; gx <= 40; gx++) for (let gz = -60; gz <= WATER_GZ; gz++) if (!reserved(gx, gz)) CANDIDATES.push([gx, gz]);
const nearest = (gx: number, gz: number) => (Object.keys(DISTRICTS) as District[]).reduce((b, d) => { const s = DISTRICTS[d].seed, t = DISTRICTS[b].seed; return Math.hypot(gx - s[0], gz - s[1]) < Math.hypot(gx - t[0], gz - t[1]) ? d : b; }, 'maker' as District);
const TERRITORY: Record<District, [number, number][]> = { books: [], fashion: [], goods: [], maker: [] };
for (const c of CANDIDATES) TERRITORY[nearest(c[0], c[1])].push(c);
for (const d of Object.keys(TERRITORY) as District[]) { const s = DISTRICTS[d].seed; TERRITORY[d].sort((a, b) => Math.hypot(a[0] - s[0], a[1] - s[1]) - Math.hypot(b[0] - s[0], b[1] - s[1]) || a[0] - b[0] || a[1] - b[1]); }

// District = the shop's primary theme, from the founder's own words (idea, name, tagline, product names).
// LLM-free keyword scoring; ties fall back to the product mix.
const THEMES: Record<District, RegExp> = {
  fashion: /\b(wear|wearing|threads?|tees?|t-?shirts?|shirts?|hoodies?|apparel|fashion|style|streetwear|cloth(ing|es)?|outfits?|boutique|merch|drip|sneakers?|femme|ambition)\b/gi,
  goods: /\b(food|bread|sourdough|bak(e|ery|ing)|coffee|tea|kitchen|cook(ing)?|recipes?|home|cozy|plants?|green(ery)?|garden(ing)?|ceramics?|mugs?|grocer(y|ies)|snacks?|rooftop|oasis|grow)\b/gi,
  books: /\b(books?|reads?|reading|journal(s|ing)?|notes?|guides?|learn(ing)?|course|education|study|nurs(e|es|ing)|mindful|ebooks?|stories|writing|workbook)\b/gi,
  maker: /\b(handmade|craft(s|ed)?|makers?|art|artisan|design|neon|illuminat\w*|tech|gadgets?|adventures?|travel(s|ers?)?|explore|night|printing)\b/gi,
};
export function districtFor(kinds: string[], text = ''): District {
  const sc = (Object.keys(THEMES) as District[]).map((d) => [d, (text.match(THEMES[d]) || []).length] as const).sort((x, y) => y[1] - x[1]);
  if (sc[0][1] > 0 && sc[0][1] > sc[1][1]) return sc[0][0];
  const n = (k: string) => kinds.filter((x) => x === k).length;
  const e = n('ebook'), t = n('tshirt'), m = n('mug');
  if (e > t && e > m) return 'books'; if (t > e && t > m) return 'fashion'; if (m > e && m > t) return 'goods';
  return sc[0][1] > 0 ? sc[0][0] : 'maker';
}
export const themeText = (s: any) => [s?.idea, s?.name, s?.tagline, ...(s?.products || []).map((p: any) => p.name)].filter(Boolean).join(' ');
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
let chain: Promise<any> = Promise.resolve();
// Serialised so two concurrent builds never get the same lot.
export function assignPlot(shopId: string, kinds: string[], color?: string, text = ''): Promise<any> {
  const run = async () => {
    const existing = await db.get('plots', shopId); if (existing) return existing;
    const all = (await db.list('plots', 100000)).map((r) => r.data).filter((p) => !p.marker);
    const used = new Set(all.map((p) => `${p.gx},${p.gz}`));
    const district = districtFor(kinds, text);
    const lot = TERRITORY[district].find(([x, z]) => !used.has(`${x},${z}`)) || CANDIDATES.find(([x, z]) => !used.has(`${x},${z}`))!;
    const h = hash(shopId), styles = DISTRICTS[district].style;
    const plot = { shopId, gx: lot[0], gz: lot[1], district, style: styles[h % styles.length], tier: 1 + (h >> 4) % 3, color: color || '#8B7BFF', createdAt: new Date().toISOString(), idx: all.length };
    await db.put('plots', shopId, plot); return plot;
  };
  const p = chain.then(run, run); chain = p.catch(() => {}); return p;
}
export const releasePlot = (shopId: string) => db.del('plots', shopId);
// Backfill: oldest shop first, so the founding shops sit closest to the plaza.
const MIGRATION = '__districts_v3';
export async function backfillPlots() {
  const shops = (await db.list('shops', 100000)).reverse();
  const kindsOf = (d: any) => (d.products || []).filter((p: any) => !p.comingSoon).map((p: any) => p.kind);
  // One-time re-zoning by theme (v3). After this, plots never move again.
  if (!(await db.get('plots', MIGRATION))) {
    for (const r of await db.list('plots', 100000)) await db.del('plots', r.id);
    for (const { id, data } of shops) await assignPlot(id, kindsOf(data), data.colors?.[1], themeText(data));
    await db.put('plots', MIGRATION, { marker: true, at: new Date().toISOString() }); console.log(`city: re-zoned ${shops.length} shops by theme`); return;
  }
  let n = 0; for (const { id, data } of shops) if (!(await db.get('plots', id))) { await assignPlot(id, kindsOf(data), data.colors?.[1], themeText(data)); n++; }
  console.log(`city: backfilled ${n} plots`);
}
// Public display name: never an email address.
export const displayName = (u: any) => { const n = String(u?.name || '').trim(); const s = n && !n.includes('@') ? n : String(u?.email || 'founder').split('@')[0]; return s.slice(0, 40) || 'founder'; };
