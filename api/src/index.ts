import './env.js';
import express from 'express';
import cors from 'cors';
import PDFDocument from 'pdfkit';
import * as db from './db.js';
import { env } from './env.js';
import { aiMode } from './ai.js';
import { printfulMode } from './printful.js';
import { createOrder, captureOrder } from './paypal.js';
import { createShop, fulfil, id, jailbreak, ledger, ledgerView } from './core.js';
import { LIMITS } from './guardrails.js';

const app = express();
const origins = env('CORS_ORIGINS', '*').split(',').map((s) => s.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json({ limit: '200kb' }));
const wrap = (f: any) => (req: any, res: any) => Promise.resolve(f(req, res)).catch((e: any) => { console.error(e?.message); res.status(400).json({ error: e?.message || 'error' }); });
const pub = (s: any) => s && ({ ...s, products: s.products.map(({ content, ...p }: any) => ({ ...p, preview: content ? content.slice(0, 400) : undefined })) });

app.get('/', (_q, r) => r.json({ name: 'HollowCo API', ok: true }));
app.get('/health', (_q, r) => r.json({ ok: true, db: db.dbMode, ai: aiMode(), supplier: printfulMode(), paypalEnv: env('PAYPAL_ENV', 'sandbox'), paypalClientId: env('PAYPAL_CLIENT_ID'), limits: LIMITS }));
app.get('/config', (_q, r) => r.json({ paypalClientId: env('PAYPAL_CLIENT_ID'), ai: aiMode(), supplier: printfulMode() }));
const jobs = new Map<string, { status: string; log: string[]; shopId?: string; error?: string; started: number }>();
app.post('/shops/jobs', wrap(async (q: any, r: any) => {
  const jid = 'job_' + Math.random().toString(36).slice(2, 12); const j: any = { status: 'running', log: [], started: Date.now() }; jobs.set(jid, j);
  createShop(q.body.idea, (s) => { j.log.push(s); console.log(s); }).then((s: any) => { j.status = 'done'; j.shopId = s.id; }).catch((e: any) => { j.status = 'error'; j.error = e.message; });
  setTimeout(() => jobs.delete(jid), 3600_000); r.json({ id: jid });
}));
app.get('/shops/jobs/:id', (q: any, r: any) => { const j = jobs.get(q.params.id); j ? r.json({ ...j, elapsedMs: Date.now() - j.started }) : r.status(404).json({ error: 'not found' }); });
app.post('/shops', wrap(async (q: any, r: any) => r.json(pub(await createShop(q.body.idea, (s) => console.log(s))))));
app.get('/shops', wrap(async (_q: any, r: any) => r.json((await db.list('shops', 50)).map((x) => ({ id: x.id, name: x.data.name, tagline: x.data.tagline, logo: x.data.logo, colors: x.data.colors })))));
app.get('/shops/:id', wrap(async (q: any, r: any) => { const s = await db.get('shops', q.params.id); s ? r.json(pub(s)) : r.status(404).json({ error: 'not found' }); }));
app.get('/assets/:id', wrap(async (q: any, r: any) => {
  const a = await db.get('assets', q.params.id); if (!a) return r.status(404).end();
  r.setHeader('Content-Type', a.mime); r.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); r.end(Buffer.from(a.b64, 'base64'));
}));
app.post('/orders', wrap(async (q: any, r: any) => {
  const shop = await db.get('shops', q.body.shopId); if (!shop) throw new Error('shop not found');
  const items = (q.body.items || []).slice(0, 10).map((i: any) => {
    const p = shop.products.find((x: any) => x.id === i.productId);
    if (!p || p.comingSoon) throw new Error('product unavailable');
    return { productId: p.id, name: p.title, price: p.price, qty: Math.max(1, Math.min(5, Number(i.qty) || 1)), digital: p.digital, sku: p.id };
  });
  if (!items.length) throw new Error('empty cart');
  const orderId = id('o');
  const pp = await createOrder(items, orderId);
  if (!pp.ok) throw new Error('PayPal create failed: ' + (pp.j.message || pp.status));
  const total = items.reduce((s: number, i: any) => s + i.price * i.qty, 0);
  await db.put('orders', orderId, { id: orderId, shopId: shop.id, items, total, paypalOrderId: pp.j.id, status: pp.j.status, shipping: q.body.shipping, createdAt: new Date().toISOString() });
  await db.put('orders', 'pp_' + pp.j.id, { ref: orderId });
  r.json({ orderId, paypalOrderId: pp.j.id, approve: pp.j.links?.find((l: any) => l.rel === 'approve' || l.rel === 'payer-action')?.href });
}));
app.post('/orders/:ppId/capture', wrap(async (q: any, r: any) => {
  const ref = await db.get('orders', 'pp_' + q.params.ppId); if (!ref) throw new Error('order not found');
  const o = await db.get('orders', ref.ref);
  if (o.status !== 'COMPLETED') {
    const c = await captureOrder(q.params.ppId);
    if (!c.ok) { await ledger('capture_failed', { orderId: o.id, detail: c.j.details?.[0]?.issue || c.j.name }); throw new Error('Capture failed: ' + (c.j.details?.[0]?.issue || c.j.name)); }
    const cap = c.j.purchase_units?.[0]?.payments?.captures?.[0];
    o.status = c.j.status; o.captureId = cap?.id; o.capturedAmount = Number(cap?.amount?.value ?? o.total);
    await db.put('orders', o.id, o);
  }
  const done = o.status === 'COMPLETED' ? await fulfil(o.id) : o;
  r.json(orderView(done));
}));
const orderView = (o: any) => ({ id: o.id, status: o.status, total: o.total, items: o.items, supplier: o.supplier, payouts: o.payouts, downloads: o.status === 'COMPLETED' ? o.items.filter((i: any) => i.digital).map((i: any) => ({ title: i.name, pdf: `/download/${o.id}/${i.productId}.pdf`, md: `/download/${o.id}/${i.productId}.md` })) : [] });
app.get('/orders/:id', wrap(async (q: any, r: any) => { const o = await db.get('orders', q.params.id); o?.items ? r.json(orderView(o)) : r.status(404).json({ error: 'not found' }); }));
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
app.get('/ledger', wrap(async (_q: any, r: any) => r.json(await ledgerView())));
app.post('/jailbreak', wrap(async (q: any, r: any) => r.json(await jailbreak(q.body.message))));

const port = Number(env('PORT', '4000'));
db.init().then(() => app.listen(port, () => console.log(`HollowCo API on :${port} db=${db.dbMode} ai=${aiMode()} supplier=${printfulMode()}`)));
