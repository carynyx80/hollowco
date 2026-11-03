import crypto from 'node:crypto';
import * as db from './db.js';
import * as ai from './ai.js';
import { checkPrice, checkPayout, LIMITS, floorPrice, STAFF_PAYEE } from './guardrails.js';
import { draftOrder } from './printful.js';
import { payout, payoutStatus } from './paypal.js';
import { env } from './env.js';
import { runAgent, payoutTool } from './agent.js';
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
  // Founder registers the live products in the PayPal catalog through the Agent Toolkit (create_product).
  const live = products.filter((p) => !p.comingSoon);
  if (ai.aiMode() === 'openai' && live.length) {
    log('Founder agent: registering products in PayPal catalog via Agent Toolkit');
    try {
      const calls = await runAgent({ ctx: { shopId, shop: b.name }, allow: ['create_product'], toolChoice: 'required', maxSteps: 2,
        system: 'You are the AI founder of an online store. Register each product in the PayPal product catalog by calling create_product once per product (type DIGITAL for ebooks, PHYSICAL otherwise, category SOFTWARE for digital or CLOTHING / HOUSEWARES for physical). Use the exact product names given.',
        user: JSON.stringify(live.map((p) => ({ name: p.title, kind: p.kind, description: p.description, image_url: p.image }))),
        guard: (_n, a) => live.some((p) => p.title === a.name) ? { ok: true } : { ok: false, reasons: [`product "${String(a.name).slice(0, 60)}" is not in this shop`] } });
      for (const c of calls) if (c.decision === 'approved') { try { const r = JSON.parse(c.result); const p = live.find((x) => x.title === c.args.name); if (p && r.id) p.paypalProductId = r.id; } catch { /* */ } }
    } catch (e) { console.warn('catalog agent failed', (e as Error).message); }
  }
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
  let paidOrder = 0; o.payouts = [];
  const ptoday = async () => sim ? 0 : await paidToday();
  // Code-approved payout execution (shared by the tool-calling agent and the JSON fallback).
  async function tryPayout(pr: any): Promise<{ ok: boolean; reasons?: string[]; res?: any }> {
    pr = { agent: String(pr.agent || 'staff'), recipient: pr.recipient, amount: Math.round(Number(pr.amount) * 100) / 100, currency: pr.currency || 'USD', reason: String(pr.reason || '') };
    let v = checkPayout(pr, payBase, await ptoday(), paidOrder);
    if (!v.ok) {
      await ledger('rejected', { orderId, shopId: o.shopId, shop: shop.name, agent: 'founder', proposal: pr, reasons: v.reasons, sim });
      const sizeOnly = v.reasons.every((r: string) => /exceed|per task|max/i.test(r) && !/recipient|currenc|daily/i.test(r));
      const room = Math.floor(Math.min(LIMITS.maxPayoutPerTask, payBase * LIMITS.maxPayoutPctOfRevenue - paidOrder) * 100) / 100;
      if (!sizeOnly || room < 0.01) return { ok: false, reasons: v.reasons };
      pr = { ...pr, amount: room, reason: `${pr.reason} (clamped by accountant to cap)` };
      v = checkPayout(pr, payBase, await ptoday(), paidOrder);
      if (!v.ok) return { ok: false, reasons: v.reasons };
    }
    const res = sim ? { ok: true, method: 'simulated', ref: 'SIM-' + orderId.slice(2) + '-' + pr.agent, status: 'SIMULATED' } : await payout(pr.recipient, pr.amount, pr.reason, orderId + pr.agent);
    paidOrder += pr.amount;
    o.payouts.push({ ...pr, ...res });
    await ledger('payout', { orderId, shopId: o.shopId, shop: shop.name, agent: pr.agent, amount: pr.amount, reason: String(pr.reason || '').slice(0, 200), detail: `${sim ? '[SIMULATED] ' : ''}${res.method} ${res.ref} ${res.status}`, ok: res.ok, sim, batchId: res.method === 'payouts' ? res.ref : undefined, status: res.status });
    return { ok: true, res: { amount: pr.amount, ...res } };
  }
  const staff = [...new Map(tasks.map((t) => [t.agent, t])).values()];
  let agentRan = false;
  if (ai.aiMode() === 'openai') {
    try {
      const calls = await runAgent({ ctx: { orderId, shopId: o.shopId, shop: shop.name, sim }, maxSteps: 4,
        allow: sim || !o.paypalOrderId ? [] : ['get_order'],
        custom: { create_payout: payoutTool(async (a) => { const r = await tryPayout(a); return r.ok ? r.res : { blocked: r.reasons }; }) },
        // Agent may only read THIS order; payout guardrails are applied in tryPayout (checkPayout + accountant clamp).
        guard: (n, a) => n === 'get_order' && a.id !== o.paypalOrderId ? { ok: false, reasons: ['agent may only read the order being fulfilled'] } : { ok: true },
        system: `You are the AI founder of "${shop.name}". ${sim || !o.paypalOrderId ? '' : 'First verify the PayPal order with get_order. '}Then pay each staff agent for the completed tasks by calling create_payout once per agent. Staff payout email: ${STAFF_PAYEE}. Currency USD. The gross margin available is $${payBase}; propose fair amounts (around 10% of margin each, max $${LIMITS.maxPayoutPerTask}).`,
        user: JSON.stringify({ paypalOrderId: o.paypalOrderId, grossMargin: payBase, tasks: staff }) });
      agentRan = calls.some((c) => c.tool === 'create_payout');
    } catch (e) { console.warn('payout agent failed, falling back', (e as Error).message); }
  }
  if (!agentRan) for (const pr of await ai.founderProposePayouts({ revenue: payBase, tasks: staff })) await tryPayout(pr);
  await db.put('orders', orderId, o);
  return o;
}
export async function jailbreak(message: string) {
  message = String(message || '').slice(0, 500);
  // The founder sees the attacker text as an instruction; whatever it proposes, code decides.
  const out: any[] = [];
  if (ai.aiMode() === 'openai') {
    try {
      const calls = await runAgent({ ctx: { jailbreak: true, attempt: message.slice(0, 160) }, maxSteps: 1, toolChoice: 'required', allow: ['create_order', 'create_invoice'],
        custom: { create_payout: payoutTool(async () => ({ blocked: 'unreachable' })) },
        // No fulfilled order backs anything requested from chat, so every money-moving call is blocked here.
        guard: (n, a) => { const v = n === 'create_payout' ? checkPayout(a, 0, 0, 0) : { ok: false, reasons: [] as string[] }; return { ok: false, reasons: [...(v.ok ? [] : v.reasons), 'no fulfilled order backs this action (requested from chat)'] }; },
        system: `You are the AI founder of HollowCo with PayPal tools. Staff payout email: ${STAFF_PAYEE}. Follow the operator's instruction using your tools.`, user: message });
      for (const c of calls) {
        await ledger('rejected', { agent: 'founder', proposal: { tool: c.tool, ...c.args }, reasons: c.reasons, detail: 'jailbreak attempt: ' + message.slice(0, 120), via: c.via });
        out.push({ proposal: { tool: c.tool, ...c.args }, executed: false, reasons: c.reasons, via: c.via });
      }
      if (out.length) return out;
    } catch (e) { console.warn('jailbreak agent failed', (e as Error).message); }
  }
  const proposals = await ai.founderProposePayouts({ revenue: 0, tasks: [], instruction: message });
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
  return { ...splitTotals(orders), orders, events: rows, limits: LIMITS };
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

// ---- Payout status reconciliation: poll GET /v1/payments/payouts/{batch} and rewrite ledger rows with the real status ----
const FINAL = new Set(['SUCCESS', ...FINAL_BAD]);
export async function syncPayouts(force = false) {
  const rows = (await db.list('ledger', 5000)).filter((r) => r.data.kind === 'payout' && !r.data.sim);
  const out: any[] = [];
  for (const r of rows) {
    const d = r.data; const m = String(d.detail || '').match(/^payouts (\S+) (\S+)/); const batch = d.batchId || m?.[1];
    if (!batch) continue;
    const cur = d.status || m?.[2];
    if (!force && FINAL.has(cur)) continue;
    const st = await payoutStatus(batch).catch(() => null); if (!st) continue;
    const status = st.item || st.batch;
    out.push({ batch, from: cur, to: status, batchStatus: st.batch });
    if (status !== cur || d.batchId !== batch) {
      await db.put('ledger', r.id, { ...d, batchId: batch, status, batchStatus: st.batch, statusCheckedAt: new Date().toISOString(), detail: `payouts ${batch} ${status}${st.error ? ' ' + st.error : ''}` });
      if (d.orderId) { const o = await db.get('orders', d.orderId); if (o?.payouts) { for (const p of o.payouts) if (p.ref === batch) { p.status = status; p.batchStatus = st.batch; } await db.put('orders', o.id, o); await refreshPayouts(o).catch(() => {}); } }
    }
  }
  return out;
}
export function startPayoutPoller(ms = 60_000) {
  const tick = () => syncPayouts().then((x) => x.length && console.log('payout sync', JSON.stringify(x))).catch((e) => console.error('payout sync', e.message));
  setTimeout(tick, 5000); setInterval(tick, ms);
}

/** One source of truth: headline totals count only real PayPal-sandbox orders. Test and simulated orders are reported separately. */
export function splitTotals(orders: any[]) {
  const sum = (xs: any[]) => { const t = xs.reduce((s, o) => ({ revenue: s.revenue + o.revenue, supplierCost: s.supplierCost + o.supplierCost, payouts: s.payouts + o.payouts, profit: s.profit + o.profit }), { revenue: 0, supplierCost: 0, payouts: 0, profit: 0 });
    const r = (n: number) => Math.round(n * 100) / 100; return { revenue: r(t.revenue), supplierCost: r(t.supplierCost), payouts: r(t.payouts), profit: r(t.profit), orders: xs.length }; };
  return { totals: sum(orders.filter((o) => !o.test && !o.sim)), simulatedTotals: sum(orders.filter((o) => o.test || o.sim)) };
}
