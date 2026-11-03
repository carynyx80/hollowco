// HollowCo founder agent: OpenAI function-calling over PayPal's official Agent Toolkit (@paypal/agent-toolkit/openai).
// The AI proposes tool calls; every call passes through code guardrails (guardTool) before it reaches PayPal.
// Every call — approved or blocked — is written to the public ledger as kind 'agent_tool'.
import { PayPalAgentToolkit } from '@paypal/agent-toolkit/openai';
import { env } from './env.js';
import { LIMITS, checkPayout, type Verdict } from './guardrails.js';
import * as db from './db.js';

export const TOOLKIT_ACTIONS = {
  products: { create: true, list: true, show: true },
  orders: { create: true, get: true },
  invoices: { create: true },
  transactions: { list: true },
};
let kit: PayPalAgentToolkit | null = null;
export function toolkit() {
  if (!kit) kit = new PayPalAgentToolkit({ clientId: env('PAYPAL_CLIENT_ID'), clientSecret: env('PAYPAL_CLIENT_SECRET'),
    configuration: { actions: TOOLKIT_ACTIONS, context: { sandbox: env('PAYPAL_ENV', 'sandbox') !== 'live' } } });
  return kit;
}
export const toolkitToolNames = () => toolkit().getTools().map((t: any) => t.function.name);

// Per-day write-call cap across all toolkit tool calls (in-memory safety net).
const WRITE_TOOLS = new Set(['create_product', 'create_order', 'create_invoice', 'create_payout']);
const DAILY_WRITE_CAP = Number(env('AGENT_TOOL_WRITES_PER_DAY', '400'));
let day = '', writes = 0;

export type Custom = { def: any; run: (args: any) => Promise<any> };
export type Guard = (name: string, args: any) => Verdict | Promise<Verdict>;
export type ToolLog = { tool: string; args: any; decision: 'approved' | 'blocked'; reasons?: string[]; result?: any; via: string };

// Generic guardrails applied to every toolkit call, on top of the task-specific guard.
function baseGuard(name: string, a: any, allow: string[]): Verdict {
  const r: string[] = [];
  if (!allow.includes(name)) r.push(`tool ${name} not allowed for this task`);
  if (name === 'create_order') {
    const items = Array.isArray(a?.items) ? a.items : [];
    const total = items.reduce((s: number, i: any) => s + Number(i.itemTotal ?? Number(i.itemCost) * Number(i.quantity || 1)), 0) + Number(a?.shippingCost || 0);
    if (!items.length) r.push('order has no items');
    if (items.some((i: any) => !(Number(i.itemCost) >= LIMITS.minPrice && Number(i.itemCost) <= LIMITS.maxPrice))) r.push(`item price outside $${LIMITS.minPrice}–$${LIMITS.maxPrice}`);
    if (total > LIMITS.maxPrice * 5) r.push(`order total ${total} exceeds cap ${LIMITS.maxPrice * 5}`);
    if (a?.currencyCode && a.currencyCode !== 'USD') r.push('currency not allowed');
  }
  if (name === 'create_invoice') {
    const to = JSON.stringify(a?.primary_recipients || a?.recipient_email || '').toLowerCase();
    if (!LIMITS.allowedRecipients.some((e) => to.includes(e))) r.push('invoice recipient not allowlisted');
    const amt = (a?.items || []).reduce((s: number, i: any) => s + Number(i?.unit_amount?.value || 0) * Number(i?.quantity || 1), 0);
    if (amt > LIMITS.maxPayoutPerTask) r.push(`invoice amount ${amt} exceeds cap ${LIMITS.maxPayoutPerTask}`);
  }
  if (name === 'create_product' && String(a?.name || '').length > 127) r.push('product name too long');
  const today = new Date().toISOString().slice(0, 10); if (today !== day) { day = today; writes = 0; }
  if (WRITE_TOOLS.has(name) && writes >= DAILY_WRITE_CAP) r.push(`daily agent write-call cap ${DAILY_WRITE_CAP} reached`);
  return r.length ? { ok: false, reasons: r } : { ok: true };
}
const summarize = (a: any) => { const s = JSON.stringify(a ?? {}); return s.length > 300 ? s.slice(0, 297) + '...' : s; };
async function logTool(ctx: any, l: ToolLog) {
  const id = 'l_' + Math.random().toString(16).slice(2, 14);
  const res = typeof l.result === 'string' ? l.result : JSON.stringify(l.result ?? '');
  await db.put('ledger', id, { kind: 'agent_tool', at: new Date().toISOString(), agent: 'founder', ...ctx, tool: l.tool, via: l.via, decision: l.decision, reasons: l.reasons,
    args: summarize(l.args), result: res.slice(0, 300), detail: `AI agent used ${l.via === 'toolkit' ? 'PayPal Agent Toolkit' : 'PayPal Payouts API'}: ${l.tool} ${summarize(l.args).slice(0, 140)} → ${l.decision === 'approved' ? 'APPROVED by code' : 'BLOCKED by code: ' + (l.reasons || []).join('; ')}` });
}

export const payoutTool = (run: (a: any) => Promise<any>): Custom => ({ run, def: { type: 'function', function: { name: 'create_payout',
  description: 'Send a PayPal Payout (Payouts API v1) to a staff agent for completed work. Subject to code-enforced guardrails.',
  parameters: { type: 'object', additionalProperties: false, required: ['agent', 'recipient', 'amount', 'currency', 'reason'], properties: {
    agent: { type: 'string' }, recipient: { type: 'string', description: 'recipient PayPal email' }, amount: { type: 'number' }, currency: { type: 'string' }, reason: { type: 'string' } } } } } });

/** Run the founder via OpenAI tool calling. Returns the log of every proposed tool call. */
export async function runAgent(o: { system: string; user: string; allow: string[]; custom?: Record<string, Custom>; guard?: Guard; ctx?: any; maxSteps?: number; toolChoice?: 'auto' | 'required' }): Promise<ToolLog[]> {
  const key = env('OPENAI_API_KEY'); if (!key) throw new Error('no LLM key');
  const kitTools = toolkit().getTools().filter((t: any) => o.allow.includes(t.function.name));
  const tools = [...kitTools, ...Object.values(o.custom || {}).map((c) => c.def)];
  const messages: any[] = [{ role: 'system', content: o.system }, { role: 'user', content: o.user }];
  const out: ToolLog[] = [];
  for (let step = 0; step < (o.maxSteps || 4); step++) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env('OPENAI_AGENT_MODEL', env('OPENAI_MODEL', 'gpt-4o-mini')), messages, tools, tool_choice: step === 0 ? (o.toolChoice || 'auto') : 'auto', parallel_tool_calls: true }) });
    const j: any = await r.json(); if (!r.ok) throw new Error('LLM error ' + r.status + ' ' + (j?.error?.message || ''));
    const msg = j.choices[0].message; messages.push(msg);
    if (!msg.tool_calls?.length) break;
    for (const tc of msg.tool_calls) {
      const name = tc.function.name; let args: any = {}; try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* bad json */ }
      const via = o.custom?.[name] ? 'payouts-api' : 'toolkit';
      let v = baseGuard(name, args, o.allow.concat(Object.keys(o.custom || {})));
      if (v.ok && o.guard) v = await o.guard(name, args);
      if (!v.ok) { const l: ToolLog = { tool: name, args, decision: 'blocked', reasons: v.reasons, via }; out.push(l); await logTool(o.ctx, l);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: 'BLOCKED by HollowCo guardrails: ' + v.reasons.join('; ') }); continue; }
      if (WRITE_TOOLS.has(name)) writes++;
      let result: any;
      try { result = via === 'toolkit' ? (await toolkit().handleToolCall(tc)).content : await o.custom![name].run(args); }
      catch (e: any) { result = 'error: ' + e.message; }
      const l: ToolLog = { tool: name, args, decision: 'approved', result, via }; out.push(l); await logTool(o.ctx, l);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: typeof result === 'string' ? result.slice(0, 4000) : JSON.stringify(result).slice(0, 4000) });
    }
  }
  return out;
}
export { checkPayout };
