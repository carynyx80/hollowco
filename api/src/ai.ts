import crypto from 'node:crypto';
import { env } from './env.js';
import sharp from 'sharp';
// Provider abstraction: OpenAI or xAI (OpenAI-compatible) if a key is present; otherwise deterministic mock.
type Prov = { name: string; base: string; key: string; chat: string; image: string };
function provider(): Prov | null {
  if (env('OPENAI_API_KEY')) return { name: 'openai', base: 'https://api.openai.com/v1', key: env('OPENAI_API_KEY'), chat: env('OPENAI_MODEL', 'gpt-4o-mini'), image: env('OPENAI_IMAGE_MODEL', 'gpt-image-1') };
  if (env('XAI_API_KEY')) return { name: 'xai', base: 'https://api.x.ai/v1', key: env('XAI_API_KEY'), chat: env('XAI_MODEL', 'grok-3-mini'), image: env('XAI_IMAGE_MODEL', 'grok-2-image') };
  return null;
}
export const aiMode = () => provider()?.name ?? 'mock';
async function chatJSON(system: string, user: string): Promise<any> {
  const p = provider()!;
  const r = await fetch(p.base + '/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: p.chat, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system + '\nReply with JSON only.' }, { role: 'user', content: user }] }) });
  const j: any = await r.json();
  if (!r.ok) throw new Error('LLM error ' + r.status);
  return JSON.parse(j.choices[0].message.content.replace(/^```json|```$/g, ''));
}
async function chatText(system: string, user: string): Promise<string> {
  const p = provider()!;
  const r = await fetch(p.base + '/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: p.chat, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
  const j: any = await r.json();
  if (!r.ok) throw new Error('LLM error ' + r.status);
  return j.choices[0].message.content;
}
export async function image(prompt: string, seed: string, palette: string[]): Promise<{ mime: string; data: Buffer; provider: string }> {
  const p = provider();
  if (p) {
    try {
      const body: any = { model: p.image, prompt, n: 1 };
      if (p.name === 'openai') body.size = '1024x1024'; else body.response_format = 'b64_json';
      const r = await fetch(p.base + '/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j: any = await r.json();
      const d = j.data?.[0];
      if (d?.b64_json) return { mime: 'image/png', data: Buffer.from(d.b64_json, 'base64'), provider: p.name };
      if (d?.url) { const b = await fetch(d.url); return { mime: b.headers.get('content-type') || 'image/png', data: Buffer.from(await b.arrayBuffer()), provider: p.name }; }
    } catch { /* fall through to mock */ }
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
export type Brand = { name: string; tagline: string; colors: string[]; products: { title: string; kind: 'ebook' | 'tshirt' | 'mug'; price: number; description: string; topic: string }[] };
export async function founderBrand(idea: string): Promise<Brand> {
  if (provider()) {
    try {
      const j = await chatJSON('You are the AI founder of a zero-employee company. Given a business idea, create a brand and a launch catalog. JSON shape: {"name":str,"tagline":str (<=60 chars),"colors":[primaryHex,accentHex,backgroundHex],"products":[{"title":str,"kind":"ebook"|"tshirt"|"mug","price":number USD,"description":str,"topic":str}]}. Exactly 2 ebooks, 1 tshirt, 1 mug.', idea);
      if (j?.name && Array.isArray(j.products)) return j;
    } catch { /* mock */ }
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
      { title: `${name} Tee`, kind: 'tshirt', price: 24 + (b[4] % 6), description: 'Soft cotton tee, printed on demand.', topic },
      { title: `${name} Mug`, kind: 'mug', price: 16 + (b[5] % 4), description: '11oz ceramic mug, printed on demand.', topic },
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
  const RECIP = 'sb-vkeld53675758@personal.example.com';
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
