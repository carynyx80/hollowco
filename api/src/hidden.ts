// Public-view moderation: shops flagged "hidden" are filtered out of the city, marketplace, ledger feed and stats.
// Nothing is deleted — the ledger keeps every row; hidden rows are only excluded from PUBLIC views.
// Sources (union): DEFAULT_HIDDEN below (applies on deploy), env HIDDEN_SHOP_IDS (comma list), the hidden_shops
// table (written by POST /admin/hidden, guarded by ADMIN_SECRET), and throwaway test+…@example.com owners.
import * as db from './db.js';
import { env } from './env.js';

const DEFAULT_HIDDEN = [
  'shop_2cc5e2b30267', 'shop_a1045913ac7e', 'shop_417da43283f6', // "Nurse…" limit-test shops (u_e77e737325315042)
  'shop_e353edffa8d2', // duplicate Eko Time (shop_92cbffe14b7c is kept)
  'shop_eec882a491b1', 'shop_ef852e047209', 'shop_5cb87a42d404', 'shop_75b5ac84bc98', 'shop_1d29a715cca1', // test shops: City Greenery, Neon Nocturne, Founder Store, Rainy Day Reads, Easy Green
];
const HIDDEN_OWNERS = ['u_e77e737325315042'];
const KEEP = new Set(['shop_3211ffb30858', 'shop_0883badb22ca', 'shop_92cbffe14b7c', 'shop_34d91012f69f', ...(env('SHOWCASE_SHOP_IDS') || '').split(',').map((s) => s.trim()).filter(Boolean)]); // showcase shops never auto-hidden
const TEST_EMAIL = /^test\+.*@example\.com$/i;

export async function migrate() {
  if (!db.sql) return;
  await db.sql.query(`create table if not exists hidden_shops (shop_id text primary key, hidden boolean not null default true, reason text, updated timestamptz not null default now())`);
}
const flagged = new Map<string, boolean>(); // in-memory fallback when there is no DATABASE_URL
let cache: { at: number; set: Set<string> } | null = null;
export const bust = () => { cache = null; };

export async function hiddenSet(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < 30000) return cache.set;
  const set = new Set<string>([...DEFAULT_HIDDEN, ...(env('HIDDEN_SHOP_IDS') || '').split(',').map((s) => s.trim()).filter(Boolean)]);
  const unhide = new Set<string>();
  try {
    const rows = db.sql ? (await db.sql.query(`select shop_id, hidden from hidden_shops`)).rows : [...flagged].map(([shop_id, hidden]) => ({ shop_id, hidden }));
    for (const r of rows) (r.hidden ? set : unhide).add(r.shop_id);
  } catch { /* table missing: ignore */ }
  try {
    const shops = await db.list('shops', 100000); const owners = new Map<string, any>();
    for (const { id, data: s } of shops) {
      if (KEEP.has(id) || !s.ownerId) continue;
      if (HIDDEN_OWNERS.includes(s.ownerId)) { set.add(id); continue; }
      if (!owners.has(s.ownerId)) owners.set(s.ownerId, await db.get('users', s.ownerId).catch(() => null));
      if (TEST_EMAIL.test(owners.get(s.ownerId)?.email || '')) set.add(id);
    }
  } catch { /* keep explicit list */ }
  for (const id of unhide) set.delete(id);
  for (const id of KEEP) if (!unhide.has(id) && !flagged.has(id)) set.delete(id);
  cache = { at: Date.now(), set }; return set;
}
export async function setHidden(shopId: string, hidden: boolean, reason = '') {
  if (db.sql) await db.sql.query(`insert into hidden_shops(shop_id, hidden, reason) values($1,$2,$3) on conflict(shop_id) do update set hidden=excluded.hidden, reason=excluded.reason, updated=now()`, [shopId, hidden, reason.slice(0, 200)]);
  else flagged.set(shopId, hidden);
  bust();
}
/** Is this ledger row about a hidden shop? (rows carry shopId; legacy rows only the shop name) */
export function rowHidden(e: any, hid: Set<string>, hiddenNames: Set<string>) { return (e?.shopId && hid.has(e.shopId)) || (!e?.shopId && e?.shop && hiddenNames.has(e.shop)); }
export async function hiddenNames(hid: Set<string>, visibleNames?: Set<string>) {
  const names = new Set<string>(); const vis = new Set<string>(visibleNames || []);
  for (const { id, data } of await db.list('shops', 100000)) (hid.has(id) ? names : vis).add(data.name);
  for (const n of vis) names.delete(n); // a name shared with a visible shop (e.g. the kept Eko Time) is never hidden by name
  return names;
}
/** Public ledger: drop hidden shops' rows/orders and recompute totals. Underlying rows are untouched. */
export async function publicLedger(v: any) {
  const hid = await hiddenSet(); if (!hid.size) return v; const hn = await hiddenNames(hid);
  const events = (v.events || []).filter((e: any) => !rowHidden(e, hid, hn));
  const badOrders = new Set((v.events || []).filter((e: any) => e.orderId && rowHidden(e, hid, hn)).map((e: any) => e.orderId));
  const orders = (v.orders || []).filter((o: any) => !badOrders.has(o.orderId));
  const totals = orders.reduce((s: any, o: any) => ({ revenue: s.revenue + o.revenue, supplierCost: s.supplierCost + o.supplierCost, payouts: s.payouts + o.payouts, profit: s.profit + o.profit }), { revenue: 0, supplierCost: 0, payouts: 0, profit: 0 });
  return { ...v, events, orders, totals };
}
export async function publicRows<T extends { data: any }>(rows: T[]): Promise<T[]> {
  const hid = await hiddenSet(); if (!hid.size) return rows; const hn = await hiddenNames(hid);
  return rows.filter((r: any) => !(r.id && hid.has(r.id)) && !rowHidden(r.data, hid, hn)); // shop rows: match by row id (shop data has no shopId)
}
