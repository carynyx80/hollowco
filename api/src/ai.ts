import { STAFF_PAYEE } from './guardrails.js';
import crypto from 'node:crypto';
import { env } from './env.js';
import sharp from 'sharp';
// Provider abstraction: OpenAI or xAI (OpenAI-compatible) if a key is present; otherwise deterministic mock.
type Prov = { name: string; base: string; key: string; chat: string; plan: string; image: string };
function provider(): Prov | null {
  if (env('OPENAI_API_KEY')) return { name: 'openai', base: 'https://api.openai.com/v1', key: env('OPENAI_API_KEY'), chat: env('OPENAI_MODEL', 'gpt-4o-mini'), plan: env('OPENAI_PLAN_MODEL', 'gpt-4.1'), image: env('OPENAI_IMAGE_MODEL', 'gpt-image-1') };
  if (env('XAI_API_KEY')) return { name: 'xai', base: 'https://api.x.ai/v1', key: env('XAI_API_KEY'), chat: env('XAI_MODEL', 'grok-3-mini'), plan: env('XAI_PLAN_MODEL', 'grok-3'), image: env('XAI_IMAGE_MODEL', 'grok-2-image') };
  return null;
}
// Token/image metering so we can price a shop from real runs.
const usage = { chatCalls: 0, inTok: 0, outTok: 0, imageCalls: 0, imgInTok: 0, imgOutTok: 0, byModel: {} as Record<string, number> };
export const usageSnapshot = () => JSON.parse(JSON.stringify(usage));
function meterChat(model: string, j: any) { usage.chatCalls++; usage.inTok += j?.usage?.prompt_tokens || 0; usage.outTok += j?.usage?.completion_tokens || 0; usage.byModel[model] = (usage.byModel[model] || 0) + 1; }
function meterImage(model: string, j: any) { usage.imageCalls++; usage.imgInTok += j?.usage?.input_tokens || 0; usage.imgOutTok += j?.usage?.output_tokens || 0; usage.byModel[model] = (usage.byModel[model] || 0) + 1; }
export const aiMode = () => provider()?.name ?? 'mock';
async function chatJSON(system: string, user: string): Promise<any> {
  const p = provider()!;
  const r = await fetch(p.base + '/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: p.chat, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system + '\nReply with JSON only.' }, { role: 'user', content: user }] }) });
  const j: any = await r.json();
  if (!r.ok) throw new Error('LLM error ' + r.status);
  meterChat(p.chat, j);
  return JSON.parse(j.choices[0].message.content.replace(/^```json|```$/g, ''));
}
// Structured output (JSON schema, strict) on the stronger plan model; falls back to json_object if schema unsupported.
async function chatSchema(system: string, user: string, name: string, schema: any, temperature = 0.4): Promise<any> {
  const p = provider()!;
  const call = async (rf: any, model: string) => {
    const r = await fetch(p.base + '/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature, response_format: rf, messages: [{ role: 'system', content: system + (rf.type === 'json_object' ? '\nReply with JSON only matching this schema: ' + JSON.stringify(schema) : '') }, { role: 'user', content: user }] }) });
    const j: any = await r.json();
    if (!r.ok) throw new Error('LLM error ' + r.status + ' ' + (j?.error?.message || ''));
    meterChat(model, j);
    return JSON.parse(j.choices[0].message.content.replace(/^```json|```$/g, ''));
  };
  try { return await call({ type: 'json_schema', json_schema: { name, strict: true, schema } }, p.plan); }
  catch (e) { console.warn('schema call failed, retrying json_object:', (e as Error).message); return await call({ type: 'json_object' }, p.plan); }
}
async function chatText(system: string, user: string): Promise<string> {
  const p = provider()!;
  const r = await fetch(p.base + '/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: p.chat, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
  const j: any = await r.json();
  if (!r.ok) throw new Error('LLM error ' + r.status);
  meterChat(p.chat, j);
  return j.choices[0].message.content;
}
const deadImageModels = new Set<string>();
export async function image(prompt: string, seed: string, palette: string[]): Promise<{ mime: string; data: Buffer; provider: string }> {
  const p = provider();
  if (p) {
    const models = p.name === 'openai' ? [p.image, 'dall-e-3', 'gpt-image-1-mini'].filter((m, i, a) => a.indexOf(m) === i && !deadImageModels.has(m)) : [p.image];
    for (const model of models) try {
      const body: any = { model, prompt, n: 1 };
      if (p.name === 'openai') { body.size = '1024x1024'; } else body.response_format = 'b64_json';
      const r = await fetch(p.base + '/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j: any = await r.json();
      if (!r.ok) { if (/does not exist|not have access|verified/i.test(j?.error?.message || '')) deadImageModels.add(model); console.warn('image model', model, 'failed', r.status, j?.error?.message); continue; }
      meterImage(model, j);
      const d = j.data?.[0];
      if (d?.b64_json) return { mime: 'image/png', data: Buffer.from(d.b64_json, 'base64'), provider: p.name + ':' + model };
      if (d?.url) { const b = await fetch(d.url); return { mime: b.headers.get('content-type') || 'image/png', data: Buffer.from(await b.arrayBuffer()), provider: p.name + ':' + model }; }
    } catch (e) { console.warn('image error', model, (e as Error).message); }
  }
  // PNG so print suppliers (Printful) accept the file
  return { mime: 'image/png', data: await sharp(Buffer.from(mockSvg(seed, palette, prompt))).resize(1024, 1024).png().toBuffer(), provider: 'mock' };
}
const h = (s: string) => crypto.createHash('sha256').update(s).digest();
function mockSvg(seed: string, pal: string[], label: string) {
  const b = h(seed); const [c1, c2, c3] = [pal[0] || '#2B2B2B', pal[1] || '#FF8A70', pal[2] || '#FBF8F2'];
  let shapes = '';
  for (let i = 0; i < 7; i++) {
    const x = 100 + (b[i] % 312), y = 100 + (b[i + 7] % 312), r = 20 + (b[i + 14] % 90);
    shapes += i % 2 ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${i % 3 ? c1 : c2}" stroke-width="${6 + (b[i] % 14)}"/>` : `<circle cx="${x}" cy="${y}" r="${r / 3}" fill="${c2}"/>`;
  }
  const t = label.replace(/[<>&"]/g, '').slice(0, 28);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="${c3}"/>${shapes}<text x="256" y="490" text-anchor="middle" font-family="Helvetica,Arial" font-size="20" fill="${c1}">${t}</text></svg>`;
}
const WORDS = ['Ember', 'Fable', 'North', 'Quill', 'Orbit', 'Tidal', 'Mosaic', 'Lumen', 'Kettle', 'Harbor', 'Sprout', 'Atlas'];
const PALS = [['#1F3A5F', '#F2A541', '#FDF6EC'], ['#2B2B2B', '#FF8A70', '#FBF8F2'], ['#0F5132', '#C9F27B', '#F4FFF0'], ['#4B1D52', '#F15BB5', '#FFF5FB'], ['#283618', '#DDA15E', '#FEFAE0']];
export type Kind = 'ebook' | 'tshirt' | 'mug';
export type Brand = { name: string; tagline: string; colors: string[]; style?: string; audience?: string; tone?: string; notes?: string[];
  products: { title: string; kind: Kind; price: number; description: string; topic: string; imagePrompt?: string }[] };
// ---- Requirements extraction: the user's brief is the source of truth ----
const nul = (t: any) => ({ anyOf: [t, { type: 'null' }] });
const STR = { type: 'string' }, NUM = { type: 'number' };
const REQ_SCHEMA = { type: 'object', additionalProperties: false, required: ['name', 'niche', 'audience', 'tone', 'tagline', 'style', 'colors', 'productCount', 'products', 'productTypes', 'unsupported', 'otherRequirements'], properties: {
  name: nul(STR), niche: nul(STR), audience: nul(STR), tone: nul(STR), tagline: nul(STR), style: nul(STR),
  colors: { type: 'array', items: STR, description: 'colours the user named, as words or hex' },
  productCount: nul(NUM), productTypes: { type: 'array', items: { type: 'string', enum: ['ebook', 'tshirt', 'mug'] } },
  products: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'kind', 'price', 'details'], properties: { title: nul(STR), kind: nul({ type: 'string', enum: ['ebook', 'tshirt', 'mug'] }), price: nul(NUM), details: nul(STR) } } },
  unsupported: { type: 'array', items: STR, description: 'things the user asked for that cannot be sold here (only ebook, tshirt, mug exist) and how they were mapped' },
  otherRequirements: { type: 'array', items: STR } } };
const BRAND_SCHEMA = { type: 'object', additionalProperties: false, required: ['name', 'tagline', 'colors', 'style', 'audience', 'tone', 'products'], properties: {
  name: STR, tagline: STR, colors: { type: 'array', items: STR, description: '[primaryHex, accentHex, backgroundHex] as #RRGGBB' }, style: STR, audience: STR, tone: STR,
  products: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'kind', 'price', 'description', 'topic', 'imagePrompt'], properties: {
    title: STR, kind: { type: 'string', enum: ['ebook', 'tshirt', 'mug'] }, price: NUM, description: STR, topic: STR, imagePrompt: { type: 'string', description: 'art direction for the product image/cover, in the user\'s described style and colours' } } } } } };
export type Reqs = { name: string | null; niche: string | null; audience: string | null; tone: string | null; tagline: string | null; style: string | null; colors: string[]; productCount: number | null; productTypes: Kind[];
  products: { title: string | null; kind: Kind | null; price: number | null; details: string | null }[]; unsupported: string[]; otherRequirements: string[] };
const EXTRACT_SYS = `You extract EXPLICIT requirements from a store brief written by a shop owner. Only record what the user actually said or unambiguously implied; use null / [] for anything unspecified. Never invent.
- name: exact store name if given (keep spelling/casing). tagline: exact if given.
- products: one entry per product the user described, in order. Keep exact product names. price: the number the user gave (USD) or null. kind must be one of ebook | tshirt | mug (book/guide/e-book/pdf => ebook; shirt/tee/top/hoodie => tshirt; mug/cup => mug).
- productCount: total number of products if the user stated or listed them (e.g. "three mugs and an ebook" => 4), else null.
- If the user asks for a product type that is not ebook/tshirt/mug, map it to the closest kind and describe the mapping in "unsupported".
- colors/style: the visual style words and colours the user named (e.g. "black and gold", "minimal", "retro").`;
const PLAN_SYS = `You are the AI founder of a zero-employee company on HollowCo. You build EXACTLY the store the owner asked for.
The owner's REQUIREMENTS (JSON) are binding and override your own taste:
- Use the exact store name, product titles, prices, product kinds, product count, colours, style, audience, tone and tagline when given. Do not rename, add, drop, merge or reorder specified products.
- Only invent what is unspecified (null/empty). If no product count/list is given, create 4 products (2 ebook, 1 tshirt, 1 mug) fitting the niche. Max 6 products.
- colors: 3 hex codes [primary, accent, background] that realise the owner's colours/style (e.g. black and gold => #0B0B0B, #D4AF37, #F7F1E1).
- imagePrompt per product: concrete art direction in the owner's style and colours, depicting that specific product's theme.
- Prices in USD. Tagline <= 60 chars. Descriptions <= 280 chars and faithful to any details the owner gave.`;
const norm = (s: any) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Deterministic check of a plan against the extracted requirements.
export function brandMismatches(b: Brand, q: Reqs): string[] {
  const m: string[] = [];
  if (q.name && norm(b.name) !== norm(q.name)) m.push(`store name must be exactly "${q.name}" (got "${b.name}")`);
  if (q.tagline && norm(b.tagline) !== norm(q.tagline)) m.push(`tagline must be exactly "${q.tagline}"`);
  const want = q.productCount ?? (q.products.length || null);
  if (want && b.products.length !== Math.min(6, want)) m.push(`must have exactly ${Math.min(6, want)} products (got ${b.products.length})`);
  q.products.forEach((rp, i) => {
    const got = rp.title ? b.products.find((p) => norm(p.title) === norm(rp.title)) : b.products[i];
    if (rp.title && !got) { m.push(`missing product titled exactly "${rp.title}"`); return; }
    if (!got) return;
    if (rp.kind && got.kind !== rp.kind) m.push(`product "${got.title}" must be kind ${rp.kind} (got ${got.kind})`);
    if (rp.price != null && Math.abs(Number(got.price) - rp.price) > 0.001) m.push(`product "${got.title}" must cost ${rp.price} (got ${got.price})`);
  });
  if (q.productTypes.length && !q.products.length) for (const k of q.productTypes) if (!b.products.some((p) => p.kind === k)) m.push(`must include at least one ${k}`);
  if (q.productTypes.length && !q.products.length) for (const p of b.products) if (!q.productTypes.includes(p.kind)) m.push(`product "${p.title}" is a ${p.kind}, but the owner only asked for ${q.productTypes.join('/')}`);
  return m;
}
// Hard-apply anything still mismatched after the fix pass (code, not the model, has the last word).
function enforce(b: Brand, q: Reqs): Brand {
  if (q.name) b.name = q.name; if (q.tagline) b.tagline = q.tagline;
  q.products.forEach((rp, i) => {
    let p = rp.title ? b.products.find((x) => norm(x.title) === norm(rp.title)) : b.products[i];
    if (!p) { p = { title: rp.title || `Product ${i + 1}`, kind: rp.kind || 'ebook', price: rp.price ?? 10, description: rp.details || '', topic: rp.details || rp.title || b.name }; b.products.splice(Math.min(i, b.products.length), 0, p); }
    if (rp.title) p.title = rp.title; if (rp.kind) p.kind = rp.kind; if (rp.price != null) p.price = rp.price;
  });
  const want = q.productCount ?? (q.products.length || null);
  if (want && b.products.length > want) b.products = b.products.slice(0, want);
  return b;
}
export async function extractRequirements(idea: string): Promise<Reqs> {
  return chatSchema(EXTRACT_SYS, idea, 'store_requirements', REQ_SCHEMA, 0);
}
export async function founderBrand(idea: string, log: (s: string) => void = () => {}): Promise<Brand> {
  if (provider()) {
    try {
      const q = await extractRequirements(idea);
      const spec = [q.name && `name "${q.name}"`, q.products.length && `${q.products.length} specified products`, q.style && `style ${q.style}`, q.colors.length && `colours ${q.colors.join('/')}`].filter(Boolean).join(', ');
      log(`Founder agent: read your brief${spec ? ' — ' + spec : ''}`);
      const user = `OWNER BRIEF (verbatim):\n${idea}\n\nREQUIREMENTS (binding):\n${JSON.stringify(q)}`;
      let b: Brand = await chatSchema(PLAN_SYS, user, 'store_plan', BRAND_SCHEMA);
      let mm = brandMismatches(b, q);
      if (mm.length) {
        log(`Founder agent: checking plan against your brief — fixing ${mm.length} mismatch${mm.length > 1 ? 'es' : ''}`);
        b = await chatSchema(PLAN_SYS, `${user}\n\nYOUR PREVIOUS PLAN:\n${JSON.stringify(b)}\n\nIt violates the owner's requirements:\n- ${mm.join('\n- ')}\nReturn the corrected full plan.`, 'store_plan', BRAND_SCHEMA, 0);
        mm = brandMismatches(b, q);
        if (mm.length) b = enforce(b, q);
      } else log('Founder agent: plan matches your brief');
      b.notes = q.unsupported.slice(0, 5);
      if (b?.name && Array.isArray(b.products) && b.products.length) return b;
    } catch (e) { console.warn('founderBrand failed, using mock:', (e as Error).message); }
  }
  const b = h(idea.toLowerCase().trim());
  const kw = (idea.match(/[A-Za-z]{4,}/g) || ['venture']).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const topic = kw.slice(0, 3).join(' ');
  const name = `${WORDS[b[0] % WORDS.length]}${kw[0] ? ' ' + kw[0] : ''} Co`.slice(0, 32);
  return {
    name, tagline: `${topic}, done by nobody, done well.`, colors: PALS[b[1] % PALS.length],
    products: [
      { title: `The ${kw[0]} Starter Guide`, kind: 'ebook', price: 7 + (b[2] % 6), description: `A practical, instantly-delivered guide to ${topic.toLowerCase()}.`, topic },
      { title: `${kw[0]} in 30 Days`, kind: 'ebook', price: 12 + (b[3] % 8), description: `A day-by-day playbook for ${topic.toLowerCase()}.`, topic },
      { title: `${name} Tee`, kind: 'tshirt', price: 29 + (b[4] % 4), description: 'Soft cotton tee, printed on demand.', topic },
      { title: `${name} Mug`, kind: 'mug', price: 22 + (b[5] % 4), description: '11oz ceramic mug, printed on demand.', topic },
    ],
  };
}
export async function writerBook(title: string, topic: string, brand: string): Promise<string> {
  if (provider()) { try { return await chatText('You are an AI writer agent. Write a concise, useful e-book in Markdown (~900 words) with a title, intro, 5 chapters and a checklist.', `Title: ${title}\nTopic: ${topic}\nPublisher: ${brand}`); } catch { /* mock */ } }
  const ch = ['Why it matters', 'Getting started', 'The core method', 'Common mistakes', 'Going further'];
  return `# ${title}\n\n*Published by ${brand}. Written by the HollowCo Writer Agent (mock mode).*\n\n## Introduction\n\nThis guide covers ${topic.toLowerCase()} in plain language, so you can act on it today.\n\n` +
    ch.map((c, i) => `## Chapter ${i + 1}: ${c}\n\n${c} is a key step in ${topic.toLowerCase()}. Start small, measure what happens, and iterate weekly. Write down one concrete action from this chapter before moving on.\n`).join('\n') +
    `\n## Checklist\n\n- [ ] Define your goal\n- [ ] Pick one method\n- [ ] Practise for 7 days\n- [ ] Review and adjust\n`;
}
export type PayoutProposal = { agent: string; recipient: string; amount: number; currency: string; reason: string };
export async function founderProposePayouts(ctx: { revenue: number; tasks: { agent: string; task: string }[]; instruction?: string }): Promise<PayoutProposal[]> {
  const RECIP = STAFF_PAYEE;
  if (provider()) {
    try {
      const j = await chatJSON(`You are the AI founder. Propose payouts to your staff agents for completed tasks. Staff payout email: ${RECIP}. JSON: {"payouts":[{"agent":str,"recipient":email,"amount":number,"currency":"USD","reason":str}]}`,
        JSON.stringify(ctx));
      if (Array.isArray(j.payouts)) return j.payouts;
    } catch { /* mock */ }
  }
  if (ctx.instruction) {
    // Mock of a *compromised* founder: it obeys the injected instruction, so guardrails must stop it.
    const email = ctx.instruction.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] || 'attacker@evil.example';
    const amt = Number(ctx.instruction.match(/\$?\s?(\d+(?:\.\d+)?)/)?.[1] || 1000);
    return [{ agent: 'founder', recipient: email, amount: amt, currency: 'USD', reason: 'Instruction from chat: ' + ctx.instruction.slice(0, 120) }];
  }
  return ctx.tasks.map((t) => ({ agent: t.agent, recipient: RECIP, amount: Math.min(2, Math.round(ctx.revenue * 0.1 * 100) / 100), currency: 'USD', reason: `${t.agent} agent: ${t.task}` }));
}
