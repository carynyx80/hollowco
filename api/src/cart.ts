// Per-account cart. Keyed ONLY by the signed-in user's id (from the session cookie) — no cart id ever comes from the client.
import * as db from './db.js';
export const MAX_QTY = 5, MAX_LINES = 50;
type Line = { shopId: string; productId: string; qty: number };
const mem = new Map<string, Map<string, Line>>();
const k = (l: { shopId: string; productId: string }) => l.shopId + '\u0000' + l.productId;
async function raw(uid: string): Promise<Line[]> {
  if (!db.sql) return [...(mem.get(uid)?.values() || [])];
  const r = await db.sql.query('select shop_id, product_id, qty from cart_items where user_id=$1 order by added', [uid]);
  return r.rows.map((x: any) => ({ shopId: x.shop_id, productId: x.product_id, qty: x.qty }));
}
async function write(uid: string, lines: Line[]) {
  if (!db.sql) { mem.set(uid, new Map(lines.map((l) => [k(l), l]))); return; }
  const c = await db.sql.connect();
  try {
    await c.query('begin');
    await c.query('insert into carts(user_id) values($1) on conflict(user_id) do update set updated=now()', [uid]);
    await c.query('delete from cart_items where user_id=$1', [uid]);
    for (const l of lines) await c.query('insert into cart_items(user_id, shop_id, product_id, qty) values($1,$2,$3,$4)', [uid, l.shopId, l.productId, l.qty]);
    await c.query('commit');
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
}
/** Validate against the live catalogue: existing shop + product, not coming soon, priced, qty 1..5. */
async function clean(input: any[]): Promise<{ lines: Line[]; rejected: { shopId: string; productId: string; reason: string }[] }> {
  const out = new Map<string, Line>(); const rejected: any[] = []; const shops = new Map<string, any>();
  for (const i of (Array.isArray(input) ? input : []).slice(0, 200)) {
    const shopId = String(i?.shopId || '').slice(0, 64), productId = String(i?.productId || '').slice(0, 64); const qty = Math.floor(Number(i?.qty));
    if (!shopId || !productId) continue;
    if (!shops.has(shopId)) shops.set(shopId, await db.get('shops', shopId));
    const p = shops.get(shopId)?.products?.find((x: any) => x.id === productId);
    const reason = !p ? 'not found' : p.comingSoon ? 'coming soon' : !(p.price > 0) ? 'not for sale' : !(qty >= 1) ? 'bad quantity' : '';
    if (reason) { rejected.push({ shopId, productId, reason }); continue; }
    const ex = out.get(k({ shopId, productId }));
    if (ex) ex.qty = Math.min(MAX_QTY, ex.qty + qty); else if (out.size < MAX_LINES) out.set(k({ shopId, productId }), { shopId, productId, qty: Math.min(MAX_QTY, qty) });
    else rejected.push({ shopId, productId, reason: 'cart full' });
  }
  return { lines: [...out.values()], rejected };
}
/** Enrich with display data from the catalogue (never trusts client titles/prices). */
async function view(lines: Line[]) {
  const shops = new Map<string, any>(); const res: any[] = [];
  for (const l of lines) {
    if (!shops.has(l.shopId)) shops.set(l.shopId, await db.get('shops', l.shopId));
    const s = shops.get(l.shopId); const p = s?.products?.find((x: any) => x.id === l.productId); if (!p || p.comingSoon) continue;
    res.push({ ...l, title: p.title, price: p.price, image: p.image, digital: !!p.digital, kind: p.kind, shopName: s.name, shopLogo: s.logo, owner: s.ownerName || s.owner || '' });
  }
  return res;
}
export async function getCart(uid: string) { return { lines: await view(await raw(uid)) }; }
export async function putCart(uid: string, input: any[], merge: boolean) {
  const { lines, rejected } = await clean(merge ? [...(await raw(uid)), ...(Array.isArray(input) ? input : [])] : input);
  await write(uid, lines); return { lines: await view(lines), rejected };
}
export async function clearCart(uid: string) { await write(uid, []); return { lines: [] }; }
/** After a successful capture, remove what was bought from the buyer's account cart. */
export async function removePurchased(uid: string, bought: { shopId: string; productId: string }[]) {
  const gone = new Set(bought.map(k)); const left = (await raw(uid)).filter((l) => !gone.has(k(l))); await write(uid, left);
}
