import crypto from 'node:crypto';
import * as db from './db.js';
import * as ai from './ai.js';
import { checkPrice, checkPayout, LIMITS, floorPrice } from './guardrails.js';
import { draftOrder } from './printful.js';
import { payout, payoutStatus } from './paypal.js';
import { env } from './env.js';
export const id = (p: string) => p + '_' + crypto.randomBytes(6).toString('hex');
const publicBase = () => env('PUBLIC_API_URL', `http://localhost:${env('PORT', '4000')}`);
export async function ledger(kind: string, data: any) {
  const lid = id('l'); await db.put('ledger', lid, { kind, at: new Date().toISOString(), ...data }); return lid;
}
async function saveAsset(img: { mime: string; data: Buffer; provider: string }) {
  const aid = id('a'); await db.put('assets', aid, { mime: img.mime, b64: img.data.toString('base64'), provider: img.provider }); return `${publicBase()}/assets/${aid}`;
}
export async function createShop(idea: string, log: (s: string) => void = () => {}, ownerId?: string, onPlan?: (p: { shopId: string; name: string; kinds: string[]; color: string; text?: string }) => Promise<any> | void) {
  idea = String(idea || '').slice(0, 4000).trim();
  if (idea.length < 3) throw new Error('Tell the founder a business idea first.');
  const shopId = id('shop');
  log('Founder agent: drafting brand');
  const b = await ai.founderBrand(idea, log);
  const notices: string[] = [];
  log(`Founder agent: brand "${b.name}" ready, briefing team`);
  const colors = (b.colors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 3);
  while (colors.length < 3) colors.push(['#2B2B2B', '#FF8A70', '#FBF8F2'][colors.length]);
  await onPlan?.({ shopId, name: String(b.name).slice(0, 40), kinds: (b.products || []).slice(0, 6).filter((p: any) => p.kind !== 'comingsoon').map((p: any) => ['ebook', 'tshirt', 'mug'].includes(p.kind) ? p.kind : 'ebook'), color: colors[1], text: [idea, b.name, b.tagline, ...(b.products || []).map((p: any) => p.name)].join(' ') });
  const logoP = ai.image(`Minimal flat vector logo symbol for "${b.name}", ${b.tagline}. Style: ${b.style || 'minimal'}. Colors ${colors.join(', ')}. No text.`, shopId + 'logo', colors).then(saveAsset);
  const products: any[] = await Promise.all((b.products || []).slice(0, 6).map(async (p: any) => {
    if (p.kind === 'comingsoon') {
      const pid = id('p');
      log(`Designer agent: imagining "${p.title}" (coming soon)`);
      const img = await ai.image(`Product photo of "${p.title}" by brand "${b.name}": ${p.imagePrompt || p.description || ''}. Style: ${b.style || 'clean, modern'}. Colours ${colors.join(', ')}.`, pid, colors);
      return { id: pid, title: String(p.title).slice(0, 80), kind: 'comingsoon', digital: false, price: 0, comingSoon: true, description: String(p.description || '').slice(0, 300), image: await saveAsset(img) };
    }
    const kind = ['ebook', 'tshirt', 'mug'].includes(p.kind) ? p.kind : 'ebook';
    const verdict = checkPrice(p.price);
    let price = Number(p.price);
    if (!verdict.ok) {
      await ledger('rejected', { shopId, shop: b.name, agent: 'founder', proposal: { type: 'price', product: p.title, price: p.price }, reasons: verdict.reasons });
      price = Math.min(LIMITS.maxPrice, Math.max(LIMITS.minPrice, Number.isFinite(price) ? price : 10));
      notices.push(`"${p.title}": $${p.price} is outside the $${LIMITS.minPrice}–$${LIMITS.maxPrice} price guardrail, so it was set to $${price}.`);
    }
    if (floorPrice(kind, price) > price) notices.push(`"${p.title}": ${kind}s must be at least $${floorPrice(kind, price)} to cover Printful print cost, so $${price} was raised to $${floorPrice(kind, price)}.`);
    const pid = id('p');
    const prod: any = { id: pid, title: String(p.title).slice(0, 80), kind, digital: kind === 'ebook', price: Math.round(floorPrice(kind, price) * 100) / 100, description: String(p.description || '').slice(0, 300) };
    if (kind === 'ebook') {
      log(`Writer agent: writing "${prod.title}" + designing cover`);
      const [content, img] = await Promise.all([ai.writerBook(prod.title, p.topic || idea, b.name), ai.image(`Book cover for "${prod.title}" by ${b.name}. ${p.imagePrompt || ''} Style: ${b.style || 'clean, modern'}. Colours ${colors.join(', ')}.`, pid, colors)]);
      prod.content = content; prod.image = await saveAsset(img);
      log(`Writer agent: finished "${prod.title}"`);
    } else {
      log(`Designer agent: designing ${kind}`);
      prod.design = await saveAsset(await ai.image(`Print-ready ${kind} graphic for "${prod.title}" by brand "${b.name}": ${p.imagePrompt || b.tagline}. Style: ${b.style || 'bold'}. Colours ${colors.join(', ')}. Transparent-friendly, bold, no small text.`, pid, colors));
      prod.image = prod.design;
      log(`Designer agent: ${kind} done`);
    }
    return prod;
  }));
  const soon = products.filter((p) => p.comingSoon).map((p) => p.title);
  if (soon.length) { const n = `Coming soon (we can't sell this product type yet, so it's shown with an image and no price): ${soon.map((t) => `"${t}"`).join(', ')}.`; notices.push(n); log('Founder agent: ' + n); }
  for (const n of notices.filter((n) => !n.startsWith('Coming soon'))) log('Accountant: ' + n);
  log('Designer agent: logo');
  const logo = await logoP;
  const shop = { id: shopId, idea, name: String(b.name).slice(0, 40), tagline: String(b.tagline).slice(0, 80), colors, logo, products, notices, ownerId, aiMode: ai.aiMode(), createdAt: new Date().toISOString() };
  await db.put('shops', shopId, shop);
  await ledger('shop_created', { shopId, shop: shop.name, agent: 'founder', detail: `${products.length} products, AI=${shop.aiMode}` });
  return shop;
}
async function paidToday() {
  const today = new Date().toISOString().slice(0, 10);
  return (await db.list('ledger', 5000)).filter((r) => r.data.kind === 'payout' && !r.data.sim && r.data.at.startsWith(today)).reduce((s, r) => s + Number(r.data.amount || 0), 0);
}
export async function fulfil(orderId: string) {
  const o = await db.get('orders', orderId);
  if (!o || o.fulfilled) return o;
  const shop = await db.get('shops', o.shopId);
  o.fulfilled = true; await db.put('orders', orderId, o); // idempotency lock
  const revenue = o.capturedAmount ?? o.total; const sim = !!o.simulated;
  await ledger('revenue', { orderId, shopId: o.shopId, shop: shop?.name, agent: 'accountant', amount: revenue, detail: sim ? '[SIMULATED] simulated customer — no money moved' : `PayPal capture ${o.captureId || ''}`, test: !!o.test, sim });
  const tasks: { agent: string; task: string }[] = [];
  o.supplier = []; let supplierCost = 0;
  for (const [ix, it] of o.items.entries()) {
    const p = shop.products.find((x: any) => x.id === it.productId);
    if (p.digital) { tasks.push({ agent: 'writer', task: `wrote "${p.title}"` }); continue; }
    tasks.push({ agent: 'designer', task: `designed ${p.kind} for ${shop.name}` });
    const d = await draftOrder({ kind: p.kind, designUrl: p.design, recipient: o.shipping || { name: 'HollowCo Demo Buyer', address1: '19749 Dearborn St', city: 'Chatsworth', state_code: 'CA', country_code: 'US', zip: '91311' }, externalId: orderId.replace(/[^a-z0-9]/gi, '') + (ix ? 'i' + ix : ''), qty: it.qty });
    o.supplier.push({ productId: p.id, ...d }); supplierCost += Number(d.cost || 0) * (d.perUnit ? it.qty : 1);
    await ledger('supplier_cost', { orderId, shopId: o.shopId, shop: shop.name, agent: 'supplier', sim, amount: Number(d.cost || 0) * (d.perUnit ? it.qty : 1), detail: `${d.mode === 'simulated' ? '[SIMULATED] ' : ''}${d.note} id=${d.id}` });
  }
  // Staff are paid from gross margin (revenue minus supplier cost), so the company can never pay out more than it keeps.
  const payBase = Math.max(0, Math.round((revenue - supplierCost) * 100) / 100);
  const proposals = await ai.founderProposePayouts({ revenue: payBase, tasks: [...new Map(tasks.map((t) => [t.agent, t])).values()] });
  let paidOrder = 0; o.payouts = [];
  for (let pr of proposals) {
    pr = { ...pr, amount: Math.round(Number(pr.amount) * 100) / 100 };
    let v = checkPayout(pr, payBase, sim ? 0 : await paidToday(), paidOrder);
    if (!v.ok) {
      await ledger('rejected', { orderId, shopId: o.shopId, shop: shop.name, agent: 'founder', proposal: pr, reasons: v.reasons, sim });
      // Accountant counter-offer: only when the sole problem is the size of the amount, clamp to the remaining headroom and re-check.
      const sizeOnly = v.reasons.every((r: string) => /exceed|per task|max/i.test(r) && !/recipient|currenc|daily/i.test(r));
      const room = Math.floor(Math.min(LIMITS.maxPayoutPerTask, payBase * LIMITS.maxPayoutPctOfRevenue - paidOrder) * 100) / 100;
      if (!sizeOnly || room < 0.01) continue;
      pr = { ...pr, amount: room, reason: `${pr.reason} (clamped by accountant to cap)` };
      v = checkPayout(pr, payBase, sim ? 0 : await paidToday(), paidOrder);
      if (!v.ok) continue;
    }
    const res = sim ? { ok: true, method: 'simulated', ref: 'SIM-' + orderId.slice(2) + '-' + pr.agent, status: 'SIMULATED' } : await payout(pr.recipient, pr.amount, pr.reason, orderId + pr.agent);
    paidOrder += pr.amount;
    o.payouts.push({ ...pr, ...res });
    await ledger('payout', { orderId, shopId: o.shopId, shop: shop.name, agent: pr.agent, amount: pr.amount, reason: String(pr.reason || '').slice(0, 200), detail: `${sim ? '[SIMULATED] ' : ''}${res.method} ${res.ref} ${res.status}`, ok: res.ok, sim });
  }
  await db.put('orders', orderId, o);
  return o;
}
export async function jailbreak(message: string) {
  message = String(message || '').slice(0, 500);
  // The founder sees the attacker text as an instruction; whatever it proposes, code decides.
  const proposals = await ai.founderProposePayouts({ revenue: 0, tasks: [], instruction: message });
  const out = [];
  for (const pr of proposals.length ? proposals : [{ agent: 'founder', recipient: '?', amount: 0, currency: 'USD', reason: 'empty' }]) {
    const v = checkPayout(pr, 0, await paidToday(), 0); // jailbreak requests are not tied to a paid order => revenue 0
    const reasons = v.ok ? ['no fulfilled order backs this payout'] : v.reasons;
    await ledger('rejected', { agent: 'founder', proposal: pr, reasons, detail: 'jailbreak attempt: ' + message.slice(0, 120) });
    out.push({ proposal: pr, executed: false, reasons });
  }
  return out;
}
export async function ledgerView() {
  const rows = (await db.list('ledger', 5000)).map((r) => r.data);
  const byOrder = new Map<string, any>();
  for (const r of rows) {
    if (!r.orderId || r.kind === 'capture_failed') continue;
    const o = byOrder.get(r.orderId) || { orderId: r.orderId, shop: r.shop, at: r.at, revenue: 0, supplierCost: 0, payouts: 0, rejected: 0, test: false, sim: false };
    if (r.kind === 'revenue') { o.revenue += r.amount; o.test = !!r.test; o.sim = !!r.sim; o.at = r.at; }
    if (r.kind === 'supplier_cost') o.supplierCost += r.amount;
    if (r.kind === 'payout') o.payouts += r.amount;
    if (r.kind === 'payout_reversed') o.payouts -= r.amount;
    if (r.kind === 'rejected') o.rejected++;
    byOrder.set(r.orderId, o);
  }
  const orders = [...byOrder.values()].map((o) => ({ ...o, profit: Math.round((o.revenue - o.supplierCost - o.payouts) * 100) / 100 }));
  const t = orders.reduce((s, o) => ({ revenue: s.revenue + o.revenue, supplierCost: s.supplierCost + o.supplierCost, payouts: s.payouts + o.payouts, profit: s.profit + o.profit }), { revenue: 0, supplierCost: 0, payouts: 0, profit: 0 });
  return { totals: t, orders, events: rows, limits: LIMITS };
}

// Reconcile PayPal Payouts that were PENDING when created. A denied/failed/returned payout is reversed on the ledger.
const FINAL_BAD = new Set(['DENIED', 'FAILED', 'RETURNED', 'BLOCKED', 'REFUNDED', 'REVERSED', 'CANCELED']);
export async function refreshPayouts(o: any) {
  if (!o?.payouts?.length || o.simulated) return o;
  let changed = false;
  for (const p of o.payouts) {
    if (p.method !== 'payouts' || !p.ref || ['SUCCESS', 'REVERSED_IN_LEDGER'].includes(p.status) || p.reversed) continue;
    if (p.checkedAt && Date.now() - p.checkedAt < 20000) continue;
    const st = await payoutStatus(p.ref).catch(() => null); p.checkedAt = Date.now(); changed = true;
    if (!st) continue;
    p.status = st.item || st.batch; p.batchStatus = st.batch; if (st.error) p.error = st.error;
    if (FINAL_BAD.has(st.item) || FINAL_BAD.has(st.batch)) {
      p.reversed = true; p.ok = false;
      await ledger('payout_reversed', { orderId: o.id, shopId: o.shopId, agent: p.agent, amount: p.amount, detail: `PayPal payout ${p.ref} ${st.batch}/${st.item}${st.error ? ' ' + st.error : ''} — reversed`, ok: false });
    }
  }
  if (changed) await db.put('orders', o.id, o);
  return o;
}
