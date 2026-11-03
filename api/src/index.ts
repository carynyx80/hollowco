import { MIN_PRICE } from './guardrails.js';
import './env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as auth from './auth.js';
import PDFDocument from 'pdfkit';
import * as db from './db.js';
import { env } from './env.js';
import { aiMode } from './ai.js';
import { printfulMode } from './printful.js';
import { createOrder, createMultiOrder, captureOrder, getOrder } from './paypal.js';
import { createShop, fulfil, id, jailbreak, ledger, ledgerView, refreshPayouts } from './core.js';
import { LIMITS } from './guardrails.js';
import { checkShopQuota, takeAction, isDemo, SHOP_LIMITS } from './limits.js';
import { usageSnapshot } from './ai.js';
import * as carts from './cart.js';
import { assignPlot, releasePlot, backfillPlots, displayName, DISTRICTS } from './city.js';

const app = express();
const origins = env('CORS_ORIGINS', '*').split(',').map((s) => s.trim());
app.set('trust proxy', 1);
app.use(cors({ origin: origins.includes('*') ? true : origins, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '200kb' }));
const wrap = (f: any) => (req: any, res: any) => Promise.resolve(f(req, res)).catch((e: any) => { console.error(e?.message); res.status(e?.status || 400).json({ error: e?.message || 'error' }); });
const me = async (q: any) => auth.userFromToken(q.cookies?.[auth.COOKIE]);
const need = async (q: any) => { const u = await me(q); if (!u) { const e: any = new Error('Sign in required'); e.status = 401; throw e; } return u; };
async function shopQuota(u: any) {
  const all = (await db.list('shops', 5000)).map((x) => x.data);
  const t = (s: any) => Date.parse(s.createdAt) || 0;
  return checkShopQuota(all.filter((s) => s.ownerId === u.id).map(t), all.map(t), isDemo(u));
}
// Legacy auto-added '<Name> Watch' placeholders are hidden everywhere.
const legacyWatch = (p: any) => p.comingSoon && p.kind === 'watch' && !p.image;
const pub = (s: any) => s && ({ ...s, products: s.products.filter((p: any) => !legacyWatch(p)).map(({ content, ...p }: any) => ({ ...p, preview: content ? content.slice(0, 400) : undefined })) });

app.get('/', (_q, r) => r.json({ name: 'HollowCo API', ok: true }));
app.get('/health', (_q, r) => r.json({ ok: true, db: db.dbMode, ai: aiMode(), supplier: printfulMode(), paypalEnv: env('PAYPAL_ENV', 'sandbox'), paypalClientId: env('PAYPAL_CLIENT_ID'), limits: LIMITS }));
app.get('/limits', wrap(async (q: any, r: any) => { const u = await me(q); let mine: any = null; if (u) { try { mine = await shopQuota(u); } catch (e: any) { mine = { blocked: e.message }; } } r.json({ shops: SHOP_LIMITS(), mine, usage: usageSnapshot() }); }));
app.get('/config', (_q, r) => r.json({ paypalClientId: env('PAYPAL_CLIENT_ID'), paypalEnv: env('PAYPAL_ENV', 'sandbox'), ai: aiMode(), supplier: printfulMode() }));
const jobs = new Map<string, { status: string; log: string[]; shopId?: string; error?: string; started: number; ownerId?: string }>();
app.post('/auth/signup', wrap(async (q: any, r: any) => { const u = await auth.signup(q.body.email, q.body.password, q.body.name); r.cookie(auth.COOKIE, await auth.newSession(u.id), auth.cookieOpts()); r.json({ user: auth.publicUser(u) }); }));
app.post('/auth/signin', wrap(async (q: any, r: any) => { const u = await auth.signin(q.body.email, q.body.password); r.cookie(auth.COOKIE, await auth.newSession(u.id), auth.cookieOpts()); r.json({ user: auth.publicUser(u) }); }));
app.post('/auth/signout', wrap(async (q: any, r: any) => { await auth.endSession(q.cookies?.[auth.COOKIE]); r.clearCookie(auth.COOKIE, { ...auth.cookieOpts(), maxAge: undefined }); r.json({ ok: true }); }));
app.get('/auth/me', wrap(async (q: any, r: any) => { const u = await me(q); u ? r.json({ user: auth.publicUser(u) }) : r.status(401).json({ error: 'not signed in' }); }));
app.get('/me/dashboard', wrap(async (q: any, r: any) => {
  const u = await need(q);
  const shops = (await db.list('shops', 5000)).map((x) => x.data).filter((s) => s.ownerId === u.id);
  const ids = new Set(shops.map((s) => s.id));
  const v = await ledgerView();
  const events = v.events.filter((e: any) => e.shopId && ids.has(e.shopId)).slice(0, 100);
  const mine = new Set(v.events.filter((e: any) => e.orderId && ids.has(e.shopId)).map((e: any) => e.orderId));
  const orders = v.orders.filter((o: any) => mine.has(o.orderId));
  const totals = orders.reduce((t: any, o: any) => ({ revenue: t.revenue + o.revenue, supplierCost: t.supplierCost + o.supplierCost, payouts: t.payouts + o.payouts, profit: t.profit + o.profit, orders: t.orders + 1 }), { revenue: 0, supplierCost: 0, payouts: 0, profit: 0, orders: 0 });
  const payouts = events.filter((e: any) => e.kind === 'payout' || (e.kind === 'rejected' && e.orderId));
  r.json({ user: auth.publicUser(u), shops: shops.map((s) => ({ id: s.id, name: s.name, tagline: s.tagline, logo: s.logo, colors: s.colors, createdAt: s.createdAt, products: s.products.filter((p: any) => !p.comingSoon).length,
    revenue: orders.filter((o: any) => o.shop === s.name).reduce((a: number, o: any) => a + o.revenue, 0) })), totals, orders, payouts, events, jobs: [...jobs.entries()].filter(([, j]: any) => j.ownerId === u.id && j.status === 'running').map(([id, j]: any) => ({ id, log: j.log })) });
}));
// Per-account cart: auth required, keyed only by the session's user id.
const noStore = (r: any) => r.set('Cache-Control', 'private, no-store');
app.get('/cart', wrap(async (q: any, r: any) => { const u = await need(q); noStore(r); r.json(await carts.getCart(u.id)); }));
app.put('/cart', wrap(async (q: any, r: any) => { const u = await need(q); noStore(r); if (!Array.isArray(q.body?.lines)) throw new Error('lines[] required'); r.json(await carts.putCart(u.id, q.body.lines, q.body.merge === true)); }));
app.delete('/cart', wrap(async (q: any, r: any) => { const u = await need(q); noStore(r); r.json(await carts.clearCart(u.id)); }));
const CATS: Record<string, string> = { ebook: 'E-books', tshirt: 'T-shirts', mug: 'Mugs', comingsoon: 'Coming soon' };
app.get('/marketplace', wrap(async (q: any, r: any) => {
  const term = String(q.query.q || '').toLowerCase().slice(0, 100), cat = String(q.query.category || '');
  const off = Math.max(0, Number(q.query.offset) || 0), lim = Math.min(48, Math.max(1, Number(q.query.limit) || 24));
  const all: any[] = [];
  for (const { data: s } of await db.list('shops', 5000)) for (const p of s.products) {
    if (p.comingSoon || !p.image) continue;
    if (cat && p.kind !== cat) continue;
    if (term && !`${p.title} ${p.description} ${s.name}`.toLowerCase().includes(term)) continue;
    all.push({ id: p.id, shopId: s.id, shopName: s.name, shopLogo: s.logo, accent: s.colors?.[1], title: p.title, price: p.price, kind: p.kind, category: CATS[p.kind] || p.kind, digital: p.digital, image: p.image, description: p.description });
  }
  r.json({ items: all.slice(off, off + lim), total: all.length, nextOffset: off + lim < all.length ? off + lim : null, categories: Object.entries(CATS).filter(([id]) => id !== 'comingsoon').map(([id, label]) => ({ id, label })) });
}));
app.get('/products/:shopId/:pid', wrap(async (q: any, r: any) => {
  const s = pub(await db.get('shops', q.params.shopId)); const p = s?.products.find((x: any) => x.id === q.params.pid);
  if (!p) return r.status(404).json({ error: 'not found' });
  r.json({ product: { ...p, category: CATS[p.kind] || p.kind }, shop: { id: s.id, name: s.name, tagline: s.tagline, logo: s.logo, colors: s.colors, idea: s.idea }, more: s.products.filter((x: any) => x.id !== p.id && !x.comingSoon).slice(0, 4) });
}));
app.post('/shops/jobs', wrap(async (q: any, r: any) => {
  const owner = await need(q);
  await shopQuota(owner);
  const jid = 'job_' + Math.random().toString(36).slice(2, 12); const j: any = { status: 'running', log: [], started: Date.now(), ownerId: owner.id }; jobs.set(jid, j);
  j.owner = displayName(owner);
  createShop(q.body.idea, (s) => { j.log.push(s); console.log(s); }, owner.id, async (p) => { j.plan = { shopId: p.shopId, name: p.name, plot: await assignPlot(p.shopId, p.kinds, p.color, p.text) }; })
    .then((s: any) => { j.status = 'done'; j.shopId = s.id; j.notices = s.notices || []; cityCache = null; }).catch((e: any) => { j.status = 'error'; j.error = e.message; if (j.plan) releasePlot(j.plan.shopId).catch(() => {}); });
  setTimeout(() => jobs.delete(jid), 3600_000); r.json({ id: jid });
}));
app.get('/shops/jobs/:id', (q: any, r: any) => { const j = jobs.get(q.params.id); j ? r.json({ ...j, elapsedMs: Date.now() - j.started }) : r.status(404).json({ error: 'not found' }); });
app.post('/shops', wrap(async (q: any, r: any) => { const u = await need(q); await shopQuota(u); r.json(pub(await createShop(q.body.idea, (s) => console.log(s), u.id, (p) => assignPlot(p.shopId, p.kinds, p.color, p.text)))); cityCache = null; }));
app.get('/shops', wrap(async (_q: any, r: any) => r.json((await db.list('shops', 50)).map((x) => ({ id: x.id, name: x.data.name, tagline: x.data.tagline, logo: x.data.logo, colors: x.data.colors })))));
app.get('/shops/:id', wrap(async (q: any, r: any) => { const s = await db.get('shops', q.params.id); if (!s) return r.status(404).json({ error: 'not found' }); const { ownerId, idea, notices, ...rest } = pub(s); r.json({ ...rest, owner: ownerId ? displayName(await db.get('users', ownerId).catch(() => null)) : 'HollowCo' }); }));
app.get('/assets/:id', wrap(async (q: any, r: any) => {
  const a = await db.get('assets', q.params.id); if (!a) return r.status(404).end();
  r.setHeader('Content-Type', a.mime); r.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); r.end(Buffer.from(a.b64, 'base64'));
}));
export const MAX_STORES = 10;
// Checkout. Accepts { shopId, items } (one store) or { stores: [{ shopId, items }] } (global cart).
// One store -> one order (as before). Several stores -> a parent checkout with one child order per store,
// paid by ONE PayPal order that has one purchase_unit per store (reference_id = shop id).
app.post('/orders', wrap(async (q: any, r: any) => {
  const groups: { shopId: string; items: any[] }[] = Array.isArray(q.body.stores) ? q.body.stores : [{ shopId: q.body.shopId, items: q.body.items || [] }];
  const merged = new Map<string, any[]>(); for (const g of groups) merged.set(String(g.shopId), [...(merged.get(String(g.shopId)) || []), ...(g.items || [])]);
  if (merged.size > MAX_STORES) { const e: any = new Error(`PayPal allows at most ${MAX_STORES} stores per checkout — remove ${merged.size - MAX_STORES} store(s) from your cart and check out the rest separately.`); e.status = 422; throw e; }
  const units: { shop: any; items: any[] }[] = [];
  for (const [sid, raw] of merged) {
    const shop = await db.get('shops', sid); if (!shop) throw new Error('shop not found');
    const items = raw.slice(0, 10).map((i: any) => {
      const p = shop.products.find((x: any) => x.id === i.productId);
      if (!p || p.comingSoon) throw new Error('product unavailable');
      return { productId: p.id, name: p.title, price: p.price, qty: Math.max(1, Math.min(5, Number(i.qty) || 1)), digital: p.digital, sku: p.id };
    });
    if (items.length) units.push({ shop, items });
  }
  if (!units.length) throw new Error('empty cart');
  const buyerId = (await me(q))?.id || undefined;
  const sum = (it: any[]) => Math.round(it.reduce((s: number, i: any) => s + i.price * i.qty, 0) * 100) / 100;
  const now = new Date().toISOString();
  if (units.length === 1) {
    const { shop, items } = units[0]; const orderId = id('o');
    const pp = await createOrder(items, orderId);
    if (!pp.ok) throw new Error('PayPal create failed: ' + (pp.j.message || pp.status));
    await db.put('orders', orderId, { id: orderId, shopId: shop.id, items, total: sum(items), paypalOrderId: pp.j.id, status: pp.j.status, createdAt: now, buyerId });
    await db.put('orders', 'pp_' + pp.j.id, { ref: orderId });
    return r.json({ orderId, paypalOrderId: pp.j.id, approve: pp.j.links?.find((l: any) => l.rel === 'approve' || l.rel === 'payer-action')?.href });
  }
  const pp = await createMultiOrder(units.map((u) => ({ ref: u.shop.id, items: u.items })));
  if (!pp.ok) throw new Error('PayPal create failed: ' + (pp.j.details?.[0]?.description || pp.j.message || pp.status));
  const cid = id('c'); const children: string[] = [];
  for (const u of units) { const oid = id('o'); children.push(oid); await db.put('orders', oid, { id: oid, parent: cid, shopId: u.shop.id, items: u.items, total: sum(u.items), paypalOrderId: pp.j.id, status: pp.j.status, createdAt: now }); }
  await db.put('orders', cid, { id: cid, checkout: true, children, total: sum(units.flatMap((u) => u.items)), paypalOrderId: pp.j.id, status: pp.j.status, createdAt: now, buyerId });
  await db.put('orders', 'pp_' + pp.j.id, { ref: cid });
  r.json({ orderId: cid, paypalOrderId: pp.j.id, stores: units.length });
}));
const orderView = async (o: any): Promise<any> => o?.checkout ? checkoutView(o) : (await refreshPayouts(o).catch(() => o), { shop: await db.get('shops', o.shopId).then((s: any) => s && { id: s.id, name: s.name, logo: s.logo }).catch(() => null), paypalOrderId: o.paypalOrderId, captureId: o.captureId, captureStatus: o.captureStatus, payer: o.payer, paymentSource: o.paymentSource, simulated: !!o.simulated, failure: o.failure, createdAt: o.createdAt, id: o.id, status: o.status, total: o.total, items: o.items, supplier: o.supplier, payouts: o.payouts, downloads: o.status === 'COMPLETED' ? o.items.filter((i: any) => i.digital).map((i: any) => ({ title: i.name, pdf: `/download/${o.id}/${i.productId}.pdf`, md: `/download/${o.id}/${i.productId}.md` })) : [] });
async function checkoutView(c: any) {
  const stores = await Promise.all(c.children.map(async (cid: string) => orderView(await db.get('orders', cid))));
  const all = (k: string) => stores.some((s: any) => Array.isArray(s[k])) ? stores.flatMap((s: any) => s[k] || []) : undefined;
  return { id: c.id, checkout: true, paypalOrderId: c.paypalOrderId, status: c.status, failure: c.failure, total: c.total, createdAt: c.createdAt, payer: c.payer, paymentSource: c.paymentSource,
    captureStatus: stores.every((s: any) => s.captureStatus === 'COMPLETED') ? 'COMPLETED' : stores.find((s: any) => s.captureStatus)?.captureStatus, captureIds: stores.map((s: any) => s.captureId).filter(Boolean),
    items: stores.flatMap((s: any) => s.items), downloads: stores.flatMap((s: any) => s.downloads), supplier: all('supplier'), payouts: stores.every((s: any) => Array.isArray(s.payouts)) ? stores.flatMap((s: any) => s.payouts) : undefined, stores };
}
// Apply one PayPal purchase_unit (its capture + shipping) to a store order.
function applyUnit(o: any, j: any, pu: any, ship: any) {
  const cap = pu?.payments?.captures?.[0];
  if (j?.status) o.status = j.status === 'COMPLETED' && cap?.status !== 'COMPLETED' && cap?.status !== 'PENDING' ? 'FAILED' : j.status;
  if (cap) { o.captureId = cap.id; o.captureStatus = cap.status; o.capturedAmount = Number(cap.amount?.value ?? o.total); }
  if (j?.payer) o.payer = { email: j.payer.email_address, name: [j.payer.name?.given_name, j.payer.name?.surname].filter(Boolean).join(' ') };
  if (j?.payment_source) o.paymentSource = Object.keys(j.payment_source)[0];
  // Ship physical items to the address the buyer gave PayPal (Printful drafts only; never confirmed). One address for every store.
  const sh = pu?.shipping?.address?.address_line_1 ? pu.shipping : ship;
  if (sh?.address?.address_line_1 && !o.shipping) o.shipping = { name: String(sh.name?.full_name || o.payer?.name || 'HollowCo Buyer').slice(0, 80), address1: sh.address.address_line_1, address2: sh.address.address_line_2, city: sh.address.admin_area_2, state_code: sh.address.admin_area_1, country_code: sh.address.country_code, zip: sh.address.postal_code };
}
// Pull the authoritative state from PayPal and apply it. Used by capture, return-handling and webhooks (idempotent).
async function syncOrder(ppId: string, tryCapture: boolean) {
  const ref = await db.get('orders', 'pp_' + ppId); if (!ref) { const e: any = new Error('order not found'); e.status = 404; throw e; }
  const o = await db.get('orders', ref.ref);
  if (o.status !== 'COMPLETED') {
    let j: any = null;
    if (tryCapture) {
      const c = await captureOrder(ppId);
      const issue = c.j.details?.[0]?.issue || c.j.name;
      if (c.ok) j = c.j;
      else if (issue === 'ORDER_ALREADY_CAPTURED') j = (await getOrder(ppId)).j;
      else {
        await ledger('capture_failed', { orderId: o.id, shopId: o.shopId, detail: issue + (o.checkout ? ` (checkout of ${o.children.length} stores)` : '') });
        o.failure = issue; await db.put('orders', o.id, o);
        const e: any = new Error(issue === 'INSTRUMENT_DECLINED' ? 'Your card or PayPal funding source was declined. Please try another.' : 'Payment could not be captured: ' + issue);
        e.status = 422; e.issue = issue; throw e;
      }
    } else j = (await getOrder(ppId)).j;
    const units: any[] = j?.purchase_units || []; const ship = units.find((u) => u.shipping?.address?.address_line_1)?.shipping;
    if (o.checkout) {
      for (const cid of o.children) { const c = await db.get('orders', cid); if (c.status === 'COMPLETED') continue; applyUnit(c, j, units.find((u) => u.reference_id === c.shopId), ship); await db.put('orders', cid, c); }
      const kids = await Promise.all(o.children.map((cid: string) => db.get('orders', cid)));
      o.status = kids.every((c: any) => c.status === 'COMPLETED') ? 'COMPLETED' : kids.some((c: any) => c.status === 'FAILED') ? 'FAILED' : j?.status || o.status;
      if (j?.payer) o.payer = { email: j.payer.email_address, name: [j.payer.name?.given_name, j.payer.name?.surname].filter(Boolean).join(' ') };
      if (j?.payment_source) o.paymentSource = Object.keys(j.payment_source)[0];
    } else applyUnit(o, j, units[0], ship);
    await db.put('orders', o.id, o);
    if (o.status === 'COMPLETED' && o.buyerId) {
      const kids = o.checkout ? await Promise.all(o.children.map((cid: string) => db.get('orders', cid))) : [o];
      await carts.removePurchased(o.buyerId, kids.flatMap((c: any) => c.items.map((i: any) => ({ shopId: c.shopId, productId: i.productId })))).catch((e) => console.error('cart clear', e.message));
    }
  }
  if (o.checkout) { for (const cid of o.children) { const c = await db.get('orders', cid); if (c.status === 'COMPLETED') await fulfil(cid); } return await db.get('orders', o.id); }
  return o.status === 'COMPLETED' ? await fulfil(o.id) : o;
}
app.post('/orders/:ppId/capture', async (q: any, r: any) => {
  try { r.json(await orderView(await syncOrder(q.params.ppId, true))); }
  catch (e: any) { r.status(e.status || 400).json({ error: e.message, issue: e.issue }); }
});
// Return-handling: the receipt page calls this to recover an order whose popup closed before capture finished.
app.get('/orders/pp/:ppId', wrap(async (q: any, r: any) => r.json(await orderView(await syncOrder(q.params.ppId, q.query.capture === '1')))));
// PayPal webhook. We never trust the payload: we only take the order id from it and re-read the order from PayPal's API.
app.post('/paypal/webhook', async (q: any, r: any) => {
  const ev = q.body || {}; const res = ev.resource || {};
  const ppId = ev.event_type?.startsWith('CHECKOUT.ORDER') ? res.id : res.supplementary_data?.related_ids?.order_id;
  try {
    if (ppId && (await db.get('orders', 'pp_' + ppId))) { await syncOrder(ppId, ev.event_type === 'CHECKOUT.ORDER.APPROVED'); await ledger('webhook', { detail: `${ev.event_type} ${ppId}` }); }
  } catch (e: any) { console.error('webhook', e.message); }
  r.json({ ok: true });
});
// Demo: a clearly-labelled SIMULATED customer buys one product. No PayPal call, no money moves, payouts are simulated too.
let lastSim = 0;
app.post('/simulate/order', wrap(async (q: any, r: any) => {
  if (Date.now() - lastSim < 4000) { const e: any = new Error('The simulated customer is still shopping — try again in a few seconds.'); e.status = 429; throw e; }
  const u = await me(q);
  takeAction('simulate', u ? 'u:' + u.id : 'ip:' + q.ip, isDemo(u) ? 'demo' : u ? 'user' : 'anon');
  lastSim = Date.now();
  let shops = (await db.list('shops', 5000)).map((x) => x.data).filter((s) => s.products?.some((p: any) => !p.comingSoon));
  if (q.body?.shopId) shops = shops.filter((s) => s.id === q.body.shopId);
  else if (u && shops.some((s) => s.ownerId === u.id)) shops = shops.filter((s) => s.ownerId === u.id);
  if (!shops.length) throw new Error('No shop to buy from yet — build one first.');
  const shop = shops[Math.floor(Math.random() * Math.min(shops.length, 8))];
  const prods = shop.products.filter((p: any) => !p.comingSoon); const p = prods[Math.floor(Math.random() * prods.length)];
  const orderId = id('o');
  const items = [{ productId: p.id, name: p.title, price: p.price, qty: 1, digital: p.digital, sku: p.id }];
  await db.put('orders', orderId, { id: orderId, shopId: shop.id, items, total: p.price, status: 'COMPLETED', simulated: true, test: true, payer: { name: 'Simulated Customer', email: 'simulated@hollowco.app' }, paymentSource: 'simulated', createdAt: new Date().toISOString() });
  r.json(await orderView(await fulfil(orderId)));
}));
app.get('/orders/:id', wrap(async (q: any, r: any) => { const o = await db.get('orders', q.params.id); (o?.items || o?.checkout) ? r.json(await orderView(o)) : r.status(404).json({ error: 'not found' }); }));
app.get('/download/:orderId/:file', wrap(async (q: any, r: any) => {
  const o = await db.get('orders', q.params.orderId);
  const [pid, ext] = q.params.file.split('.');
  if (!o || o.status !== 'COMPLETED' || !o.items.some((i: any) => i.productId === pid && i.digital)) return r.status(403).json({ error: 'not paid' });
  const shop = await db.get('shops', o.shopId); const p = shop.products.find((x: any) => x.id === pid);
  if (ext === 'md') { r.setHeader('Content-Type', 'text/markdown; charset=utf-8'); r.setHeader('Content-Disposition', `attachment; filename="${pid}.md"`); return r.end(p.content); }
  r.setHeader('Content-Type', 'application/pdf'); r.setHeader('Content-Disposition', `attachment; filename="${pid}.pdf"`);
  const doc = new PDFDocument({ margin: 56 }); doc.pipe(r);
  for (const line of String(p.content).split('\n')) {
    const t = line.replace(/\*\*|\*|`/g, '');
    if (t.startsWith('# ')) doc.moveDown().fontSize(22).font('Helvetica-Bold').text(t.slice(2));
    else if (t.startsWith('## ')) doc.moveDown(0.6).fontSize(15).font('Helvetica-Bold').text(t.slice(3));
    else if (t.startsWith('### ')) doc.fontSize(12).font('Helvetica-Bold').text(t.slice(4));
    else doc.fontSize(11).font('Helvetica').text(t.replace(/^- \[ \]/, '☐').replace(/^- /, '• '));
  }
  doc.end();
}));

// ---- HollowCo City: the marketplace as a map ----
let cityCache: { at: number; body: any } | null = null;
async function cityView() {
  if (cityCache && Date.now() - cityCache.at < 2500) return cityCache.body;
  const [shops, plots, v] = await Promise.all([db.list('shops', 100000), db.list('plots', 100000), ledgerView()]);
  const plotOf = new Map(plots.map((r) => [r.id, r.data]));
  const names = new Map<string, string>();
  for (const id of new Set(shops.map((r) => r.data.ownerId).filter(Boolean))) names.set(id, displayName(await db.get('users', id)));
  const rev = new Map<string, { r: number; n: number }>();
  for (const o of v.orders) { const k = o.shop; const x = rev.get(k) || { r: 0, n: 0 }; x.r += o.revenue; x.n++; rev.set(k, x); }
  const out = shops.filter((r) => plotOf.has(r.id)).map(({ id, data: s }) => { const live = (s.products || []).filter((p: any) => !p.comingSoon);
    return { id, name: s.name, tagline: s.tagline, logo: s.logo, colors: s.colors, owner: names.get(s.ownerId) || 'HollowCo', ownerId: s.ownerId, createdAt: s.createdAt, plot: plotOf.get(id), revenue: Math.round((rev.get(s.name)?.r || 0) * 100) / 100, orders: rev.get(s.name)?.n || 0,
      kinds: [...new Set(live.map((p: any) => p.kind))], products: live.length, minPrice: live.length ? Math.min(...live.map((p: any) => p.price)) : 0 }; })
    .sort((a, b) => a.plot.idx - b.plot.idx);
  const body = { shops: out, districts: Object.entries(DISTRICTS).map(([id, d]) => ({ id, label: d.label, seed: d.seed })), totals: v.totals };
  cityCache = { at: Date.now(), body }; return body;
}
app.get('/city', wrap(async (_q: any, r: any) => {
  const body = await cityView();
  const construction = [...jobs.values()].filter((j: any) => j.status === 'running' && j.plan).map((j: any) => ({ shopId: j.plan.shopId, name: j.plan.name, owner: j.owner, plot: j.plan.plot, log: j.log[j.log.length - 1] || '', started: j.started }));
  r.setHeader('Cache-Control', 'no-store'); r.json({ ...body, construction, now: new Date().toISOString() });
}));
app.patch('/me/profile', wrap(async (q: any, r: any) => {
  const u = await need(q); const n = String(q.body?.name || '').replace(/[<>]/g, '').trim().slice(0, 40);
  if (n.length < 2) throw new Error('Display name must be at least 2 characters.'); if (n.includes('@')) throw new Error('Display name can’t be an email address.');
  u.name = n; await db.put('users', u.id, u); cityCache = null; r.json({ user: auth.publicUser(u) });
}));
app.get('/activity', wrap(async (q: any, r: any) => r.json((await db.list('ledger', Math.min(100, Number(q.query.limit) || 40))).map((x) => x.data))));
app.get('/ledger', wrap(async (_q: any, r: any) => r.json(await ledgerView())));
app.post('/jailbreak', wrap(async (q: any, r: any) => { const u = await me(q); takeAction('jailbreak', u ? 'u:' + u.id : 'ip:' + q.ip, isDemo(u) ? 'demo' : u ? 'user' : 'anon'); r.json(await jailbreak(q.body.message)); }));

const port = Number(env('PORT', '4000'));
async function repriceShops() {
  for (const { id: sid, data: s } of await db.list('shops', 5000)) {
    let changed = false;
    for (const p of s.products || []) if (!p.digital && !p.comingSoon && p.price < (MIN_PRICE[p.kind] || 0)) { p.price = MIN_PRICE[p.kind]; changed = true; }
    if (changed) { await db.put('shops', sid, s); console.log('repriced', sid); }
  }
}
db.init().then(repriceShops).then(() => auth.ensureDemo().catch((e) => console.error('demo', e.message))).then(() => backfillPlots().catch((e) => console.error('plots', e.message))).then(() => app.listen(port, () => console.log(`HollowCo API on :${port} db=${db.dbMode} ai=${aiMode()} supplier=${printfulMode()}`)));
