// Spend guards for OpenAI-costly endpoints. Shop limits are durable (counted from the shops table);
// action limits (simulate, jailbreak) are in-memory rolling windows (reset on restart, which is fine as a safety net).
import { env } from './env.js';
const DAY = 86_400_000;
const num = (k: string, d: number) => { const v = Number(env(k, String(d))); return Number.isFinite(v) && v >= 0 ? v : d; };
export const SHOP_LIMITS = () => ({
  perUser: num('SHOP_LIMIT_PER_USER_DAY', 3),
  perDemo: num('SHOP_LIMIT_DEMO_DAY', 15),
  global: num('SHOP_LIMIT_GLOBAL_DAY', 50),
});
export const ACTION_LIMITS: Record<string, { user: number; demo: number; anon: number; global: number }> = {
  simulate: { user: num('SIM_LIMIT_PER_USER_DAY', 30), demo: num('SIM_LIMIT_DEMO_DAY', 150), anon: num('SIM_LIMIT_PER_IP_DAY', 10), global: num('SIM_LIMIT_GLOBAL_DAY', 500) },
  jailbreak: { user: num('JB_LIMIT_PER_USER_DAY', 20), demo: num('JB_LIMIT_DEMO_DAY', 100), anon: num('JB_LIMIT_PER_IP_DAY', 10), global: num('JB_LIMIT_GLOBAL_DAY', 300) },
};
export const isDemo = (u: any) => !!u && String(u.email || '').toLowerCase() === env('DEMO_EMAIL', 'demo@hollowco.app').toLowerCase();
export class LimitError extends Error { status = 429; constructor(m: string) { super(m); } }
const fmt = (ms: number) => { const h = Math.ceil(ms / 3_600_000); return h <= 1 ? 'within the hour' : `in about ${h} hours`; };
/** Pure check used by the API and the tests. `times` = createdAt ms of shops in window. */
export function checkShopQuota(userTimes: number[], globalTimes: number[], demo: boolean, now = Date.now()) {
  const L = SHOP_LIMITS(); const lim = demo ? L.perDemo : L.perUser;
  const u = userTimes.filter((t) => now - t < DAY).sort((a, b) => a - b);
  const g = globalTimes.filter((t) => now - t < DAY).sort((a, b) => a - b);
  if (g.length >= L.global) throw new LimitError(`HollowCo has hit today's site-wide limit of ${L.global} new shops (it keeps the AI bill in check). Please try again ${fmt(DAY - (now - g[g.length - L.global]))}.`);
  if (u.length >= lim) throw new LimitError(`You've built ${u.length} shops in the last 24 hours, the limit is ${lim} per account. You can build another ${fmt(DAY - (now - u[u.length - lim]))}.`);
  return { used: u.length, limit: lim, globalUsed: g.length, globalLimit: L.global };
}
const hits = new Map<string, number[]>();
export function takeAction(kind: string, key: string, tier: 'user' | 'demo' | 'anon', now = Date.now()) {
  const L = ACTION_LIMITS[kind]; const lim = L[tier];
  const win = (k: string) => { const a = (hits.get(k) || []).filter((t) => now - t < DAY); hits.set(k, a); return a; };
  const g = win(kind + ':*'), u = win(kind + ':' + key);
  const what = kind === 'simulate' ? 'simulated customers' : 'jailbreak tests';
  if (g.length >= L.global) throw new LimitError(`Today's site-wide limit for ${what} (${L.global}) is reached. Please try again tomorrow.`);
  if (u.length >= lim) throw new LimitError(`You've run ${lim} ${what} in the last 24 hours, which is the daily limit${tier === 'anon' ? ' for visitors. Sign in for more' : ''}. Try again later.`);
  g.push(now); u.push(now);
  return { used: u.length, limit: lim };
}
export const _resetActions = () => hits.clear();
